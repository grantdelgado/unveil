import { supabase } from '@/lib/supabase/client';
import type { UserInsert } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';
import { handleAuthDatabaseError } from '@/lib/error-handling/database';

// Development phone whitelist - retrieved from Supabase auth.users with @dev.unveil.app emails
const DEV_PHONE_WHITELIST = ['+15550000001', '+15550000002', '+15550000003'];

// Check if we're in development mode
const isDevMode = () => {
  return process.env.NODE_ENV !== 'production';
};

// Rate limiting for OTP requests
interface OTPRateLimit {
  phone: string;
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

// In-memory rate limiting store (in production, use Redis or database)
const otpRateLimits = new Map<string, OTPRateLimit>();

/**
 * Rate limiting configuration constants
 * 
 * These constants define the OTP rate limiting behavior:
 * - MAX_OTP_ATTEMPTS: Maximum OTP requests allowed per time window (3 per hour)
 * - OTP_RATE_LIMIT_WINDOW: Time window for rate limiting (1 hour)
 * - OTP_BLOCK_DURATION: How long to block after max attempts (15 minutes)
 * - MIN_RETRY_INTERVAL: Minimum time between OTP requests (1 minute)
 */
/**
 * Rate limiting configuration constants
 * @constant {number} MAX_OTP_ATTEMPTS - Maximum OTP attempts allowed per time window (3)
 * @constant {number} OTP_RATE_LIMIT_WINDOW - Time window for rate limiting in ms (1 hour)
 * @constant {number} OTP_BLOCK_DURATION - Block duration after max attempts in ms (15 minutes)
 * @constant {number} MIN_RETRY_INTERVAL - Minimum time between attempts in ms (1 minute)
 */
const MAX_OTP_ATTEMPTS = 3; // Max attempts per hour
const OTP_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const OTP_BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const MIN_RETRY_INTERVAL = 60 * 1000; // 1 minute between attempts

// Removed: handleDatabaseError function - now using unified DatabaseErrorHandler from lib/error-handling/database.ts

// Phone number normalization utility - matches database normalize_phone_number function
const normalizePhoneNumber = (phone: string): string => {
  // Return empty string if input is null or empty (handle edge cases)
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return '';
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Must have at least 10 digits for a valid US number
  if (digits.length < 10) {
    return '';
  }

  // Convert to E.164 format (+1XXXXXXXXXX for US numbers)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.startsWith('1') && digits.length > 11) {
    return `+${digits.slice(0, 11)}`;
  }

  // Default: assume US number and prepend +1 to last 10 digits
  return `+1${digits.slice(-10)}`;
};

// Check if phone number is in development whitelist (bypasses OTP)
const isDevPhone = (phone: string): boolean => {
  return isDevMode() && DEV_PHONE_WHITELIST.includes(phone);
};

/**
 * Checks if a phone number is within OTP rate limits
 * 
 * Enforces rate limiting to prevent abuse:
 * - Maximum 3 attempts per hour
 * - 1-minute minimum interval between attempts  
 * - 15-minute block period after max attempts exceeded
 * 
 * @param phone - The phone number to check (any format, will be normalized)
 * @returns Object containing:
 *   - allowed: Whether OTP request is allowed
 *   - error: Human-readable error message if blocked
 *   - retryAfter: Seconds until next attempt allowed
 * 
 * @example
 * ```typescript
 * const check = checkOTPRateLimit('+15551234567')
 * if (!check.allowed) {
 *   console.log(check.error) // "Please wait 45 seconds before requesting another code."
 * }
 * ```
 */
