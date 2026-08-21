import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for ${key}: ${value}`);
  return parsed;
}

export const config = {
  // Database
  DATABASE_URL: required('DATABASE_URL'),

  // Redis
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

  // Server
  PORT: optionalInt('PORT', 4000),
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:3000'),

  // BullMQ Worker
  WORKER_CONCURRENCY: optionalInt('WORKER_CONCURRENCY', 5),
  MIN_DELAY_BETWEEN_EMAILS_MS: optionalInt('MIN_DELAY_BETWEEN_EMAILS_MS', 500),

  // Rate Limiting
  MAX_EMAILS_PER_HOUR: optionalInt('MAX_EMAILS_PER_HOUR', 100),
  MAX_EMAILS_PER_HOUR_PER_SENDER: optionalInt('MAX_EMAILS_PER_HOUR_PER_SENDER', 50),
} as const;
