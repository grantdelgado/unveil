import { NextRequest, NextResponse } from 'next/server';
import { validatePhoneNumber } from '@/lib/validations';
import { createApiSupabaseClient } from '@/lib/supabase/server';
import { logger, logAuth, logAuthError } from '@/lib/logger';
import { maskPhoneForLogging } from '@/lib/utils/phone';
import {
  checkOtpPhoneRateLimit,
  checkOtpIpRateLimit,
  getClientIp,
} from '@/lib/rate-limit';

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
  const clientIP = getClientIp(request.headers);

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

    // Check IP-based rate limiting first (burst protection) - using Upstash Redis
    const ipRateLimit = await checkOtpIpRateLimit(clientIP);
    if (!ipRateLimit.success) {
      const retryAfter = Math.ceil((ipRateLimit.reset - Date.now()) / 1000);
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
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
          },
        },
      );
    }

    // Check phone-based rate limiting - using Upstash Redis
    const phoneRateLimit = await checkOtpPhoneRateLimit(normalizedPhone);
    if (!phoneRateLimit.success) {
      const retryAfter = Math.ceil((phoneRateLimit.reset - Date.now()) / 1000);
      logAuthError('Phone rate limit exceeded for OTP resend', {
        phone: maskPhoneForLogging(normalizedPhone),
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
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
          },
        },
      );
    }

    // Send OTP using the same Supabase method as initial send
    logAuth('Resending OTP to phone', { phone: maskPhoneForLogging(normalizedPhone), context });

    // Create server-side Supabase client for API route
    const supabase = createApiSupabaseClient(request);
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
    logAuth('OTP resent successfully', { phone: maskPhoneForLogging(normalizedPhone) });
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
