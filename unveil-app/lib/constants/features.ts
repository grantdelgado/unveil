/**
 * Feature flags for Unveil
 * Centralized feature flag management for safe rollouts
 * 
 * Note: RSVP flags removed as part of RSVP-Lite hard cutover.
 * All RSVP functionality now uses declined_at semantics.
 */

export const FEATURE_FLAGS = {
  // Future feature flags can be added here
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Environment-based feature flag overrides
 * Can be used to enable features in development/staging
 * Works on both server and client (uses NEXT_PUBLIC_ prefix)
 */
export function getFeatureFlag(flag: FeatureFlag): boolean {
  // Check environment variable override (client-side safe)
  const envKey = `NEXT_PUBLIC_FEATURE_${flag}`;
  
  // Use globalThis to handle both server and client environments
  const envValue = typeof window !== 'undefined' 
    ? (window as { ENV?: Record<string, string> }).ENV?.[envKey] || (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[envKey]
    : process.env[envKey];
  
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  
  // Fall back to default (no flags currently)
  return false;
}
