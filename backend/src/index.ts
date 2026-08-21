import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { createEmailWorker } from './lib/bullmq-worker';
import { reconcileOnBoot } from './lib/reconciler';

// Routes
import sendersRouter from './routes/senders';
import scheduleRouter from './routes/schedule';
import emailsRouter from './routes/emails';
import campaignsRouter from './routes/campaigns';

async function main() {
  const app = express();

  // ── Middleware ───────────────────────────────────────────
  app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' })); // Large payload for CSV data

  // ── Health check ────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API Routes ──────────────────────────────────────────
  app.use('/api/senders', sendersRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/campaigns', campaignsRouter);

  // ── Error Handler ───────────────────────────────────────
  app.use(errorHandler);

  // ── Boot-time reconciliation ────────────────────────────
  // Run BEFORE the worker starts to fix any inconsistencies
  try {
    await reconcileOnBoot();
  } catch (error) {
    console.error('[Boot] Reconciliation failed (non-fatal):', error);
  }

  // ── Start BullMQ Worker (in-process) ────────────────────
  const worker = createEmailWorker();

  // ── Start Express Server ────────────────────────────────
  app.listen(config.PORT, () => {
    console.log(`\n🚀 OutboxLab backend running on http://localhost:${config.PORT}`);
    console.log(`   Health: http://localhost:${config.PORT}/api/health`);
    console.log(`   Frontend: ${config.FRONTEND_URL}\n`);
  });

  // ── Graceful shutdown ───────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    await worker.close();
    console.log('[Shutdown] Worker closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[Fatal] Failed to start server:', error);
  process.exit(1);
});
