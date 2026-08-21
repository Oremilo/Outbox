/**
 * Standalone worker entry point.
 *
 * Run with: npm run worker
 *
 * Use this to scale workers independently from the Express API server.
 * In development, the worker runs in-process with the server (npm run dev).
 */

import { config } from './config';
import { createEmailWorker } from './lib/bullmq-worker';
import { reconcileOnBoot } from './lib/reconciler';

async function main() {
  console.log('[Worker] Starting standalone worker process...');

  // Run reconciliation on boot
  try {
    await reconcileOnBoot();
  } catch (error) {
    console.error('[Worker] Reconciliation failed (non-fatal):', error);
  }

  // Start the worker
  const worker = createEmailWorker();

  console.log(`[Worker] Standalone worker running (concurrency=${config.WORKER_CONCURRENCY})`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down worker...`);
    await worker.close();
    console.log('[Worker] Closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
