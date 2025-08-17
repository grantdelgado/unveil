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
  if (isNaN(year) || isNaN(month) || isNaN(day) || 
      month < 0 || month > 11 || day < 1 || day > 31) {
    console.warn(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    return dateString;
  }
  
  // Create Date in local timezone to preserve calendar day
  const localDate = new Date(year, month, day);
  
  // Additional validation: check if the created date matches input
  if (localDate.getFullYear() !== year || 
      localDate.getMonth() !== month || 
      localDate.getDate() !== day) {
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

export const formatMessageTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
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
