import { Worker, Job } from 'bullmq';
import { redisConnection } from './redis';
import { QUEUE_NAME, emailQueue, makeJobId } from './queue';
import { prisma } from './prisma';
import { sendEmail } from './email-sender';
import { checkEmailRateLimit } from './rate-limiter';
import { config } from '../config';

/**
 * BullMQ Worker that processes email send jobs.
 *
 * Concurrency & delay between sends:
 *   - concurrency is set via WORKER_CONCURRENCY env var
 *   - MIN_DELAY_BETWEEN_EMAILS_MS is enforced via BullMQ's built-in limiter
 *     (max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS), which is global across
 *     all workers sharing the same queue and backed by Redis atomically.
 *
 * Rate limiting:
 *   - Before sending, checks global + per-sender hourly limits via Redis Lua script
 *   - If rate limited, reschedules the job to the next hour window instead of failing
 *
 * Idempotency:
 *   - Layer 1: Deterministic BullMQ jobId prevents duplicate enqueues
 *   - Layer 2: DB status check — SENT rows are never re-processed
 *
 * Status transitions:
 *   PENDING → SCHEDULED → SENDING → SENT | FAILED
 */

async function processEmailJob(job: Job<{ emailId: string }>): Promise<void> {
  const { emailId } = job.data;
  const logPrefix = `[Worker] Job ${job.id} email=${emailId}`;

  // 1. Fetch email from DB
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { campaign: true },
  });

  if (!email) {
    console.warn(`${logPrefix} Email not found in DB — skipping`);
    return;
  }

  // 2. Idempotency guard: if already sent, skip
  if (email.status === 'SENT') {
    console.log(`${logPrefix} Already sent — skipping (idempotency guard)`);
    return;
  }

  // 3. Check rate limits
  const rateLimitCheck = await checkEmailRateLimit(email.senderId, email.campaign.hourlyLimit);

  if (!rateLimitCheck.allowed) {
    // Reschedule to next hour window
    const nextWindow = rateLimitCheck.nextWindowStart!;
    const delay = Math.max(0, nextWindow.getTime() - Date.now());

    console.log(
      `[RateLimiter] Limit reached for sender ${email.senderId}, rescheduling job ${job.id} to ${nextWindow.toISOString()}`
    );

    // Update scheduled time in DB
    await prisma.email.update({
      where: { id: emailId },
      data: { scheduledTime: nextWindow },
    });

    // Move job to delayed state with new delay
    await job.moveToDelayed(Date.now() + delay, job.token);
    // Throw DelayedError so BullMQ knows the job was intentionally delayed
    throw new DelayedError();
  }

  // 4. Mark as SENDING
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: 'SENDING',
      attemptCount: { increment: 1 },
    },
  });

  try {
    // 5. Send the email via Nodemailer/Ethereal
    const result = await sendEmail({
      senderId: email.senderId,
      to: email.recipientEmail,
      subject: email.subject,
      body: email.body,
    });

    // 6. Mark as SENT
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentTime: new Date(),
      },
    });

    console.log(`${logPrefix} ✓ Sent successfully (preview: ${result.previewUrl || 'N/A'})`);

    // 7. Check if all emails in campaign are done
    await checkCampaignCompletion(email.campaignId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} ✗ Send failed: ${errorMsg}`);

    // Mark as FAILED
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'FAILED',
        errorMessage: errorMsg,
      },
    });

    // Check campaign completion even on failure
    await checkCampaignCompletion(email.campaignId);

    // Re-throw to let BullMQ handle retries
    throw error;
  }
}

/**
 * Custom error class to signal BullMQ that a job was intentionally delayed.
 */
class DelayedError extends Error {
  constructor() {
    super('Job rescheduled due to rate limit');
    this.name = 'DelayedError';
  }
}

/**
 * Check if all emails in a campaign are in terminal state (SENT or FAILED).
 * If so, mark campaign as COMPLETED or FAILED.
 */
async function checkCampaignCompletion(campaignId: string): Promise<void> {
  const stats = await prisma.email.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  });

  const statusCounts = Object.fromEntries(
    stats.map((s) => [s.status, s._count])
  );

  const total =
    (statusCounts['PENDING'] ?? 0) +
    (statusCounts['SCHEDULED'] ?? 0) +
    (statusCounts['SENDING'] ?? 0) +
    (statusCounts['SENT'] ?? 0) +
    (statusCounts['FAILED'] ?? 0);

  const pending =
    (statusCounts['PENDING'] ?? 0) +
    (statusCounts['SCHEDULED'] ?? 0) +
    (statusCounts['SENDING'] ?? 0);

  if (pending === 0 && total > 0) {
    const allFailed = (statusCounts['SENT'] ?? 0) === 0;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: allFailed ? 'FAILED' : 'COMPLETED' },
    });

    console.log(
      `[Worker] Campaign ${campaignId} completed: ` +
      `sent=${statusCounts['SENT'] ?? 0} failed=${statusCounts['FAILED'] ?? 0}`
    );
  }
}

/**
 * Create and start the BullMQ worker.
 */
export function createEmailWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency: config.WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: config.MIN_DELAY_BETWEEN_EMAILS_MS,
    },
  });

  worker.on('completed', (job) => {
    // Job completed — no additional action needed
  });

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError) {
      // This is expected — job was rescheduled due to rate limiting
      return;
    }
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(
    `[Worker] Started with concurrency=${config.WORKER_CONCURRENCY}, ` +
    `minDelay=${config.MIN_DELAY_BETWEEN_EMAILS_MS}ms`
  );

  return worker;
}
