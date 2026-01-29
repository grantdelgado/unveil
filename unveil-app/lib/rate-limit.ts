/**
 * Centralized Rate Limiting with Upstash Redis
 *
 * Provides durable rate limiting that works across serverless instances.
 * Falls back to allowing requests if Redis is unavailable to prevent outages.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// Redis client - initialized lazily
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Log once per cold start, not on every request
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[Rate Limit] Upstash Redis not configured. Using in-memory fallback (not recommended for production).',
      );
    }
    return null;
  }

  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (error) {
    logger.error('Failed to initialize Upstash Redis', { error });
    return null;
  }
}

// Rate limiters for different contexts - initialized lazily
const rateLimiters = new Map<string, Ratelimit>();

/**
 * Rate limit configurations by context
 * Using sliding window algorithm for smooth rate limiting
 */
const RATE_LIMIT_CONFIGS = {
  // API route rate limits
  api: {
    auth: { requests: 10, window: '1m' as const }, // 10 auth requests per minute
    sms: { requests: 5, window: '1m' as const }, // 5 SMS requests per minute
    media: { requests: 20, window: '1m' as const }, // 20 media requests per minute
    rum: { requests: 30, window: '1m' as const }, // 30 RUM events per minute (unauthenticated)
    default: { requests: 100, window: '1m' as const }, // 100 general API requests per minute
  },
  // OTP-specific rate limits (stricter)
  otp: {
    perPhone: { requests: 3, window: '10m' as const }, // 3 OTPs per phone per 10 minutes
    perPhoneCooldown: { requests: 1, window: '30s' as const }, // 30 second cooldown between requests
    perIp: { requests: 10, window: '10m' as const }, // 10 OTPs per IP per 10 minutes
  },
} as const;

/**
 * Convert window string to milliseconds
 */
function windowToMs(window: '30s' | '1m' | '10m' | '1h'): number {
  switch (window) {
    case '30s':
      return 30_000;
    case '1m':
      return 60_000;
    case '10m':
      return 600_000;
    case '1h':
      return 3_600_000;
  }
}

/**
 * Get or create a rate limiter for a specific context
 */
function getRateLimiter(
  context: string,
  config: { requests: number; window: '30s' | '1m' | '10m' | '1h' },
): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  const key = `${context}:${config.requests}:${config.window}`;

  if (!rateLimiters.has(key)) {
    const windowMs = windowToMs(config.window);

    rateLimiters.set(
      key,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.requests, `${windowMs}ms`),
        analytics: true,
        prefix: `unveil:ratelimit:${context}`,
      }),
    );
  }

  return rateLimiters.get(key)!;
}

/**
 * In-memory fallback store for when Redis is unavailable
 */
const inMemoryStore = new Map<
  string,
  { count: number; resetTime: number }
>();

function checkInMemoryLimit(
  identifier: string,
  config: { requests: number; window: '30s' | '1m' | '10m' | '1h' },
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = windowToMs(config.window);

  const current = inMemoryStore.get(identifier);

  if (!current || now > current.resetTime) {
    const resetTime = now + windowMs;
    inMemoryStore.set(identifier, { count: 1, resetTime });
    return {
      success: true,
      remaining: config.requests - 1,
      reset: resetTime,
    };
  }

  if (current.count >= config.requests) {
    return {
      success: false,
      remaining: 0,
      reset: current.resetTime,
    };
  }

  current.count++;
  inMemoryStore.set(identifier, current);

  return {
    success: true,
    remaining: config.requests - current.count,
    reset: current.resetTime,
  };
}

// Cleanup in-memory store periodically
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, value] of inMemoryStore.entries()) {
        if (now > value.resetTime) {
          inMemoryStore.delete(key);
        }
      }
    },
    60_000, // Clean up every minute
  );
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Check rate limit for API routes
 */
