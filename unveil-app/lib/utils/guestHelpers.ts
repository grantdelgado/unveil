import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { normalizePhoneNumber } from './validation';

/**
 * Cache for duplicate checks to avoid unnecessary Supabase hits
 */
const duplicateCheckCache = new Map<string, CachedResult>();
const CACHE_TTL = 30000; // 30 seconds

interface CachedResult {
  exists: boolean;
  timestamp: number;
}

/**
 * Check if a guest with the given phone number already exists for the event
 */
export async function checkGuestExists(eventId: string, phone: string): Promise<boolean> {
  if (!phone.trim()) return false;

  const normalizedPhone = normalizePhoneNumber(phone);
  const cacheKey = `${eventId}:${normalizedPhone}`;
  
  // Check cache first
  const cached = duplicateCheckCache.get(cacheKey) as CachedResult | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.exists;
  }

  try {
    const { data, error } = await supabase
      .from('event_guests')
      .select('id')
      .eq('event_id', eventId)
      .eq('phone', normalizedPhone)
      .limit(1);

    if (error) {
      logger.error('Error checking guest existence', error);
      return false; // On error, assume no duplicate to avoid blocking
    }

    const exists = (data?.length || 0) > 0;
    
    // Cache the result
    duplicateCheckCache.set(cacheKey, {
      exists,
      timestamp: Date.now()
    });

    return exists;
  } catch (error) {
    logger.error('Unexpected error checking guest existence', error);
    return false;
  }
}

/**
 * Clear the duplicate check cache for an event (call after successful import)
 */
export function clearGuestExistsCache(eventId: string): void {
  const keysToDelete = Array.from(duplicateCheckCache.keys()).filter(key => 
    key.startsWith(`${eventId}:`)
  );
  
  keysToDelete.forEach(key => duplicateCheckCache.delete(key));
}

/**
 * Validate guest field and return validation state
 */
export interface FieldValidation {
  isValid: boolean;
  error?: string;
  warning?: string;
  success?: string;
}

export function validateGuestField(
  field: 'guest_name' | 'phone' | 'guest_email',
  value: string
): FieldValidation {
  const trimmed = value.trim();

  switch (field) {
    case 'guest_name':
      if (!trimmed) {
        return { isValid: false, error: 'Guest name is required' };
      }
      if (trimmed.length < 2) {
        return { isValid: false, error: 'Name must be at least 2 characters' };
      }
      if (trimmed.length > 100) {
        return { isValid: false, error: 'Name must be less than 100 characters' };
      }
      return { isValid: true, success: '✓ Valid name' };

    case 'phone':
      if (!trimmed) {
        return { isValid: false, error: 'Phone number is required' };
      }
      
      const digitsOnly = trimmed.replace(/\D/g, '');
      
      if (digitsOnly.length < 10) {
        return { 
          isValid: false, 
          error: `Phone must be 10 digits (${digitsOnly.length}/10)` 
        };
      }
      
      if (digitsOnly.length > 11) {
        return { isValid: false, error: 'Phone number is too long' };
      }
      
      const isValid = digitsOnly.length === 10 || 
        (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
      
      if (!isValid) {
        return { isValid: false, error: 'Please enter a valid phone number' };
      }

      return { isValid: true, success: '✓ Valid phone number' };

    case 'guest_email':
      if (!trimmed) {
        return { isValid: true }; // Email is optional
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return { isValid: false, error: 'Please enter a valid email address' };
      }
      
      return { isValid: true, success: '✓ Valid email' };

    default:
      return { isValid: true };
  }
}