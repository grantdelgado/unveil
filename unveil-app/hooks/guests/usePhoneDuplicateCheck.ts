import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { normalizePhoneNumberSimple as normalizePhoneNumber } from '@/lib/utils/phone';

export interface PhoneDuplicateCheckResult {
  isDuplicate: boolean;
  isChecking: boolean;
  error: string | null;
}

/**
 * Hook for checking if a phone number already exists for an event
 * Uses the new RPC function that respects soft-delete (removed_at IS NULL)
 */
export function usePhoneDuplicateCheck(eventId: string) {
  const [checkingPhones, setCheckingPhones] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const checkPhoneDuplicate = useCallback(
    async (phone: string): Promise<PhoneDuplicateCheckResult> => {
      if (!phone.trim()) {
        return { isDuplicate: false, isChecking: false, error: null };
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      const cacheKey = `${eventId}:${normalizedPhone}`;

      // Set checking state
      setCheckingPhones((prev) => new Set(prev).add(cacheKey));
      setErrors((prev) => {
        const newErrors = new Map(prev);
        newErrors.delete(cacheKey);
        return newErrors;
      });

      try {
        const { data: isDuplicate, error } = await supabase.rpc(
          'check_phone_exists_for_event',
          {
            p_event_id: eventId,
            p_phone: normalizedPhone,
          },
        );

        if (error) {
          const errorMsg = `Failed to check for duplicates: ${error.message}`;
          setErrors((prev) => new Map(prev).set(cacheKey, errorMsg));
          return { isDuplicate: false, isChecking: false, error: errorMsg };
        }

        return {
          isDuplicate: !!isDuplicate,
          isChecking: false,
          error: null,
        };
      } catch (err) {
        const errorMsg = `Error checking phone: ${err instanceof Error ? err.message : 'Unknown error'}`;
        setErrors((prev) => new Map(prev).set(cacheKey, errorMsg));
        return { isDuplicate: false, isChecking: false, error: errorMsg };
      } finally {
        // Remove from checking state
        setCheckingPhones((prev) => {
          const newSet = new Set(prev);
          newSet.delete(cacheKey);
          return newSet;
        });
      }
    },
    [eventId],
  );

  const isChecking = useCallback(
    (phone: string): boolean => {
      const normalizedPhone = normalizePhoneNumber(phone);
      const cacheKey = `${eventId}:${normalizedPhone}`;
      return checkingPhones.has(cacheKey);
    },
    [eventId, checkingPhones],
  );

  const getError = useCallback(
    (phone: string): string | null => {
      const normalizedPhone = normalizePhoneNumber(phone);
      const cacheKey = `${eventId}:${normalizedPhone}`;
      return errors.get(cacheKey) || null;
    },
    [eventId, errors],
  );

  return {
    checkPhoneDuplicate,
    isChecking,
    getError,
  };
}