export async function checkApiRateLimit(
  clientId: string,
  route: string,
): Promise<RateLimitResult> {
  // Determine which config to use based on route
  let config: { requests: number; window: '30s' | '1m' | '10m' | '1h' } =
    RATE_LIMIT_CONFIGS.api.default;
  let context = 'api:default';

  if (route.startsWith('/api/auth')) {
    config = RATE_LIMIT_CONFIGS.api.auth;
    context = 'api:auth';
  } else if (route.startsWith('/api/sms')) {
    config = RATE_LIMIT_CONFIGS.api.sms;
    context = 'api:sms';
  } else if (route.startsWith('/api/media')) {
    config = RATE_LIMIT_CONFIGS.api.media;
    context = 'api:media';
  } else if (route.startsWith('/api/rum')) {
    // RUM endpoint is unauthenticated, use stricter limits
    config = RATE_LIMIT_CONFIGS.api.rum;
    context = 'api:rum';
  }

  const identifier = `${context}:${clientId}`;
  const limiter = getRateLimiter(context, config);

  if (!limiter) {
    // Fallback to in-memory
    const result = checkInMemoryLimit(identifier, config);
    return { ...result, limit: config.requests };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: config.requests,
    };
  } catch (error) {
    logger.error('Rate limit check failed, allowing request', { error, route });
    // Fail open - allow the request if Redis is down
    return {
      success: true,
      remaining: config.requests - 1,
      reset: Date.now() + 60_000,
      limit: config.requests,
    };
  }
}

/**
 * Check OTP rate limit by phone number
 *
 * Enforces TWO limits:
 * 1. Cooldown: 1 request per 30 seconds (prevents rapid-fire spam)
 * 2. Overall: 3 requests per 10 minutes (prevents sustained abuse)
 *
 * Both must pass for the request to be allowed.
 */
export async function checkOtpPhoneRateLimit(
  phone: string,
): Promise<RateLimitResult> {
  const cooldownConfig = RATE_LIMIT_CONFIGS.otp.perPhoneCooldown;
  const overallConfig = RATE_LIMIT_CONFIGS.otp.perPhone;

  const cooldownContext = 'otp:phone:cooldown';
  const overallContext = 'otp:phone';

  const cooldownIdentifier = `${cooldownContext}:${phone}`;
  const overallIdentifier = `${overallContext}:${phone}`;

  // Get both limiters
  const cooldownLimiter = getRateLimiter(cooldownContext, cooldownConfig);
  const overallLimiter = getRateLimiter(overallContext, overallConfig);

  // If Redis is unavailable, use in-memory fallback for both checks
  if (!cooldownLimiter || !overallLimiter) {
    // Check cooldown first (30 seconds between requests)
    const cooldownResult = checkInMemoryLimit(cooldownIdentifier, cooldownConfig);
    if (!cooldownResult.success) {
      return {
        success: false,
        remaining: 0,
        reset: cooldownResult.reset,
        limit: cooldownConfig.requests,
      };
    }

    // Check overall limit (3 per 10 minutes)
    const overallResult = checkInMemoryLimit(overallIdentifier, overallConfig);
    return { ...overallResult, limit: overallConfig.requests };
  }

  try {
    // Check cooldown first (30 seconds between requests)
    // This prevents rapid-fire OTP spam even if they have remaining attempts
    const cooldownResult = await cooldownLimiter.limit(cooldownIdentifier);
    if (!cooldownResult.success) {
      return {
        success: false,
        remaining: 0,
        reset: cooldownResult.reset,
        limit: cooldownConfig.requests,
      };
    }

    // Check overall limit (3 per 10 minutes)
    const overallResult = await overallLimiter.limit(overallIdentifier);
    return {
      success: overallResult.success,
      remaining: overallResult.remaining,
      reset: overallResult.reset,
      limit: overallConfig.requests,
    };
  } catch (error) {
    logger.error('OTP phone rate limit check failed', { error });
    // Fail open - allow the request if Redis is down
    return {
      success: true,
      remaining: overallConfig.requests - 1,
      reset: Date.now() + 600_000,
      limit: overallConfig.requests,
    };
  }
}

/**
 * Check OTP rate limit by IP address
 */
export async function checkOtpIpRateLimit(ip: string): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS.otp.perIp;
  const context = 'otp:ip';
  const identifier = `${context}:${ip}`;

  const limiter = getRateLimiter(context, config);

  if (!limiter) {
    const result = checkInMemoryLimit(identifier, config);
    return { ...result, limit: config.requests };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: config.requests,
    };
  } catch (error) {
    logger.error('OTP IP rate limit check failed', { error });
    return {
      success: true,
      remaining: config.requests - 1,
      reset: Date.now() + 600_000,
      limit: config.requests,
    };
  }
}

/**
 * Get client identifier from request headers
 */
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
  const userAgent = headers.get('user-agent') || 'unknown';

  // Simple hash for user agent
  const uaHash = userAgent.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  return `${ip}:${uaHash}`;
}

/**
 * Get client IP from request headers
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  return forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
}
