// Additional date utilities for Select Event page

/**
 * Checks if an event date is upcoming (today or in the future)
 * 
 * @param dateString - Event date in YYYY-MM-DD format
 * @returns true if the event is today or in the future
 */
export const isDateUpcoming = (dateString: string): boolean => {
  if (!dateString) return false;

  // Parse date components manually to avoid UTC interpretation
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) return false;

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
    return false;
  }

  // Create Date in local timezone to preserve calendar day
  const eventDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  return eventDate >= today;
};

/**
 * Formats a past event date with "Happened" prefix
 * 
 * @param dateString - Event date in YYYY-MM-DD format
 * @returns Formatted string like "Happened August 31, 2024" or "Today" for today's events
 */
export const formatRelativeDate = (dateString: string): string => {
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
  const eventDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  // Check if it's today
  if (eventDate.getTime() === today.getTime()) {
    return 'Today';
  }

  // Format as "Happened [Date]"
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Happened ${formattedDate}`;
};
