import { prisma } from './prisma';
import { emailQueue, makeJobId } from './queue';

interface ScheduleParams {
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit?: number;
  senderId: string;
  createdBy?: string;
}

/**
 * Create a campaign, batch-insert email rows, and batch-enqueue BullMQ delayed jobs.
 *
 * Each email gets a deterministic BullMQ job ID ("email-{uuid}") so re-enqueuing
 * on restart/reconciliation never creates duplicates.
 *
 * For 1000+ recipients, this uses:
 *   - prisma.email.createMany() for batch DB insert
 *   - emailQueue.addBulk() for batch Redis pipeline
 */
export async function scheduleCampaign(params: ScheduleParams): Promise<{
  campaignId: string;
  emailCount: number;
}> {
  const {
    subject,
    body,
    recipients,
    startTime,
    delayMs,
    hourlyLimit,
    senderId,
    createdBy,
  } = params;

  // 1. Validate sender exists
  const sender = await prisma.sender.findUniqueOrThrow({
    where: { id: senderId },
  });

  // 2. Create campaign
  const campaign = await prisma.campaign.create({
    data: {
      subject,
      body,
      createdBy: createdBy ?? null,
      startTime,
      delayMs,
      hourlyLimit: hourlyLimit ?? null,
      totalRecipients: recipients.length,
      status: 'PENDING',
    },
  });

  // 3. Compute per-recipient scheduled times and prepare email rows
  const now = Date.now();
  const emailData = recipients.map((recipientEmail, index) => {
    const scheduledTime = new Date(startTime.getTime() + index * delayMs);
    return {
      campaignId: campaign.id,
      senderId: sender.id,
      recipientEmail: recipientEmail.trim().toLowerCase(),
      subject,
      body,
      status: 'PENDING' as const,
      scheduledTime,
      bullmqJobId: null as string | null, // Will be set after enqueue
    };
  });

  // 4. Batch insert email rows
  await prisma.email.createMany({
    data: emailData,
  });

  // 5. Fetch created emails to get their IDs (createMany doesn't return them)
  const createdEmails = await prisma.email.findMany({
    where: { campaignId: campaign.id },
    orderBy: { scheduledTime: 'asc' },
    select: { id: true, scheduledTime: true },
  });

  // 6. Batch enqueue BullMQ delayed jobs
  const jobs = createdEmails.map((email) => {
    const delay = Math.max(0, email.scheduledTime.getTime() - now);
    const jobId = makeJobId(email.id);

    return {
      name: 'send-email',
      data: { emailId: email.id },
      opts: {
        jobId,
        delay,
      },
    };
  });

  await emailQueue.addBulk(jobs);

  // 7. Update email rows with bullmqJobId and status → SCHEDULED
  const updatePromises = createdEmails.map((email) =>
    prisma.email.update({
      where: { id: email.id },
      data: {
        bullmqJobId: makeJobId(email.id),
        status: 'SCHEDULED',
      },
    })
  );
  await Promise.all(updatePromises);

  // 8. Update campaign status → PROCESSING
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'PROCESSING' },
  });

  console.log(
    `[Scheduler] Campaign ${campaign.id} created: ${createdEmails.length} emails scheduled, ` +
    `starting at ${startTime.toISOString()}, delay=${delayMs}ms`
  );

  return {
    campaignId: campaign.id,
    emailCount: createdEmails.length,
  };
}
