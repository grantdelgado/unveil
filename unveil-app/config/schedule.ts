/**
 * Scheduling Configuration
 * 
 * Controls minimum lead time requirements for scheduled messages.
 * Used by both client (UI hints) and server (enforcement).
 */

/**
 * Minimum lead time in seconds before a message can be scheduled.
 * 
 * Default: 180 seconds (3 minutes)
 * 
 * Rationale:
 * - Cron runs every 60s with ~10-60s processing latency
 * - 180s provides 3x safety margin above cron frequency
 * - Prevents scheduling too close to processing boundaries
 * - Accounts for timezone conversion and validation overhead
 */
const SCHEDULE_MIN_LEAD_SECONDS = parseInt(
  process.env.SCHEDULE_MIN_LEAD_SECONDS || '180',
  10
);

/**
 * Get the minimum lead time in seconds for scheduled messages.
 * 
 * @returns {number} Minimum seconds between now and earliest valid schedule time
 */
export function getScheduleMinLeadSeconds(): number {
  return SCHEDULE_MIN_LEAD_SECONDS;
}

/**
 * Get the minimum lead time in milliseconds for scheduled messages.
 * 
 * @returns {number} Minimum milliseconds between now and earliest valid schedule time
 */
export function getScheduleMinLeadMs(): number {
  return SCHEDULE_MIN_LEAD_SECONDS * 1000;
}

/**
 * Check if a given UTC timestamp meets the minimum lead time requirement.
 * 
 * @param scheduledAtUtc - UTC timestamp string (ISO format)
 * @param nowUtc - Current UTC timestamp (defaults to Date.now())
 * @returns {boolean} True if the scheduled time meets minimum lead requirement
 */
export function isValidScheduleTime(
  scheduledAtUtc: string,
  nowUtc: Date = new Date()
): boolean {
  const scheduledTime = new Date(scheduledAtUtc);
  const minValidTime = new Date(nowUtc.getTime() + getScheduleMinLeadMs());
  
  return scheduledTime >= minValidTime;
}

/**
 * Get the next valid schedule time (now + minimum lead time).
 * 
 * @param nowUtc - Current UTC timestamp (defaults to Date.now())
 * @returns {Date} Earliest valid schedule time
 */
export function getNextValidScheduleTime(nowUtc: Date = new Date()): Date {
  return new Date(nowUtc.getTime() + getScheduleMinLeadMs());
}

/**
 * Format the minimum lead time as a human-readable string.
 * 
 * @returns {string} Human-readable lead time (e.g., "3 minutes")
 */
export function formatMinLeadTime(): string {
  const seconds = getScheduleMinLeadSeconds();
  
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}
