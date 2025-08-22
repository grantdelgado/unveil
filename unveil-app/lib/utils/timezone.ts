/**
 * Event Timezone Utilities
 *
 * Handles conversion between event timezone and UTC for consistent schedule rendering.
 * All schedule times are anchored to the event's venue timezone.
 */

export interface EventTimeZoneInfo {
  /** IANA timezone identifier (e.g., "America/Los_Angeles") */
  timeZone: string;
  /** Short timezone abbreviation (e.g., "PST", "PDT") */
  abbreviation: string;
  /** Full timezone name (e.g., "Pacific Standard Time") */
  displayName: string;
}

/**
 * Validates if a string is a valid IANA timezone identifier
 */
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone) return false;

  try {
    // Test with a known date to ensure the timezone is valid
    Intl.DateTimeFormat('en', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets timezone information for display
 */
export function getTimezoneInfo(
  timeZone: string,
  date: Date = new Date(),
): EventTimeZoneInfo | null {
  if (!isValidTimezone(timeZone)) {
    return null;
  }

  try {
    // Get timezone abbreviation (e.g., PST, PDT)
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const abbreviation =
      parts.find((part) => part.type === 'timeZoneName')?.value || '';

    // Get full timezone name
    const longFormatter = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'long',
    });

    const longParts = longFormatter.formatToParts(date);
    const displayName =
      longParts.find((part) => part.type === 'timeZoneName')?.value || timeZone;

    return {
      timeZone,
      abbreviation,
      displayName,
    };
  } catch {
    return null;
  }
}

/**
 * Converts local date and time components to UTC timestamp for storage
 *
 * @param localDate - Date string in YYYY-MM-DD format (event timezone)
 * @param localTime - Time string in HH:MM format (event timezone)
 * @param eventTimeZone - IANA timezone identifier for the event
 * @returns UTC timestamp string for database storage
 */
export function toUTCFromEventZone(
  localDate: string,
  localTime: string,
  eventTimeZone: string,
): string | null {
  if (!localDate || !localTime || !isValidTimezone(eventTimeZone)) {
    return null;
  }

  try {
    // Create a date string in the event timezone
    const localDateTime = `${localDate}T${localTime}:00`;

    // Parse the date as if it's in the event timezone
    const tempDate = new Date(localDateTime);

    // Get the timezone offset for the event timezone at this date
    const eventFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: eventTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Format the temp date in the event timezone to get what time it would be there
    const eventTimeString = eventFormatter.format(tempDate);
    const [eventDatePart, eventTimePart] = eventTimeString.split(', ');

    // Calculate the difference and adjust
    const expectedEventTime = `${localDate} ${localTime}:00`;
    const actualEventTime = `${eventDatePart} ${eventTimePart}`;

    if (expectedEventTime === actualEventTime) {
      // No timezone adjustment needed
      return tempDate.toISOString();
    }

    // Use a more precise method: create date in UTC then adjust for timezone offset
    const [year, month, day] = localDate.split('-').map(Number);
    const [hour, minute] = localTime.split(':').map(Number);

    // Create date in UTC first
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

    // Calculate offset and adjust

    // Calculate offset and adjust
    const eventDate = new Date(
      utcDate.toLocaleString('en-US', { timeZone: eventTimeZone }),
    );
    const localEquivalent = new Date(
      utcDate.toLocaleString('en-US', { timeZone: 'UTC' }),
    );
    const offset = eventDate.getTime() - localEquivalent.getTime();

    const correctedUTC = new Date(utcDate.getTime() - offset);

    return correctedUTC.toISOString();
  } catch (error) {
    console.warn('Failed to convert event time to UTC:', {
      localDate,
      localTime,
      eventTimeZone,
      error,
    });
    return null;
  }
}

/**
 * Converts UTC timestamp to local time in event timezone for display
 *
 * @param utcDateTime - UTC timestamp string from database
 * @param eventTimeZone - IANA timezone identifier for the event
 * @returns Formatted time string in event timezone
 */
export function fromUTCToEventZone(
  utcDateTime: string,
  eventTimeZone: string,
): { date: string; time: string; formatted: string } | null {
  if (!utcDateTime || !isValidTimezone(eventTimeZone)) {
    return null;
  }

  try {
    const utcDate = new Date(utcDateTime);

    // Format in event timezone
    const eventFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: eventTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: eventTimeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const eventTimeString = eventFormatter.format(utcDate);
    const [datePart, timePart] = eventTimeString.split(', ');
    const formattedTime = timeFormatter.format(utcDate);

    return {
      date: datePart,
      time: timePart,
      formatted: formattedTime,
    };
  } catch (error) {
    console.warn('Failed to convert UTC to event time:', {
      utcDateTime,
      eventTimeZone,
      error,
    });
    return null;
  }
}

/**
 * Formats a time string for display with timezone label
 */
export function formatTimeWithTimezone(
  time: string,
  timeZoneInfo: EventTimeZoneInfo | null,
): string {
  if (!timeZoneInfo) {
    return time;
  }

  return `${time} ${timeZoneInfo.abbreviation}`;
}

/**
 * Formats a scheduled time for display with timezone abbreviation
 * Example: "Thu, Aug 21 at 9:27 AM MDT"
 */
export function formatScheduledDateTime(
  utcDateTime: string,
  eventTimeZone: string,
): string | null {
  if (!utcDateTime || !isValidTimezone(eventTimeZone)) {
    return null;
  }

  try {
    const utcDate = new Date(utcDateTime);

    // Format the date and time in the event timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: eventTimeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    // Format and parse parts
    const parts = formatter.formatToParts(utcDate);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value || '';
    const timeZoneName =
      parts.find((p) => p.type === 'timeZoneName')?.value || '';

    return `${weekday}, ${month} ${day} at ${hour}:${minute} ${dayPeriod} ${timeZoneName}`;
  } catch (error) {
    console.warn('Failed to format scheduled date time:', {
      utcDateTime,
      eventTimeZone,
      error,
    });
    return null;
  }
}

/**
 * Gets timezone label for schedule display
 */
export function getTimezoneLabel(timeZone: string | null): string {
  if (!timeZone) {
    return 'Event timezone not set';
  }

  if (!isValidTimezone(timeZone)) {
    return 'Invalid timezone';
  }

  const info = getTimezoneInfo(timeZone);
  if (!info) {
    return 'Invalid timezone';
  }

  return `All times in ${info.displayName} (${info.abbreviation})`;
}

/**
 * Common IANA timezone options for form dropdowns
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Phoenix', label: 'Arizona Time (Phoenix)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (London)' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (Shanghai)' },
  { value: 'Asia/Mumbai', label: 'India Standard Time (Mumbai)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];
