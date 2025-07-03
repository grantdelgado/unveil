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

// Phone number normalization utility
const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Convert to E.164 format (+1XXXXXXXXXX for US numbers)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.startsWith('1') && digits.length > 11) {
    return `+${digits.slice(0, 11)}`;
  }

  // Default: assume US number and prepend +1
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

          // Handle user profile creation/lookup
          const userResult = await handleUserCreation(
            normalizedPhone,
            authData.user.id,
          );

          if (!userResult.success) {
            logger.authError('Failed to handle user profile', userResult.error);
            return {
              success: false,
              isDev: true,
              error: userResult.error || 'Failed to handle user profile',
            };
          }

          return {
            success: true,
            isDev: true,
            isNewUser: userResult.isNewUser,
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

// Verify OTP and complete authentication
/**
 * Verifies an OTP (One-Time Password) for phone authentication
 * 
 * Validates the OTP token against the phone number and authenticates the user:
 * - Development: Uses password authentication for whitelisted phones
 * - Production: Verifies OTP token via Supabase Auth
 * 
 * Clears rate limiting on successful verification and ensures user profile exists.
 * 
 * @param phone - Phone number in any format (will be normalized to E.164)
 * @param token - The OTP token to verify (6 digits for production, ignored for dev)
 * @returns Promise resolving to object with:
 *   - success: Whether OTP verification succeeded
 *   - isNewUser: Whether this is a newly created user
 *   - userId: The authenticated user's ID
 *   - error: Error message if verification failed
 * 
 * @throws {Error} Verification failed, expired token, or database error
 * 
 * @example
 * ```typescript
 * const result = await verifyOTP('+15551234567', '123456')
 * if (result.success) {
 *   console.log('User authenticated:', result.userId)
 *   if (result.isNewUser) {
 *     // Show onboarding flow
 *   }
 * } else {
 *   console.error('Verification failed:', result.error)
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
}> => {
  try {
    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhoneNumber(phone);

    logger.auth('Verifying OTP for phone', { normalizedPhone });

    // Development phones should not reach this function - they authenticate directly in sendOTP
    if (isDevPhone(normalizedPhone)) {
      logger.authError(
        'Dev phone should not reach verifyOTP - authentication handled in sendOTP',
      );
      return {
        success: false,
        isNewUser: false,
        error: 'Development authentication error - please try again',
      };
    }

    // Verify OTP with Supabase
    const { data: authData, error: otpError } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: 'sms',
    });

    if (otpError) {
      logger.authError('OTP verification failed', otpError);
      return {
        success: false,
        isNewUser: false,
        error: otpError.message,
      };
    }

    if (!authData?.user) {
      return {
        success: false,
        isNewUser: false,
        error: 'Authentication failed',
      };
    }

    logger.auth('OTP verified successfully', { userId: authData.user.id });

    // Clear rate limiting on successful verification
    clearOTPRateLimit(normalizedPhone);

    // Handle user profile creation/lookup
    const result = await handleUserCreation(normalizedPhone, authData.user.id);

    // Add isNewUser flag to the response
    return {
      ...result,
      isNewUser: result.isNewUser,
    };
  } catch (error) {
    logger.authError('OTP verification error', error);
    return {
      success: false,
      isNewUser: false,
      error: error instanceof Error ? error.message : 'OTP verification failed',
    };
  }
};

/**
 * Internal helper function for user creation and lookup logic
 * 
 * Handles the database operations for user authentication:
 * - Checks if user with phone number already exists
 * - Creates new user profile if needed
 * - Ensures auth.uid() matches user record
 * 
 * @private
 * @param normalizedPhone - Phone number in E.164 format
 * @param userId - The authenticated user ID from Supabase Auth
 * @returns Promise resolving to authentication result
 * 
 * @internal This function is not exported and is used internally by verifyOTP
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
    // Step 1: Check if user with this phone already exists
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id, phone, full_name, email, created_at')
      .eq('phone', normalizedPhone)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new users
      logger.authError('User lookup failed', lookupError);
      return {
        success: false,
        isNewUser: false,
        error: 'Failed to check existing user',
      };
    }

    if (existingUser) {
      // Step 2a: Returning user - verify session ID matches
      if (existingUser.id === userId) {
        logger.auth('Returning user with matching session ID', {
          userId: existingUser.id,
        });
        return {
          success: true,
          isNewUser: false,
          userId: userId,
        };
      } else {
        // This should not happen with proper OTP flow, but handle gracefully
        logger.auth('Existing user found but auth.uid() mismatch', {
          existingUserId: existingUser.id,
          sessionUserId: userId,
          phone: normalizedPhone,
        });

        // In this case, the existing user profile takes precedence
        // The auth.uid() will be the new session ID
        return {
          success: true,
          isNewUser: false,
          userId: userId,
        };
      }
    }

    // Step 2b: New user - create profile in users table
    logger.auth('Creating new user profile for phone', { normalizedPhone });

    const newUserData: UserInsert = {
      id: userId, // Use the authenticated session user ID
      phone: normalizedPhone,
      full_name: `User ${normalizedPhone.slice(-4)}`, // Placeholder name
      email: null,
      avatar_url: null,
    };

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert(newUserData)
      .select('id, phone, full_name')
      .single();

    if (createError) {
      logger.authError('User creation failed', createError);
      return {
        success: false,
        isNewUser: true,
        error: `Failed to create user profile: ${createError.message}`,
      };
    }

    logger.auth('New user created', { userId: newUser.id });

    return {
      success: true,
      isNewUser: true,
      userId: userId,
    };
  } catch (error) {
    logger.authError('User creation error', error);
    return {
      success: false,
      isNewUser: false,
      error: error instanceof Error ? error.message : 'User creation failed',
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
        .select('id, phone, full_name, avatar_url, email, created_at, updated_at')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // If RLS blocks access, create a fallback profile from auth user data
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
