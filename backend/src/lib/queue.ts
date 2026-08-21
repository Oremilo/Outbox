import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed for debugging
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed for debugging
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('[Queue] Error:', err.message);
});

/**
 * Deterministic job ID for an email record.
 * Format: "email-{uuid}" — no colons (BullMQ constraint), not pure digits.
 */
export function makeJobId(emailId: string): string {
  return `email-${emailId}`;
}
