import { redis } from './redis';
import { config } from '../config';

/**
 * Atomic Redis rate limiter using a Lua script.
 *
 * Uses a fixed-window counter pattern:
 *   key = "ratelimit-{scope}-{YYYY-MM-DDTHH}"
 *   INCR first, then check if over limit.
 *
 * Because INCR happens before the limit check, the counter is always accurate.
 * Two concurrent workers cannot both "sneak in" at count 100 — one will see 100
 * (allowed), the other will see 101 (denied).
 *
 * TTL is set on first INCR (current == 1) to auto-expire old windows.
 */
const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
  return {current, 0}
else
  return {current, 1}
end
`;

/**
 * Get the hour window key for rate limiting.
 * Format: "2026-08-21T11" — changes every hour.
 */
function getHourWindow(date: Date = new Date()): string {
  return date.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

/**
 * Build the Redis key for a rate limit counter.
 */
function makeRateLimitKey(scope: string, hourWindow: string): string {
  return `ratelimit-${scope}-${hourWindow}`;
}

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  scope: string;
  hourWindow: string;
}

/**
 * Check and increment the rate limit counter atomically.
 * Returns whether the operation is allowed.
 */
async function checkRateLimit(
  scope: string,
  limit: number,
  hourWindow?: string
): Promise<RateLimitResult> {
  const hw = hourWindow ?? getHourWindow();
  const key = makeRateLimitKey(scope, hw);

  // TTL = 7200 seconds (2 hours) — gives buffer beyond the 1-hour window
  // so the key doesn't expire mid-window due to clock skew
  const result = await redis.eval(RATE_LIMIT_LUA, 1, key, limit, 7200) as [number, number];

  return {
    allowed: result[1] === 1,
    currentCount: result[0],
    limit,
    scope,
    hourWindow: hw,
  };
}

/**
 * Check both global and per-sender rate limits.
 * Both must pass for the email to be sent.
 */
export async function checkEmailRateLimit(senderId: string): Promise<{
  allowed: boolean;
  globalResult: RateLimitResult;
  senderResult: RateLimitResult;
  nextWindowStart: Date | null;
}> {
  const globalResult = await checkRateLimit('global', config.MAX_EMAILS_PER_HOUR);
  const senderResult = await checkRateLimit(`sender-${senderId}`, config.MAX_EMAILS_PER_HOUR_PER_SENDER);

  const allowed = globalResult.allowed && senderResult.allowed;

  let nextWindowStart: Date | null = null;
  if (!allowed) {
    // Calculate start of next hour
    const now = new Date();
    nextWindowStart = new Date(now);
    nextWindowStart.setMinutes(0, 0, 0);
    nextWindowStart.setHours(nextWindowStart.getHours() + 1);
  }

  return { allowed, globalResult, senderResult, nextWindowStart };
}

/**
 * Decrement the rate limit counter (used when a job is rescheduled, not actually sent).
 * This "undoes" the INCR that happened during the check.
 */
export async function decrementRateLimit(senderId: string): Promise<void> {
  const hw = getHourWindow();
  const globalKey = makeRateLimitKey('global', hw);
  const senderKey = makeRateLimitKey(`sender-${senderId}`, hw);

  await redis.decr(globalKey);
  await redis.decr(senderKey);
}

/**
 * Get current rate limit status (for monitoring/debugging).
 */
export async function getRateLimitStatus(senderId?: string): Promise<{
  global: { count: number; limit: number };
  sender?: { count: number; limit: number };
}> {
  const hw = getHourWindow();
  const globalKey = makeRateLimitKey('global', hw);
  const globalCount = parseInt(await redis.get(globalKey) || '0', 10);

  const result: {
    global: { count: number; limit: number };
    sender?: { count: number; limit: number };
  } = {
    global: { count: globalCount, limit: config.MAX_EMAILS_PER_HOUR },
  };

  if (senderId) {
    const senderKey = makeRateLimitKey(`sender-${senderId}`, hw);
    const senderCount = parseInt(await redis.get(senderKey) || '0', 10);
    result.sender = { count: senderCount, limit: config.MAX_EMAILS_PER_HOUR_PER_SENDER };
  }

  return result;
}
