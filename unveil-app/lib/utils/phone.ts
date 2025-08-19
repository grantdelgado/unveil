/**
 * Phone number utilities for consistent E.164 normalization
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Normalize phone number to E.164 format for consistent matching
 * Supports US and international numbers
 */
export function normalizePhoneNumber(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle different input formats
  let normalized: string;
  
  if (digitsOnly.length === 10) {
    // US number without country code (e.g., "5712364686")
    normalized = `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code but no + (e.g., "15712364686")
    normalized = `+${digitsOnly}`;
  } else if (phone.startsWith('+')) {
    // Already has + prefix, just clean it
    normalized = `+${digitsOnly}`;
  } else {
    // International number without + prefix
    normalized = `+${digitsOnly}`;
  }

  // Basic E.164 validation: + followed by 1-15 digits, starting with non-zero
  const e164Pattern = /^\+[1-9]\d{1,14}$/;
  
  if (!e164Pattern.test(normalized)) {
    return { 
      isValid: false, 
      error: 'Invalid phone number format. Please use international format (+1234567890)' 
    };
  }

  return { isValid: true, normalized };
}

/**
 * Simple phone normalization that returns just the normalized string
 * For backward compatibility with existing code
 */
export function normalizePhoneNumberSimple(phone: string): string {
  const result = normalizePhoneNumber(phone);
  return result.isValid ? result.normalized! : phone;
}

/**
 * Format phone number for display (US format)
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized.isValid || !normalized.normalized) {
    return phone;
  }

  // Format US numbers as (XXX) XXX-XXXX
  if (normalized.normalized.startsWith('+1') && normalized.normalized.length === 12) {
    const digits = normalized.normalized.slice(2); // Remove +1
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // For international numbers, just return the normalized version
  return normalized.normalized;
}

/**
 * Mask phone number for logging (show only first 6 characters)
 */
export function maskPhoneForLogging(phone: string): string {
  if (!phone || phone.length <= 6) {
    return phone;
  }
  return phone.slice(0, 6) + '...';
}
