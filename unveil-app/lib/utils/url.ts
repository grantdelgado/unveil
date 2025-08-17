/**
 * Environment-aware URL utilities for Unveil app
 */

/**
 * Get the base URL for the application based on environment
 * @returns The base URL without trailing slash
 */
export function getAppBaseUrl(): string {
  // Production: Use configured app URL
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Vercel Preview: Use preview deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Local development fallback
  return 'http://localhost:3000';
}

/**
 * Build invite link for guests
 * @param options Configuration for the invite link
 * @returns Complete invite URL
 */
export function buildInviteLink(options: {
  target: 'hub' | 'event';
  eventId?: string;
}): string {
  const baseUrl = getAppBaseUrl();
  
  switch (options.target) {
    case 'event':
      if (!options.eventId) {
        throw new Error('eventId is required when target is "event"');
      }
      // Deep link to specific event (kept for future use)
      return `${baseUrl}/guest/events/${options.eventId}`;
    
    case 'hub':
    default:
      // Link to guest hub/event selector
      return `${baseUrl}/select-event`;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use buildInviteLink({ target: 'event', eventId }) instead
 */
export function generateGuestAccessLink(eventId: string, guestPhone?: string): string {
  const baseUrl = getAppBaseUrl();
  const url = `${baseUrl}/guest/events/${eventId}`;
  
  // Only append phone if provided (for backward compatibility)
  if (guestPhone) {
    return `${url}?phone=${encodeURIComponent(guestPhone)}`;
  }
  
  return url;
}
