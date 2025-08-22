/**
 * Environment-aware URL utilities for Unveil app
 */

/**
 * Normalize a URL by adding protocol and removing trailing slash
 * @param url The URL to normalize
 * @returns Normalized URL
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/$/, '');
}

/**
 * Get the base URL for the application based on environment
 * @returns The base URL without trailing slash
 */
export function getAppBaseUrl(): string {
  // Production: Use configured app URL
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_APP_URL
  ) {
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
 * Supports development modes with tunnels and simulation
 * @returns The public base URL without trailing slash (always https://)
 * @throws Error if no public URL is configured and not in development simulation mode
 */
export function getPublicBaseUrl(): string {
  // Priority order: INVITES_PUBLIC_URL → NEXT_PUBLIC_APP_URL → APP_URL → DEV_TUNNEL_URL
  let baseUrl =
    process.env.INVITES_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  // Development tunnel support - only use if no production URLs are set
  if (
    !baseUrl &&
    process.env.NODE_ENV === 'development' &&
    process.env.DEV_TUNNEL_URL
  ) {
    baseUrl = process.env.DEV_TUNNEL_URL;
  }

  // If still no URL configured, check development simulation mode
  if (!baseUrl) {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DEV_SIMULATE_INVITES === 'true'
    ) {
      // Return a placeholder URL for development simulation
      return 'https://dev-simulation.localhost';
    }

    throw new Error(
      'Public base URL not configured. Set one of:\n' +
        '- INVITES_PUBLIC_URL (highest priority)\n' +
        '- NEXT_PUBLIC_APP_URL\n' +
        '- APP_URL\n' +
        '- DEV_TUNNEL_URL (for development with real SMS)\n' +
        '- DEV_SIMULATE_INVITES=true (for development simulation)',
    );
  }

  // Check for empty/whitespace-only URLs
  if (!baseUrl.trim()) {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DEV_SIMULATE_INVITES === 'true'
    ) {
      return 'https://dev-simulation.localhost';
    }

    throw new Error(
      'Public base URL not configured. Set one of:\n' +
        '- INVITES_PUBLIC_URL (highest priority)\n' +
        '- NEXT_PUBLIC_APP_URL\n' +
        '- APP_URL\n' +
        '- DEV_TUNNEL_URL (for development with real SMS)\n' +
        '- DEV_SIMULATE_INVITES=true (for development simulation)',
    );
  }

  // Normalize the URL - ensure it has protocol and remove trailing slash
  const normalizedUrl = normalizeUrl(baseUrl);

  // Production security check: never allow localhost for outbound communications
  if (process.env.NODE_ENV === 'production') {
    if (
      normalizedUrl.includes('localhost') ||
      normalizedUrl.includes('127.0.0.1')
    ) {
      throw new Error(
        `Invalid public base URL detected in production: ${normalizedUrl}. ` +
          'Localhost URLs cannot be used for outbound SMS/email communications. ' +
          'Configure INVITES_PUBLIC_URL or NEXT_PUBLIC_APP_URL with your public domain.',
      );
    }
  } else {
    // Development mode: warn about localhost but allow it if tunnel or simulation
    if (
      (normalizedUrl.includes('localhost') ||
        normalizedUrl.includes('127.0.0.1')) &&
      !process.env.DEV_TUNNEL_URL &&
      process.env.DEV_SIMULATE_INVITES !== 'true'
    ) {
      throw new Error(
        `Invalid public base URL detected: ${normalizedUrl}. ` +
          'Localhost URLs cannot be used for outbound SMS/email communications. ' +
          'For development, either:\n' +
          '- Set DEV_TUNNEL_URL=https://your-tunnel-domain.com (for real SMS)\n' +
          '- Set DEV_SIMULATE_INVITES=true (to simulate SMS without sending)',
      );
    }
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
export function generateGuestAccessLink(
  eventId: string,
  guestPhone?: string,
): string {
  const baseUrl = getPublicBaseUrl();
  const url = `${baseUrl}/guest/events/${eventId}`;

  // Only append phone if provided (for backward compatibility)
  if (guestPhone) {
    return `${url}?phone=${encodeURIComponent(guestPhone)}`;
  }

  return url;
}
