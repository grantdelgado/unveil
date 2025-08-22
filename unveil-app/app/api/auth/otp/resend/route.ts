import { NextRequest, NextResponse } from 'next/server';
import { validatePhoneNumber } from '@/lib/validations';
import { supabase } from '@/lib/supabase/client';
import { logger, logAuth, logAuthError } from '@/lib/logger';

// Rate limiting configuration for OTP resends
const RATE_LIMIT_CONFIG = {
  // Per phone number limits
  PHONE_MAX_ATTEMPTS: 3,
  PHONE_WINDOW_MINUTES: 10,
  PHONE_COOLDOWN_SECONDS: 30, // Reduced from 60 to 30 seconds

  // Per IP limits (burst protection)
  IP_MAX_ATTEMPTS: 10,
  IP_WINDOW_MINUTES: 10,
};

// In-memory store for rate limiting (in production, use Redis/Upstash)
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number; lastAttempt: number }
>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if OTP resend is allowed for a phone number
 */
function checkPhoneRateLimit(phone: string): RateLimitResult {
  const now = Date.now();
  const key = `phone:${phone}`;
  const current = rateLimitStore.get(key);
  const windowMs = RATE_LIMIT_CONFIG.PHONE_WINDOW_MINUTES * 60 * 1000;
  const cooldownMs = RATE_LIMIT_CONFIG.PHONE_COOLDOWN_SECONDS * 1000;

  if (!current || now > current.resetTime) {
    // First request or window expired
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime, lastAttempt: now });
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.PHONE_MAX_ATTEMPTS - 1,
      resetTime,
    };
  }

  // Check cooldown period
  if (now - current.lastAttempt < cooldownMs) {
    const retryAfter = Math.ceil(
      (current.lastAttempt + cooldownMs - now) / 1000,
    );
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter,
    };
  }

  // Check max attempts
  if (current.count >= RATE_LIMIT_CONFIG.PHONE_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter,
    };
  }

  // Increment counter and update last attempt
  current.count++;
  current.lastAttempt = now;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.PHONE_MAX_ATTEMPTS - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Check IP-based rate limiting for burst protection
 */
function checkIPRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const key = `ip:${ip}`;
  const current = rateLimitStore.get(key);
  const windowMs = RATE_LIMIT_CONFIG.IP_WINDOW_MINUTES * 60 * 1000;

  if (!current || now > current.resetTime) {
    // First request or window expired
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime, lastAttempt: now });
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS - 1,
      resetTime,
    };
  }

  if (current.count >= RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
      retryAfter,
    };
  }

  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
}

/**
 * Log OTP resend attempt for audit purposes
 */
async function logOTPResendAttempt(
  phone: string,
  ip: string,
  success: boolean,
  error?: string,
) {
  try {
    // We'll use the existing message_deliveries table pattern for audit logging
    // For now, just log to application logs
    logger.info('OTP Resend Attempt', {
      phone: phone.slice(0, 6) + '...',
      ip: ip.slice(0, 8) + '...',
      success,
      error: error?.slice(0, 100),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to log OTP resend attempt', { error: err });
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    // Parse request body
    const body = await request.json();
    const { phone, context } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 },
      );
    }

    // Validate phone number format
    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      logAuthError(
        'Invalid phone number format for OTP resend',
        validation.error,
      );
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 },
      );
    }

    const normalizedPhone = validation.normalized!;

    // Check IP-based rate limiting first (burst protection)
    const ipRateLimit = checkIPRateLimit(clientIP);
    if (!ipRateLimit.allowed) {
      logAuthError('IP rate limit exceeded for OTP resend', { ip: clientIP });
      await logOTPResendAttempt(
        normalizedPhone,
        clientIP,
        false,
        'IP rate limit exceeded',
      );

      return NextResponse.json(
        {
          error: 'Too many requests from this location',
          retryAfter: ipRateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': ipRateLimit.retryAfter?.toString() || '60',
          },
        },
      );
    }

    // Check phone-based rate limiting
    const phoneRateLimit = checkPhoneRateLimit(normalizedPhone);
    if (!phoneRateLimit.allowed) {
      logAuthError('Phone rate limit exceeded for OTP resend', {
        phone: normalizedPhone.slice(0, 6) + '...',
      });
      await logOTPResendAttempt(
        normalizedPhone,
        clientIP,
        false,
        'Phone rate limit exceeded',
      );

      return NextResponse.json(
        {
          error: 'Please wait before requesting another code',
          retryAfter: phoneRateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': phoneRateLimit.retryAfter?.toString() || '60',
          },
        },
      );
    }

    // Send OTP using the same Supabase method as initial send
    logAuth('Resending OTP to phone', { phone: normalizedPhone, context });

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        data: { phone: normalizedPhone },
      },
    });

    if (error) {
      logAuthError('Failed to resend OTP', error.message);
      await logOTPResendAttempt(
        normalizedPhone,
        clientIP,
        false,
        error.message,
      );

      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 },
      );
    }

    // Success - log the attempt
    logAuth('OTP resent successfully', { phone: normalizedPhone });
    await logOTPResendAttempt(normalizedPhone, clientIP, true);

    // Return generic success message to avoid phone enumeration
    return NextResponse.json(
      {
        success: true,
        message: 'If your number is registered, a verification code was sent.',
        remaining: phoneRateLimit.remaining,
      },
      { status: 200 },
    );
  } catch (err) {
    logAuthError('Unexpected error in OTP resend', err);
    await logOTPResendAttempt(
      'unknown',
      clientIP,
      false,
      'Unexpected server error',
    );

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 },
    );
  }
}