export const checkOTPRateLimit = (
  phone: string,
): { allowed: boolean; error?: string; retryAfter?: number } => {
  const now = Date.now();
  const rateLimit = otpRateLimits.get(phone);

  if (!rateLimit) {
    return { allowed: true };
  }

  // Check if blocked
  if (rateLimit.blockedUntil && now < rateLimit.blockedUntil) {
    const retryAfter = Math.ceil((rateLimit.blockedUntil - now) / 1000);
    return {
      allowed: false,
      error: `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
    };
  }

  // Reset if window has passed
  if (now - rateLimit.lastAttempt > OTP_RATE_LIMIT_WINDOW) {
    otpRateLimits.delete(phone);
    return { allowed: true };
  }

  // Check minimum retry interval
  if (now - rateLimit.lastAttempt < MIN_RETRY_INTERVAL) {
    const retryAfter = Math.ceil(
      (MIN_RETRY_INTERVAL - (now - rateLimit.lastAttempt)) / 1000,
    );
    return {
      allowed: false,
      error: `Please wait ${retryAfter} seconds before requesting another code.`,
      retryAfter,
    };
  }

  // Check max attempts
  if (rateLimit.attempts >= MAX_OTP_ATTEMPTS) {
    const blockedUntil = now + OTP_BLOCK_DURATION;
    rateLimit.blockedUntil = blockedUntil;
    otpRateLimits.set(phone, rateLimit);

    return {
      allowed: false,
      error: `Maximum attempts exceeded. Please try again in ${Math.ceil(OTP_BLOCK_DURATION / 60000)} minutes.`,
      retryAfter: Math.ceil(OTP_BLOCK_DURATION / 1000),
    };
  }

  return { allowed: true };
};

/**
 * Records an OTP attempt for rate limiting tracking
 * 
 * Updates the in-memory rate limiting store with attempt count and timestamp.
 * Creates new entry if none exists or resets counter if outside time window.
 * 
 * @param phone - The phone number to record attempt for
 * 
 * @example
 * ```typescript
 * recordOTPAttempt('+15551234567')
 * // Subsequent checkOTPRateLimit() calls will reflect this attempt
 * ```
 */
export const recordOTPAttempt = (phone: string) => {
  const now = Date.now();
  const existing = otpRateLimits.get(phone);

  if (existing && now - existing.lastAttempt < OTP_RATE_LIMIT_WINDOW) {
    existing.attempts += 1;
    existing.lastAttempt = now;
    otpRateLimits.set(phone, existing);
  } else {
    otpRateLimits.set(phone, {
      phone,
      attempts: 1,
      lastAttempt: now,
    });
  }
};

/**
 * Clears rate limiting data for a phone number
 * 
 * Removes all rate limiting restrictions for the specified phone number.
 * Typically called after successful OTP verification.
 * 
 * @param phone - The phone number to clear restrictions for
 * 
 * @example
 * ```typescript
 * // After successful verification
 * clearOTPRateLimit('+15551234567')
 * ```
 */
export const clearOTPRateLimit = (phone: string) => {
  otpRateLimits.delete(phone);
};

/**
 * Gets the currently authenticated user from Supabase
 * 
 * Retrieves the current user session data from Supabase Auth.
 * Returns null if no user is authenticated.
 * 
 * @returns Promise resolving to object with:
 *   - user: Supabase User object or null
 *   - error: Error object if operation failed
 * 
 * @example
 * ```typescript
 * const { user, error } = await getCurrentUser()
 * if (user) {
 *   console.log('User ID:', user.id)
 * }
 * ```
 */
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  } catch (error) {
    logger.authError('Error getting current user', error);
    return { user: null, error };
  }
};

/**
 * Gets the current authentication session from Supabase
 * 
 * Retrieves the active session including access token and refresh token.
 * Used for checking authentication status and token validity.
 * 
 * @returns Promise resolving to object with:
 *   - session: Supabase Session object or null
 *   - error: Error object if operation failed
 * 
 * @example
 * ```typescript
 * const { session, error } = await getCurrentSession()
 * if (session) {
 *   console.log('Session expires:', session.expires_at)
 * }
 * ```
 */
export const getCurrentSession = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    return { session, error };
  } catch (error) {
    logger.authError('Error getting current session', error);
    return { session: null, error };
  }
};

/**
 * Signs out the current user from Supabase Auth
 * 
 * Terminates the current session and clears all authentication tokens.
 * User will need to re-authenticate to access protected resources.
 * 
 * @returns Promise resolving to object with:
 *   - error: Error object if sign out failed, null on success
 * 
 * @example
 * ```typescript
 * const { error } = await signOut()
 * if (!error) {
 *   // Redirect to login page
 *   router.push('/login')
 * }
 * ```
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    logger.authError('Error signing out', error);
    return { error };
  }
};

/**
 * Clears any stale sessions that reference deleted users
 * 
 * Checks if the current auth session references a user that no longer
 * exists in the users table. If so, signs out the user to prevent
 * authentication errors.
 * 
 * @returns Promise resolving to object with:
 *   - wasStale: Whether a stale session was detected and cleared
 *   - error: Error object if operation failed
 * 
 * @example
 * ```typescript
 * // Call this on login page load
 * const { wasStale } = await clearStaleSession()
 * if (wasStale) {
 *   console.log('Cleared stale session')
 * }
 * ```
 */
export const clearStaleSession = async (): Promise<{
  wasStale: boolean;
  error?: any;
}> => {
  try {
    // Get current session if it exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.authError('Error checking session for staleness', sessionError);
      return { wasStale: false, error: sessionError };
    }
    
    if (!session?.user) {
      // No session, nothing to clear
      return { wasStale: false };
    }
    
    logger.auth('Checking session validity', { userId: session.user.id });
    
    // Check if the auth user ID exists in our users table
    const { data: isValid, error: validationError } = await supabase.rpc(
      'is_valid_auth_session',
      { auth_user_id: session.user.id }
    );
    
    if (validationError) {
      logger.authError('Error validating session', validationError);
      return { wasStale: false, error: validationError };
    }
    
    if (!isValid) {
      // Session references a deleted user - clear it
      logger.auth('Detected stale session, signing out', { 
        userId: session.user.id,
        phone: session.user.phone || session.user.user_metadata?.phone 
      });
      
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        logger.authError('Error signing out stale session', signOutError);
        return { wasStale: true, error: signOutError };
      }
      
      return { wasStale: true };
    }
    
    // Session is valid
    logger.auth('Session is valid', { userId: session.user.id });
    return { wasStale: false };
    
  } catch (error) {
    logger.authError('Error in clearStaleSession', error);
    return { wasStale: false, error };
  }
};

/**
 * Sends an OTP (One-Time Password) to a phone number
 * 
 * Handles both development and production OTP flows:
 * - Development: Whitelisted phones (+15550000001-003) use pre-existing credentials
 * - Production: Sends actual SMS OTP via Supabase Auth
 * 
 * Enforces rate limiting and validates phone number format.
 * Creates user profile in database if it doesn't exist.
 * 
 * @param phone - Phone number in any format (will be normalized to E.164)
 * @returns Promise resolving to object with:
 *   - success: Whether OTP was sent successfully
 *   - isDev: Whether this was a development bypass
 *   - isNewUser: Whether a new user account was created
 *   - error: Error message if operation failed
 * 
 * @throws {Error} Rate limit exceeded, validation failed, or database error
 * 
 * @example
 * ```typescript
 * const result = await sendOTP('+1-555-123-4567')
 * if (result.success) {
 *   console.log('OTP sent!', result.isDev ? '(dev mode)' : '(production)')
 * } else {
 *   console.error(result.error)
 * }
 * ```
 * 
 * @see {@link verifyOTP} for verifying the sent OTP
 * @see {@link checkOTPRateLimit} for rate limiting details
 */
export const sendOTP = async (
  phone: string,
): Promise<{
  success: boolean;
  isDev: boolean;
  isNewUser?: boolean;
  error?: string;
}> => {
  try {
    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone);

    // Validate normalized phone number
    if (!normalizedPhone || normalizedPhone.length < 12) {
      return {
        success: false,
        isDev: false,
        error: 'Please enter a valid 10-digit phone number',
      };
    }

    logger.auth('Sending OTP to phone', {
      originalPhone: phone,
      normalizedPhone,
    });

    // Check rate limiting
    const rateLimitCheck = checkOTPRateLimit(normalizedPhone);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        isDev: false,
        error: rateLimitCheck.error,
      };
    }

    // Check if development phone - bypass OTP and create direct session
    if (isDevPhone(normalizedPhone)) {
      logger.dev(
        'Development phone detected, bypassing OTP and creating direct session',
      );

      try {
        // Get the corresponding dev email for this phone (matches auth table format)
        const phoneForEmail = normalizedPhone.slice(1); // Remove + prefix: +15550000001 -> 15550000001
        const devEmail = `${phoneForEmail}@dev.unveil.app`;
        const devPassword = `dev-${normalizedPhone.slice(-4)}-2024`; // Match dev-setup.ts pattern

        logger.dev('Dev authentication attempt', {
          normalizedPhone,
          phoneForEmail,
          devEmail,
          devPassword,
        });

        // Try to sign in with existing dev credentials
        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (authData?.user && authData?.session) {
          logger.auth('Dev user signed in successfully', {
            userId: authData.user.id,
          });

          // Dev authentication successful - do NOT create user here
          // User creation/lookup happens in verifyOTP() for consistency
          logger.dev('Dev phone authenticated, user creation will happen in verifyOTP');

          return {
            success: true,
            isDev: true,
            // Don't return isNewUser here since we haven't checked yet
          };
        }

        if (authError) {
          logger.authError('Dev authentication failed', authError);
          return {
            success: false,
            isDev: true,
            error: `Development authentication failed: ${authError.message}`,
          };
        }

        return {
          success: false,
          isDev: true,
          error: 'Failed to create development session',
        };
      } catch (error) {
        logger.authError('Dev authentication error', error);
        return {
          success: false,
          isDev: true,
          error:
            error instanceof Error
              ? error.message
              : 'Development authentication failed',
        };
      }
    }

    // Send OTP via Supabase
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        channel: 'sms',
      },
    });

    if (error) {
      logger.authError('Failed to send OTP', error);
      return {
        success: false,
        isDev: false,
        error: error.message,
      };
    }

    // Record attempt for rate limiting
    recordOTPAttempt(normalizedPhone);

    logger.auth('OTP sent successfully');
    return {
      success: true,
      isDev: false,
    };
  } catch (error) {
    logger.authError('OTP send error', error);
    return {
      success: false,
      isDev: false,
      error: error instanceof Error ? error.message : 'Failed to send OTP',
    };
  }
};

/**
 * Resend OTP to the same phone number
 * 
 * This is a specialized version of sendOTP for resending verification codes.
 * It includes the same rate limiting and development mode handling as sendOTP.
 * 
 * @param phone - Phone number to resend OTP to (any format, will be normalized)
 * @returns Promise containing:
 *   - success: Whether OTP was sent successfully
 *   - isDev: Whether development mode was used
 *   - error: Error message if operation failed
 *   - retryAfter: Seconds to wait if rate limited
 * 
 * @example
 * ```typescript
 * const result = await resendOTP('+1-555-123-4567')
 * if (result.success) {
 *   console.log('OTP resent successfully!')
 * } else if (result.retryAfter) {
 *   console.log(`Rate limited. Wait ${result.retryAfter} seconds.`)
 * }
 * ```
 */
export const resendOTP = async (
  phone: string,
): Promise<{
  success: boolean;
  isDev: boolean;
  error?: string;
  retryAfter?: number;
}> => {
  try {
    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone);

    logger.auth('Resending OTP to phone', {
      originalPhone: phone,
      normalizedPhone,
    });

    // Check rate limiting first and return specific error info
    const rateLimitCheck = checkOTPRateLimit(normalizedPhone);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        isDev: false,
        error: rateLimitCheck.error,
        retryAfter: rateLimitCheck.retryAfter,
      };
    }

    // Use the existing sendOTP function for the actual sending
    const result = await sendOTP(phone);
    
    // Add retryAfter info if needed for consistency
    return {
      ...result,
      retryAfter: undefined, // No retry needed on success
    };
  } catch (error) {
    logger.authError('OTP resend error', error);
    return {
      success: false,
      isDev: false,
      error: error instanceof Error ? error.message : 'Failed to resend OTP',
    };
  }
};

/**
 * Enhanced OTP error types for better UI handling
 */
export enum OTPErrorType {
  EXPIRED = 'expired',
  INVALID = 'invalid', 
  NETWORK = 'network',
  RATE_LIMITED = 'rate_limited',
  PHONE_ALREADY_USED = 'phone_already_used',
  GENERAL = 'general'
}

export interface EnhancedOTPError {
  type: OTPErrorType;
  message: string;
  retryAfter?: number;
  shouldClearInput?: boolean;
}

/**
 * Maps Supabase auth errors to our enhanced error types
 */
const mapSupabaseAuthError = (error: any): EnhancedOTPError => {
  const errorMessage = error?.message?.toLowerCase() || '';
  
  // Check for specific Supabase auth error patterns
  if (errorMessage.includes('expired') || errorMessage.includes('token expired')) {
    return {
      type: OTPErrorType.EXPIRED,
      message: 'Verification code has expired. Please request a new one.',
      shouldClearInput: true
    };
  }
  
  if (errorMessage.includes('invalid') || errorMessage.includes('wrong') || 
      errorMessage.includes('incorrect') || error.status === 401) {
    return {
      type: OTPErrorType.INVALID,
      message: 'Invalid verification code. Please check and try again.',
      shouldClearInput: true
    };
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return {
      type: OTPErrorType.RATE_LIMITED,
      message: 'Too many attempts. Please wait before trying again.',
      retryAfter: 60
    };
  }
  
  if (errorMessage.includes('phone') && errorMessage.includes('already')) {
    return {
      type: OTPErrorType.PHONE_ALREADY_USED,
      message: 'This phone number is already registered. Try signing in instead.'
    };
  }
  
  // Network/connection errors
  if (error.name === 'TypeError' || errorMessage.includes('network') || 
      errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return {
      type: OTPErrorType.NETWORK,
      message: 'Connection error. Please check your internet and try again.'
    };
  }
  
  // Default fallback
  return {
    type: OTPErrorType.GENERAL,
    message: error?.message || 'Verification failed. Please try again.',
    shouldClearInput: false
  };
};

/**
 * Verifies an OTP code sent to a phone number
 * 
 * Enhanced version with comprehensive error handling for better UX.
 * Handles expired codes, invalid OTP, network failures, and rate limiting.
 * 
 * @param phone - The phone number (any format, will be normalized to E.164)
 * @param token - The 6-digit OTP code entered by the user
 * @returns Promise resolving to authentication result with enhanced error info
 * 
 * @example
 * ```typescript
 * const result = await verifyOTP('+15551234567', '123456')
 * if (!result.success) {
 *   if (result.enhancedError?.shouldClearInput) {
 *     // Clear the OTP input and show error
 *   }
 *   console.log(result.enhancedError?.type) // 'expired', 'invalid', etc.
 * }
 * ```
 * 
 * @see {@link sendOTP} for sending the OTP first
 * @see {@link clearOTPRateLimit} for rate limit clearing behavior
 */
export const verifyOTP = async (
  phone: string,
  token: string,
): Promise<{
  success: boolean;
  isNewUser: boolean;
  userId?: string;
  error?: string;
  enhancedError?: EnhancedOTPError;
}> => {
  try {
    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone);

    // Validate normalized phone number
    if (!normalizedPhone || normalizedPhone.length < 12) {
      const enhancedError: EnhancedOTPError = {
        type: OTPErrorType.INVALID,
        message: 'Invalid phone number format. Please try again.',
        shouldClearInput: false
      };
      
      return {
        success: false,
        isNewUser: false,
        error: enhancedError.message,
        enhancedError
      };
    }

    logger.auth('Verifying OTP for phone', { 
      normalizedPhone, 
      tokenLength: token?.length,
      timestamp: new Date().toISOString()
    });

    // Validate input parameters
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      const enhancedError: EnhancedOTPError = {
        type: OTPErrorType.INVALID,
        message: 'Please enter a valid 6-digit code.',
        shouldClearInput: true
      };
      
      logger.authError('Invalid OTP format', { tokenLength: token?.length });
      return {
        success: false,
        isNewUser: false,
        error: enhancedError.message,
        enhancedError
      };
    }

    // Development phones should not reach this function - they authenticate directly in sendOTP
    if (isDevPhone(normalizedPhone)) {
      logger.authError(
        'Dev phone should not reach verifyOTP - authentication handled in sendOTP',
      );
      return {
        success: false,
        isNewUser: false,
        error: 'Development authentication error - please try again',
        enhancedError: {
          type: OTPErrorType.GENERAL,
          message: 'Development authentication error - please try again'
        }
      };
    }

    // Add timeout for the verification request
    const verificationPromise = supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: 'sms',
    });

    // 10-second timeout for OTP verification
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000);
    });

    const { data: authData, error: otpError } = await Promise.race([
      verificationPromise,
      timeoutPromise
    ]) as any;

    if (otpError) {
      const enhancedError = mapSupabaseAuthError(otpError);
      
      logger.authError('OTP verification failed', { 
        error: otpError,
        errorType: enhancedError.type,
        phone: normalizedPhone.slice(-4) // Log only last 4 digits
      });
      
      return {
        success: false,
        isNewUser: false,
        error: enhancedError.message,
        enhancedError
      };
    }

    if (!authData?.user) {
      const enhancedError: EnhancedOTPError = {
        type: OTPErrorType.GENERAL,
        message: 'Authentication failed. Please try again.'
      };
      
      logger.authError('No user data returned from OTP verification');
      return {
        success: false,
        isNewUser: false,
        error: enhancedError.message,
        enhancedError
      };
    }

    logger.auth('OTP verified successfully', { 
      userId: authData.user.id,
      timestamp: new Date().toISOString()
    });

    // Clear rate limiting on successful verification
    clearOTPRateLimit(normalizedPhone);

    // Handle user profile creation/lookup
    const result = await handleUserCreation(normalizedPhone, authData.user.id);

    if (!result.success) {
      // Enhanced error logging for failed user creation
      logger.authError('User creation/lookup failed after successful OTP verification', {
        error: result.error,
        userId: authData.user.id,
        phone: normalizedPhone.slice(-4),
        isNewUser: result.isNewUser,
      });

      // Return more user-friendly error messages
      let userFriendlyError = result.error || 'Failed to complete registration';
      if (result.error?.includes('Database error')) {
        userFriendlyError = 'There was a problem setting up your account. Please try again.';
      } else if (result.error?.includes('Permission denied')) {
        userFriendlyError = 'Account setup failed. Please contact support if this continues.';
      }

      return {
        success: false,
        isNewUser: result.isNewUser,
        error: userFriendlyError,
        enhancedError: {
          type: OTPErrorType.GENERAL,
          message: userFriendlyError
        }
      };
    }

    logger.auth('User creation/lookup completed successfully', {
      userId: result.userId,
      isNewUser: result.isNewUser,
      phone: normalizedPhone.slice(-4),
    });

    // Add isNewUser flag to the response
    return {
      ...result,
      isNewUser: result.isNewUser,
    };
  } catch (error) {
    const enhancedError = mapSupabaseAuthError(error);
    
    logger.authError('OTP verification error', { 
      error,
      errorType: enhancedError.type,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      isNewUser: false,
      error: enhancedError.message,
      enhancedError
    };
  }
};

/**
 * Handle user creation and setup completion check
 * 
 * Implements the 3-case authentication flow:
 * CASE 1: Phone exists + setup complete → Direct to dashboard
 * CASE 2: Phone exists + setup incomplete → Redirect to /setup
 * CASE 3: Phone doesn't exist → Trigger creates user + redirect to /setup
 * 
 * @private
 * @param normalizedPhone - Phone number in E.164 format
 * @param userId - The authenticated user ID from Supabase Auth
 * @returns Promise resolving to authentication result
 */
const handleUserCreation = async (
  normalizedPhone: string,
  userId: string,
): Promise<{
  success: boolean;
  isNewUser: boolean;
  userId?: string;
  error?: string;
}> => {
  try {
    logger.auth('Starting 3-case authentication flow', { 
      userId, 
      normalizedPhone: `${normalizedPhone.slice(0, 2)}***${normalizedPhone.slice(-4)}` 
    });

    // Look up user by phone number using secure function
    const { data: existingUsers, error: lookupError } = await supabase.rpc(
      'lookup_user_by_phone',
      { user_phone: normalizedPhone }
    );

    if (lookupError) {
      logger.authError('User lookup by phone failed', lookupError);
      return {
        success: false,
        isNewUser: false,
        error: 'Database error during user lookup',
      };
    }

    const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

    // CASE 1 & 2: Phone exists in system
    if (existingUser) {
      logger.auth('Found existing user by phone', {
        existingUserId: existingUser.id,
        sessionUserId: userId,
        hasFullName: !!existingUser.full_name,
        onboardingCompleted: existingUser.onboarding_completed,
      });

      // Update auth mapping if session ID is different (normal for phone OTP)
      if (existingUser.id !== userId) {
        logger.auth('Updating auth mapping for existing user', {
          oldUserId: existingUser.id,
          newUserId: userId,
        });

        try {
          await supabase.rpc('update_user_auth_id', {
            old_user_id: existingUser.id,
            new_user_id: userId,
            user_phone: normalizedPhone
          });
          logger.auth('Auth mapping updated successfully');
        } catch (updateError) {
          logger.authError('Auth mapping failed, but continuing', updateError);
          // Continue anyway - user can still authenticate
        }
      }

      // Check setup completion: either onboarding_completed flag OR valid full_name
      const hasCompletedSetup = existingUser.onboarding_completed || 
                               (existingUser.full_name && 
                                !existingUser.full_name.startsWith('User ') && 
                                existingUser.full_name.trim().length > 0);

      if (hasCompletedSetup) {
        // CASE 1: Phone exists + setup complete → Direct to dashboard
        logger.auth('CASE 1: Existing user with complete setup → dashboard', {
          userId,
          fullName: existingUser.full_name,
          onboardingCompleted: existingUser.onboarding_completed,
        });
        
        return {
          success: true,
          isNewUser: false, // Returning user, go to dashboard
          userId: userId,
        };
      } else {
        // CASE 2: Phone exists + setup incomplete → Redirect to /setup
        logger.auth('CASE 2: Existing user with incomplete setup → /setup', {
          userId,
          fullName: existingUser.full_name,
          onboardingCompleted: existingUser.onboarding_completed,
        });
        
        return {
          success: true,
          isNewUser: true, // Setup incomplete, go to /setup
          userId: userId,
        };
      }
    }

    // CASE 3: Phone doesn't exist → Database trigger creates user + redirect to /setup
    logger.auth('CASE 3: Phone not found, trigger will create user → /setup', { 
      userId, 
      normalizedPhone: `${normalizedPhone.slice(0, 2)}***${normalizedPhone.slice(-4)}` 
    });

    // Check for orphaned auth user first (exists in auth.users but not public.users)
    try {
      const { data: orphanedProfileResult, error: orphanedError } = await supabase.rpc(
        'create_profile_for_orphaned_auth_user',
        { auth_user_id: userId }
      );

      if (!orphanedError && orphanedProfileResult) {
        logger.auth('Created profile for orphaned auth user', {
          userId,
          phone: orphanedProfileResult.phone,
        });

        return {
          success: true,
          isNewUser: true, // Send to setup even if orphaned
          userId: userId,
        };
      }
    } catch (error) {
      logger.auth('Orphaned user check failed, trigger will handle creation', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    // For CASE 3, the database trigger should have already created the user profile
    // when signInWithOtp() created the auth.users record. Let's verify it exists.
    logger.auth('Verifying trigger created user profile', { userId });

    // Give the trigger a moment to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the user profile was created by the trigger
    const { data: newUserProfile, error: verifyError } = await supabase
      .from('users')
      .select('id, phone, full_name, onboarding_completed')
      .eq('id', userId)
      .single();

    if (verifyError || !newUserProfile) {
      logger.authError('Trigger failed to create user profile', verifyError);
      return {
        success: false,
        isNewUser: true,
        error: 'Failed to create user profile - please try again',
      };
    }

    logger.auth('CASE 3: Trigger created user successfully → /setup', { 
      userId: newUserProfile.id,
      phone: `${normalizedPhone.slice(0, 2)}***${normalizedPhone.slice(-4)}`,
    });

    return {
      success: true,
      isNewUser: true, // New user, go to /setup
      userId: userId,
    };

  } catch (error) {
    logger.authError('Unexpected error in handleUserCreation', error);
    return {
      success: false,
      isNewUser: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
};

/**
 * Gets the current user's profile from the users table
 * 
 * Retrieves the user profile data from the users table,
 * which includes safe public information about the authenticated user.
 * 
 * @returns Promise resolving to object with:
 *   - data: User profile data or null if not found
 *   - error: Error object if operation failed
 * 
 * @example
 * ```typescript
 * const { data: profile, error } = await getCurrentUserProfile()
 * if (profile) {
 *   console.log('User name:', profile.full_name)
 *   console.log('Phone:', profile.phone)
 * }
 * ```
 * 
 * @see {@link getCurrentUser} for Supabase Auth user data
 */
export const getCurrentUserProfile = async () => {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        data: null,
        error: authError || new Error('No authenticated user'),
      };
    }

    // Try to fetch user profile from users table, but handle RLS gracefully
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, phone, full_name, avatar_url, email, created_at, updated_at, onboarding_completed, intended_redirect')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.auth('User profile query failed', {
          error: profileError?.message || 'Unknown profile error',
          code: profileError?.code || 'PROFILE_QUERY_FAILED',
          userId: user.id,
        });

        // Check if this is a "user not found" error - indicates deleted/orphaned user
        if (profileError.code === 'PGRST116') {
          logger.auth('User profile not found - potential orphaned auth user', {
            userId: user.id,
            phone: user.phone || user.user_metadata?.phone,
          });

          // Try to create profile for orphaned auth user
          try {
            const { data: orphanedResult, error: orphanedError } = await supabase.rpc(
              'create_profile_for_orphaned_auth_user',
              { auth_user_id: user.id }
            );

            if (!orphanedError && orphanedResult) {
              logger.auth('Successfully created profile for orphaned auth user in getCurrentUserProfile', {
                userId: user.id,
                phone: orphanedResult.phone,
                fullName: orphanedResult.full_name,
              });

              // Return the newly created profile
              return { data: orphanedResult, error: null };
            } else {
              logger.authError('Failed to create profile for orphaned auth user', orphanedError);
            }
          } catch (orphanedError) {
            logger.authError('Error creating profile for orphaned auth user', orphanedError);
          }

          // If orphaned user creation failed, this is likely a stale session
          logger.auth('Orphaned user creation failed - likely stale session, signing out');
          await supabase.auth.signOut();
          
          return {
            data: null,
            error: new Error('STALE_SESSION'),
          };
        }
        
        // For other profile errors (RLS, etc.), create fallback profile
        logger.auth('User profile query blocked by RLS, using auth fallback', {
          error: profileError?.message || 'Unknown profile error',
          code: profileError?.code || 'PROFILE_QUERY_FAILED',
        });
        
        const fallbackProfile = {
          id: user.id,
          phone: user.user_metadata?.phone || user.phone || null,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || `User ${user.id.slice(-4)}`,
          avatar_url: user.user_metadata?.avatar_url || null,
          email: user.email || null,
          created_at: user.created_at,
          updated_at: user.updated_at || user.created_at,
          onboarding_completed: false, // Default for fallback
          intended_redirect: null,
        };

        return { data: fallbackProfile, error: null };
      }

      return { data: profile, error: null };
    } catch (rls_error) {
      // If there's an RLS error, fall back to auth user data
      logger.auth('RLS error accessing user profile, using auth fallback', {
        error: rls_error instanceof Error ? rls_error.message : String(rls_error),
        fallback: 'Using auth metadata',
      });
      
      const fallbackProfile = {
        id: user.id,
        phone: user.user_metadata?.phone || user.phone || null,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || `User ${user.id.slice(-4)}`,
        avatar_url: user.user_metadata?.avatar_url || null,
        email: user.email || null,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
        onboarding_completed: false, // Default for fallback
        intended_redirect: null,
      };

      return { data: fallbackProfile, error: null };
    }
  } catch (error) {
    logger.authError('Error fetching user profile', error);
    return { data: null, error };
  }
};

/**
 * Validates phone number format for authentication
 * 
 * Checks if the provided phone number meets minimum requirements:
 * - Must not be empty or null
 * - Must contain 10-11 digits (US format)
 * - Handles various input formats (with/without country code, formatting)
 * 
 * @param phone - Phone number to validate (any format)
 * @returns Object with:
 *   - isValid: Whether the phone number is valid
 *   - error: Descriptive error message if invalid
 * 
 * @example
 * ```typescript
 * const validation = validatePhoneNumber('(555) 123-4567')
 * if (!validation.isValid) {
 *   console.error(validation.error) // User-friendly error message
 * }
 * ```
 * 
 * @see {@link normalizePhoneNumber} for format normalization
 */
export const validatePhoneNumber = (
  phone: string,
): { isValid: boolean; error?: string } => {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits' };
  }

  if (digits.length > 11) {
    return { isValid: false, error: 'Phone number is too long' };
  }

  return { isValid: true };
};

// Helper function to get user by phone
/**
 * Retrieves a user by their phone number
 * 
 * Searches for a user in the database using their normalized phone number.
 * Used to check if a user exists before authentication flows.
 * 
 * @param phone - Phone number to search for (will be normalized)
 * @returns Promise resolving to Supabase query response with user data
 * 
 * @example
 * ```typescript
 * const { data: user, error } = await getUserByPhone('+15551234567')
 * if (user) {
 *   console.log('Existing user:', user.display_name)
 * } else if (!error) {
 *   console.log('New user - account will be created')
 * }
 * ```
 * 
 * @see {@link normalizePhoneNumber} for phone number formatting
 * @see {@link validatePhoneNumber} for input validation
 */
export const getUserByPhone = async (phone: string) => {
  try {
    return await supabase.from('users').select('*').eq('phone', phone).single();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PGRST116'
    ) {
      return { data: null, error: null }; // User not found is OK
    }
    handleAuthDatabaseError(error, 'SELECT', 'users');
  }
};

// Export rate limiting constants for monitoring
export const OTP_RATE_LIMITING = {
  MAX_ATTEMPTS: MAX_OTP_ATTEMPTS,
  WINDOW_MS: OTP_RATE_LIMIT_WINDOW,
  BLOCK_DURATION_MS: OTP_BLOCK_DURATION,
  MIN_RETRY_INTERVAL_MS: MIN_RETRY_INTERVAL,
  // Helper to get current rate limit status
  getRateLimitStatus: (phone: string) => otpRateLimits.get(phone) || null,
};

/**
 * Marks the current user's onboarding as completed
 * 
 * Updates the user's profile to indicate they have finished the setup process.
 * Should be called when user completes the /setup flow.
 * 
 * @returns Promise resolving to object with:
 *   - success: Whether update was successful
 *   - error: Error message if operation failed
 * 
 * @example
 * ```typescript
 * const { success, error } = await markOnboardingCompleted()
 * if (success) {
 *   router.push('/select-event')
 * }
 * ```
 */
export const markOnboardingCompleted = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'No authenticated user found' };
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        onboarding_completed: true,
        intended_redirect: null // Clear any intended redirect
      })
      .eq('id', user.id);

    if (updateError) {
      logger.authError('Failed to mark onboarding completed', updateError);
      return { success: false, error: 'Failed to update onboarding status' };
    }

    logger.auth('Onboarding marked as completed', { userId: user.id });
    return { success: true };
  } catch (error) {
    logger.authError('Error marking onboarding completed', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

/**
 * Sets an intended redirect URL for the user
 * 
 * Stores a URL that the user should be redirected to after authentication.
 * Useful for deep links and preserving user intent.
 * 
 * @param redirectUrl - The URL to redirect to after auth
 * @returns Promise resolving to object with:
 *   - success: Whether update was successful
 *   - error: Error message if operation failed
 * 
 * @example
 * ```typescript
 * // User clicks deep link to event while logged out
 * await setIntendedRedirect('/host/events/123/dashboard')
 * // After login, they'll be sent to that URL
 * ```
 */
export const setIntendedRedirect = async (redirectUrl: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'No authenticated user found' };
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ intended_redirect: redirectUrl })
      .eq('id', user.id);

    if (updateError) {
      logger.authError('Failed to set intended redirect', updateError);
      return { success: false, error: 'Failed to update intended redirect' };
    }

    logger.auth('Intended redirect set', { userId: user.id, redirectUrl });
    return { success: true };
  } catch (error) {
    logger.authError('Error setting intended redirect', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

/**
 * Clears the intended redirect URL for the user
 * 
 * Removes any stored redirect URL. Should be called after successfully
 * redirecting the user to their intended destination.
 * 
 * @returns Promise resolving to object with:
 *   - success: Whether update was successful
 *   - error: Error message if operation failed
 */
export const clearIntendedRedirect = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: 'No authenticated user found' };
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ intended_redirect: null })
      .eq('id', user.id);

    if (updateError) {
      logger.authError('Failed to clear intended redirect', updateError);
      return { success: false, error: 'Failed to clear intended redirect' };
    }

    logger.auth('Intended redirect cleared', { userId: user.id });
    return { success: true };
  } catch (error) {
    logger.authError('Error clearing intended redirect', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};
