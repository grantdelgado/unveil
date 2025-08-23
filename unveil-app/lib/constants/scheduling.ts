/**
 * Scheduling Constants
 * 
 * Single source of truth for all scheduling-related time buffers.
 */

/**
 * Minimum buffer for validation (client + server + database).
 * Messages cannot be scheduled less than this many minutes from now.
 * 
 * Used for:
 * - Client-side validation (real-time guard)
 * - Server-side validation (API rejection)
 * - Database trigger enforcement
 */
export const MIN_SCHEDULE_BUFFER_MINUTES = 3;

/**
 * Buffer for quick action "Use X minutes from now" button.
 * Provides a comfortable margin above the minimum validation buffer.
 * 
 * Used for:
 * - Quick action button in validation helper
 * - User-friendly default when fixing invalid times
 */
export const QUICK_SET_BUFFER_MINUTES = 5;

/**
 * Convert minutes to milliseconds for Date calculations.
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * Round a Date up to the next full minute to avoid flapping as seconds tick.
 */
export function roundUpToMinute(date: Date): Date {
  const rounded = new Date(date);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1);
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
  }
  return rounded;
}

/**
 * Add minutes to a Date and optionally round up to the next minute.
 */
export function addMinutes(date: Date, minutes: number, roundUp: boolean = false): Date {
  const result = new Date(date.getTime() + minutesToMs(minutes));
  return roundUp ? roundUpToMinute(result) : result;
}
