// Date formatting utilities

/**
 * Formats a DATE string (YYYY-MM-DD) as a calendar day, avoiding timezone shifts.
 *
 * IMPORTANT: This function is specifically for DATE columns (not DATETIME/TIMESTAMP).
 *
 * Problem: new Date('2025-08-31') creates UTC midnight, which becomes the previous
 * day for users in negative UTC offset timezones (PST, EST, etc.).
 *
 * Solution: Parse the date components manually and create a Date in local timezone,
 * ensuring the calendar day remains consistent across all timezones.
 *
 * @param dateString - DATE string in 'YYYY-MM-DD' format
 * @returns Formatted date string like "Sunday, August 31, 2025"
 */
export const formatEventDate = (dateString: string): string => {
  if (!dateString) return '';

  // Parse date components manually to avoid UTC interpretation
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) {
    console.warn(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    return dateString;
  }

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);

  // Validate parsed values
  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    console.warn(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    return dateString;
  }

  // Create Date in local timezone to preserve calendar day
  const localDate = new Date(year, month, day);

  // Additional validation: check if the created date matches input
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month ||
    localDate.getDate() !== day
  ) {
    console.warn(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    return dateString;
  }

  return localDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatEventDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatEventDate(timestamp);
};

/**
 * Formats message timestamps with human-friendly display rules:
 * - Today: time only (e.g., "11:06 PM")
 * - Yesterday: "Yesterday"
 * - Older: "Weekday, Month D" (e.g., "Monday, August 18")
 * - Different year: "Weekday, Month D, YYYY"
 *
 * Uses user's local timezone for proper day boundary calculations.
 *
 * @param timestamp - UTC timestamp string from database
 * @returns Formatted string for display
 */
export const formatMessageTimestamp = (timestamp: string): string => {
  if (!timestamp) return '';

  const messageDate = new Date(timestamp);
  const now = new Date();

  // Get dates in user's local timezone for proper day comparison
  const messageDateLocal = new Date(messageDate.getTime());
  const todayLocal = new Date(now.getTime());
  const yesterdayLocal = new Date(todayLocal);
  yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);

  // Compare dates by converting to date strings (removes time component)
  const messageDateStr = messageDateLocal.toDateString();
  const todayStr = todayLocal.toDateString();
  const yesterdayStr = yesterdayLocal.toDateString();

  if (messageDateStr === todayStr) {
    // Today: show time only
    return messageDateLocal.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } else if (messageDateStr === yesterdayStr) {
    // Yesterday
    return 'Yesterday';
  } else {
    // Older messages: show weekday and date
    const currentYear = todayLocal.getFullYear();
    const messageYear = messageDateLocal.getFullYear();

    if (messageYear === currentYear) {
      // Same year: "Monday, August 18"
      return messageDateLocal.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } else {
      // Different year: "Monday, August 18, 2024"
      return messageDateLocal.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
};

/**
 * Formats date headers for message groups with same rules as formatMessageTimestamp
 * but optimized for group headers.
 *
 * @param dateString - Date string (typically from toDateString())
 * @returns Formatted string for date group headers
 */
export const formatMessageDateHeader = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Compare using local date strings to handle timezone properly
  const dateStr = date.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  if (dateStr === todayStr) {
    return 'Today';
  } else if (dateStr === yesterdayStr) {
    return 'Yesterday';
  } else {
    const currentYear = today.getFullYear();
    const messageYear = date.getFullYear();

    if (messageYear === currentYear) {
      // Same year: "Monday, August 18"
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } else {
      // Different year: "Monday, August 18, 2024"
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
};
