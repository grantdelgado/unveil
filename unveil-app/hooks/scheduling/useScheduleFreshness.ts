'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MIN_SCHEDULE_BUFFER_MINUTES, roundUpToMinute, addMinutes } from '@/lib/constants/scheduling';

interface UseScheduleFreshnessOptions {
  scheduledAtUtc: Date;
  minBufferMinutes?: number;
  onExpire?: () => void;
}

interface ScheduleFreshnessResult {
  isTooSoon: boolean;
  remainingSeconds: number;
}

/**
 * Hook that continuously monitors if a scheduled time is still valid (≥ now + minBuffer).
 * Updates every 5 seconds and on visibility/focus changes to catch time drift.
 * 
 * @param scheduledAtUtc - The scheduled time in UTC
 * @param minBufferMinutes - Minimum buffer in minutes (defaults to MIN_SCHEDULE_BUFFER_MINUTES)
 * @param onExpire - Callback fired once when the schedule first becomes too soon
 * @returns Object with isTooSoon flag and remainingSeconds until expiry
 */
export function useScheduleFreshness({
  scheduledAtUtc,
  minBufferMinutes = MIN_SCHEDULE_BUFFER_MINUTES,
  onExpire,
}: UseScheduleFreshnessOptions): ScheduleFreshnessResult {
  const [nowUtc, setNowUtc] = useState(() => new Date());
  const hasExpiredRef = useRef(false);

  // Update current time
  const updateNow = useCallback(() => {
    setNowUtc(new Date());
  }, []);

  // Set up interval and event listeners for time updates
  useEffect(() => {
    // Update every 5 seconds
    const intervalId = setInterval(updateNow, 5000);

    // Update when tab regains focus or becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
      }
    };

    const handleFocus = () => {
      updateNow();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [updateNow]);

  // Calculate freshness state
  const result = useMemo(() => {
    // Round nowUtc up to next full minute to avoid flapping as seconds tick
    const roundedNow = roundUpToMinute(nowUtc);
    
    // Calculate minimum valid time (now + buffer)
    const minValidUtc = addMinutes(roundedNow, minBufferMinutes);
    
    // Check if scheduled time is too soon
    const isTooSoon = scheduledAtUtc < minValidUtc;
    
    // Calculate remaining seconds until expiry (can be negative if already expired)
    const remainingMs = scheduledAtUtc.getTime() - minValidUtc.getTime();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    return {
      isTooSoon,
      remainingSeconds,
    };
  }, [nowUtc, scheduledAtUtc, minBufferMinutes]);

  // Fire onExpire callback once when state first flips to true
  useEffect(() => {
    if (result.isTooSoon && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire?.();
    } else if (!result.isTooSoon) {
      // Reset flag if schedule becomes valid again (e.g., user updates time)
      hasExpiredRef.current = false;
    }
  }, [result.isTooSoon, onExpire]);

  return result;
}
