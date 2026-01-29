/**
 * Centralized Feature Flags for Unveil
 * 
 * This is the single source of truth for all feature flags.
 * Only essential operational flags should be defined here.
 * 
 * @see docs/flags.md for flag policies and usage guidelines
 */

/**
 * Helper to safely parse boolean environment variables
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true';
}

/**
 * Operational flags for production control
 * These are permanent flags for ops/emergency use
 */
export const flags = {
  ops: {
    /**
     * SMS Branding Kill Switch
     * 
     * When enabled (true), reverts SMS messages to legacy format:
     * - No event tags prepended
     * - No A2P "Reply STOP" footer
     * 
     * @default false (branding enabled)
     * @env SMS_BRANDING_DISABLED
     * @owner Platform Team
     * @risk HIGH - affects all SMS delivery
     */
    get smsBrandingDisabled(): boolean {
      return envBool('SMS_BRANDING_DISABLED', false);
    },
  },
  features: {
    /**
     * Push Notifications Feature Flag
     * 
     * When enabled (true), shows push notification options in the UI.
     * Push notifications are not yet fully implemented (device token storage,
     * APNS integration). Enable only after completing push implementation.
     * 
     * @default false (push hidden until implemented)
     * @env NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED
     * @owner Platform Team
     * @risk LOW - UI-only change
     */
    get pushNotificationsEnabled(): boolean {
      return envBool('NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED', false);
    },
  },
} as const;

/**
 * Type-safe access to flag values
 */
export type OpFlags = typeof flags.ops;
export type OpFlagKey = keyof OpFlags;
export type FeatureFlags = typeof flags.features;
export type FeatureFlagKey = keyof FeatureFlags;

/**
 * Development helper to log current flag states
 * Only runs in development mode
 */
export function logFlagStates(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.group('🏁 Feature Flags');
  console.log('SMS Branding Disabled:', flags.ops.smsBrandingDisabled);
  console.log('Push Notifications Enabled:', flags.features.pushNotificationsEnabled);
  console.groupEnd();
}
