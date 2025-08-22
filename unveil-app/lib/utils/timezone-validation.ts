/**
 * Timezone validation utilities for form inputs and data processing
 */

import { isValidTimezone, COMMON_TIMEZONES } from './timezone';

export interface TimezoneValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validates timezone input with helpful error messages
 */
export function validateTimezone(
  timeZone: string | null | undefined,
): TimezoneValidationResult {
  // Allow null/undefined (timezone is optional)
  if (!timeZone || timeZone.trim() === '') {
    return { isValid: true };
  }

  const trimmed = timeZone.trim();

  // Check if it's a valid IANA timezone
  if (isValidTimezone(trimmed)) {
    return { isValid: true };
  }

  // Provide helpful suggestions for common mistakes
  const suggestions = getTimezoneSuggestions(trimmed);

  return {
    isValid: false,
    error: `Invalid timezone: "${trimmed}". Please use a valid IANA timezone identifier.`,
    suggestion:
      suggestions.length > 0 ? `Did you mean: ${suggestions[0]}?` : undefined,
  };
}

/**
 * Gets timezone suggestions for typos or common mistakes
 */
function getTimezoneSuggestions(input: string): string[] {
  const normalizedInput = input.toLowerCase().replace(/[_\s-]/g, '');
  const suggestions: string[] = [];

  // Check against common timezones for partial matches
  for (const tz of COMMON_TIMEZONES) {
    const normalizedTz = tz.value.toLowerCase().replace(/[_\s-]/g, '');
    const normalizedLabel = tz.label.toLowerCase().replace(/[_\s-]/g, '');

    // Exact partial matches
    if (
      normalizedTz.includes(normalizedInput) ||
      normalizedLabel.includes(normalizedInput)
    ) {
      suggestions.push(tz.value);
    }

    // City name matches
    const cityPart = tz.value
      .split('/')[1]
      ?.toLowerCase()
      .replace(/[_\s-]/g, '');
    if (cityPart && cityPart.includes(normalizedInput)) {
      suggestions.push(tz.value);
    }
  }

  // Common timezone abbreviation mappings
  const abbreviationMap: Record<string, string[]> = {
    pst: ['America/Los_Angeles'],
    pdt: ['America/Los_Angeles'],
    mst: ['America/Denver'],
    mdt: ['America/Denver'],
    cst: ['America/Chicago'],
    cdt: ['America/Chicago'],
    est: ['America/New_York'],
    edt: ['America/New_York'],
    utc: ['UTC'],
    gmt: ['Europe/London'],
    bst: ['Europe/London'],
    cet: ['Europe/Paris'],
    cest: ['Europe/Paris'],
    jst: ['Asia/Tokyo'],
    aest: ['Australia/Sydney'],
    aedt: ['Australia/Sydney'],
  };

  const abbrevMatch = abbreviationMap[normalizedInput];
  if (abbrevMatch) {
    suggestions.push(...abbrevMatch);
  }

  // Remove duplicates and limit to 3 suggestions
  return [...new Set(suggestions)].slice(0, 3);
}

/**
 * Client-side form validation for timezone field
 */
export function validateTimezoneField(value: string): string | null {
  const result = validateTimezone(value);

  if (!result.isValid) {
    return result.suggestion
      ? `${result.error} ${result.suggestion}`
      : result.error!;
  }

  return null;
}

/**
 * Gets a user-friendly error message for timezone validation
 */
export function getTimezoneErrorMessage(timeZone: string): string {
  const result = validateTimezone(timeZone);

  if (result.isValid) {
    return '';
  }

  let message = 'Please enter a valid timezone.';

  if (result.suggestion) {
    message += ` ${result.suggestion}`;
  } else {
    message +=
      ' Examples: "America/Los_Angeles", "Europe/London", "Asia/Tokyo"';
  }

  return message;
}

/**
 * Checks if timezone is supported for the application
 * Some timezones might be valid but not well-supported across all browsers
 */
export function isTimezoneSupported(timeZone: string): boolean {
  if (!isValidTimezone(timeZone)) {
    return false;
  }

  try {
    // Test with multiple date ranges to ensure DST handling works
    const testDates = [
      new Date('2025-01-01'), // Winter
      new Date('2025-07-01'), // Summer
      new Date('2025-03-15'), // Spring transition
      new Date('2025-11-15'), // Fall transition
    ];

    for (const date of testDates) {
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone,
        timeZoneName: 'short',
      });

      formatter.format(date);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes timezone input (trim, case handling)
 */
export function normalizeTimezone(
  timeZone: string | null | undefined,
): string | null {
  if (!timeZone) return null;

  const trimmed = timeZone.trim();
  if (!trimmed) return null;

  // Common timezone corrections
  const corrections: Record<string, string> = {
    'america/los angeles': 'America/Los_Angeles',
    'america/new york': 'America/New_York',
    'europe/london': 'Europe/London',
    'asia/tokyo': 'Asia/Tokyo',
  };

  const normalized = corrections[trimmed.toLowerCase()] || trimmed;

  return isValidTimezone(normalized) ? normalized : trimmed;
}
