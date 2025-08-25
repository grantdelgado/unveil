/**
 * Event Reminder Templates
 * 
 * Utilities for formatting and managing event reminder content
 */

import { formatScheduledDateTime } from '@/lib/utils/timezone';

export interface ReminderContentParams {
  subEventTitle: string;
  eventLocalStart: string;   // "Thu, Aug 21, 3:00 PM MDT"
  linkUrl: string;
}

/**
 * Builds event reminder content for SMS delivery
 * Targets single SMS segment (~160 characters)
 */
export function buildEventReminderContent(params: ReminderContentParams): string {
  return `Reminder: ${params.subEventTitle} starts at ${params.eventLocalStart}. Details: ${params.linkUrl}
Reply STOP to opt out.`;
}

/**
 * Formats reminder send time for display
 */
export function formatReminderTime(
  utcDateTime: string,
  eventTimeZone: string
): string | null {
  return formatScheduledDateTime(utcDateTime, eventTimeZone);
}

/**
 * Calculates if a reminder can be scheduled for a given start time
 */
export function canScheduleReminder(
  startAtUtc: string,
  bufferMinutes: number = 4
): boolean {
  const startTime = new Date(startAtUtc);
  const reminderTime = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour before
  const minAllowed = new Date(Date.now() + bufferMinutes * 60 * 1000);
  
  return reminderTime > minAllowed;
}

/**
 * Gets the reminder send time (1 hour before start)
 */
export function getReminderSendTime(startAtUtc: string): string {
  const startTime = new Date(startAtUtc);
  const reminderTime = new Date(startTime.getTime() - 60 * 60 * 1000);
  return reminderTime.toISOString();
}

/**
 * Validates reminder content length for SMS delivery
 */
export function validateReminderContent(content: string): {
  isValid: boolean;
  length: number;
  segments: number;
  warnings: string[];
} {
  const length = content.length;
  const segments = Math.ceil(length / 160);
  const warnings: string[] = [];
  
  if (length > 160) {
    warnings.push(`Content is ${length} characters (${segments} SMS segments)`);
  }
  
  if (length > 320) {
    warnings.push('Content may be truncated by some carriers');
  }
  
  return {
    isValid: length > 0 && length <= 1000,
    length,
    segments,
    warnings,
  };
}
