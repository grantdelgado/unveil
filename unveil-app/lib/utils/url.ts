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
 * Get the public base URL for outbound communications (SMS, emails, etc.)
 * Never falls back to localhost - throws error if not properly configured
 * @returns The public base URL without trailing slash (always https://)
 * @throws Error if no public URL is configured or if localhost is detected
 */
export function getPublicBaseUrl(): string {
  // First try NEXT_PUBLIC_APP_URL
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // Fallback to APP_URL if NEXT_PUBLIC_APP_URL is not set
  if (!baseUrl) {
    baseUrl = process.env.APP_URL;
  }
  
  // If still no URL configured, throw error
  if (!baseUrl) {
    throw new Error(
      'Public base URL not configured. Set NEXT_PUBLIC_APP_URL or APP_URL environment variable.'
    );
  }
  
  // Normalize the URL - ensure it has protocol and remove trailing slash
  let normalizedUrl = baseUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(/\/$/, '');
  
  // Security check: never allow localhost for outbound communications
  if (normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1')) {
    throw new Error(
      `Invalid public base URL detected: ${normalizedUrl}. ` +
      'Localhost URLs cannot be used for outbound SMS/email communications. ' +
      'Configure NEXT_PUBLIC_APP_URL with your public domain.'
    );
  }
  
  return normalizedUrl;
}

/**
 * Build invite link for guests (for outbound communications like SMS)
 * @param options Configuration for the invite link
 * @returns Complete invite URL using public domain
 */
export function buildInviteLink(options: {
  target: 'hub' | 'event';
  eventId?: string;
}): string {
  const baseUrl = getPublicBaseUrl();
  
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
  const baseUrl = getPublicBaseUrl();
  const url = `${baseUrl}/guest/events/${eventId}`;
  
  // Only append phone if provided (for backward compatibility)
  if (guestPhone) {
    return `${url}?phone=${encodeURIComponent(guestPhone)}`;
  }
  
  return url;
}
