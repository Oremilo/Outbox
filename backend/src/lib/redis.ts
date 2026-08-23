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
const redisUrl = new URL(config.REDIS_URL);
export const redisConnection = {
  host: redisUrl.hostname || 'localhost',
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
};
