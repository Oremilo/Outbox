import Redis from 'ioredis';
import { config } from '../config';

// Shared Redis connection for rate limiting and other direct Redis ops.
// BullMQ creates its own connections internally.
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

// Connection config object for BullMQ (it needs to create its own connections)
export const redisConnection = {
  host: new URL(config.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(config.REDIS_URL).port || '6379', 10),
};
