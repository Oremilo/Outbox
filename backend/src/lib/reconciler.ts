import { prisma } from './prisma';
import { emailQueue, makeJobId } from './queue';

/**
 * Boot-time reconciliation: ensures DB state and BullMQ queue state are consistent.
 *
 * BullMQ + Redis persistence (AOF) already guarantees delayed jobs survive app restarts.
 * This reconciler is a SAFETY NET for edge cases:
 *   - Redis data loss (container restart without volume, etc.)
 *   - Partial writes (DB insert succeeded but enqueue failed mid-operation)
 *   - Crash mid-send (email stuck in SENDING status)
 *
 * It uses deterministic job IDs ("email-{uuid}") so re-enqueuing never creates duplicates —
 * BullMQ silently ignores jobs with an existing jobId.
 *
 * Called once on application boot, before the Worker starts processing.
 */
export async function reconcileOnBoot(): Promise<void> {
  console.log('[Reconciler] Starting boot-time reconciliation...');

  let reEnqueuedCount = 0;
  let resetCount = 0;

  // 1. Find emails stuck in SENDING state (crash mid-send)
  //    Reset them to SCHEDULED so they'll be re-processed
  const stuckSending = await prisma.email.findMany({
    where: { status: 'SENDING' },
  });

  if (stuckSending.length > 0) {
    console.log(`[Reconciler] Found ${stuckSending.length} emails stuck in SENDING — resetting to SCHEDULED`);

    await prisma.email.updateMany({
      where: { status: 'SENDING' },
      data: { status: 'SCHEDULED' },
    });
    resetCount = stuckSending.length;
  }

  // 2. Find emails that should be in the queue but might not be
  //    (PENDING or SCHEDULED, not yet SENT or FAILED)
  const pendingEmails = await prisma.email.findMany({
    where: {
      status: { in: ['PENDING', 'SCHEDULED'] },
    },
    select: {
      id: true,
      scheduledTime: true,
      bullmqJobId: true,
    },
  });

  if (pendingEmails.length === 0) {
    console.log('[Reconciler] No pending/scheduled emails to reconcile');
    return;
  }

  console.log(`[Reconciler] Checking ${pendingEmails.length} pending/scheduled emails against queue...`);

  // 3. For each pending email, try to re-enqueue with the same deterministic job ID.
  //    BullMQ will silently ignore if the job already exists (idempotent by design).
  const now = Date.now();
  const bulkJobs = [];

  for (const email of pendingEmails) {
    const jobId = makeJobId(email.id);
    const delay = Math.max(0, email.scheduledTime.getTime() - now);

    bulkJobs.push({
      name: 'send-email',
      data: { emailId: email.id },
      opts: {
        jobId,
        delay,
      },
    });
  }

  // Batch enqueue — BullMQ handles dedup via jobId
  if (bulkJobs.length > 0) {
    try {
      await emailQueue.addBulk(bulkJobs);
      reEnqueuedCount = bulkJobs.length;
    } catch (error) {
      // Individual job ID conflicts are expected and handled by BullMQ.
      // If the entire addBulk fails, log and continue — the jobs that were
      // already in the queue will still be processed.
      console.warn('[Reconciler] Bulk enqueue had errors (expected for existing jobs):', error);
    }
  }

  // 4. Update any PENDING emails to SCHEDULED (they now have jobs in the queue)
  await prisma.email.updateMany({
    where: {
      status: 'PENDING',
      id: { in: pendingEmails.map((e) => e.id) },
    },
    data: { status: 'SCHEDULED' },
  });

  console.log(
    `[Reconciler] Reconciliation complete: ` +
    `${reEnqueuedCount} re-enqueued, ${resetCount} reset from SENDING`
  );
}
