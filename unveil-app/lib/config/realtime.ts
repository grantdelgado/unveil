/**
 * Realtime Configuration & Feature Flags
 * 
 * Centralized configuration for realtime stability improvements.
 * All features are behind flags for safe rollback.
 */

export const RealtimeFlags = {
  /** Enable adaptive timeout based on document.hidden state */
  adaptiveTimeout: true,
  /** Centralize JWT refresh handling in Provider only */
  singleTokenAuthority: true,
  /** Enable cold reconnect circuit breaker after consecutive failures */
  coldReconnect: true,
  /** Improve StrictMode/HMR deduplication */
  strictModeDedup: true,
  /** Reduce console noise from expected connection errors */
  quietConnectionErrors: true,
} as const;

export const RealtimeTunables = {
  // Foreground/Background timeouts
  /** Join timeout when tab is active/visible */
  joinTimeoutFgMs: 30_000,
  /** Join timeout when tab is backgrounded/hidden */
  joinTimeoutBgMs: 90_000,
  
  // Global cooldown (foreground; background uses bg timeout)
  /** Global reconnect cooldown - reduced from 30s to 12s */
  reconnectCooldownMs: 12_000,
  
  // Cold reconnect threshold
  /** Number of consecutive timeouts before triggering cold reconnect */
  consecutiveTimeoutsForCold: 2,
  /** Minimum time between cold reconnect attempts */
  coldReconnectCooldownMs: 60_000,
  
  // Dev-only cleanup cadence
  /** Memory cleanup interval in development (2 minutes) */
  cleanupIntervalDevMs: 120_000,
  /** Memory cleanup interval in production (10 minutes) */
  cleanupIntervalProdMs: 10 * 60 * 1000,
  
  // Visibility change debouncing
  /** Debounce delay for foreground reconnect after visibility change */
  foregroundReconnectDelayMs: 3_000,

  // Error logging tunables
  /** Sampling window for error log deduplication */
  logSampleWindowMs: 30_000, // 30s window
  /** Max log entries per key per window */
  logMaxPerWindow: 5, // max entries per key per window
  /** Cap raw error string length (PII-safe) */
  maxRawErrorLength: 200, // cap raw error string length
} as const;

/**
 * Get appropriate cleanup interval based on environment
 */
export function getCleanupInterval(): number {
  return process.env.NODE_ENV === 'development' 
    ? RealtimeTunables.cleanupIntervalDevMs 
    : RealtimeTunables.cleanupIntervalProdMs;
}

/**
 * Get adaptive timeout based on document visibility
 */
export function getAdaptiveTimeout(): number {
  if (!RealtimeFlags.adaptiveTimeout) {
    return RealtimeTunables.joinTimeoutFgMs;
  }
  
  return (typeof document !== 'undefined' && document.hidden)
    ? RealtimeTunables.joinTimeoutBgMs
    : RealtimeTunables.joinTimeoutFgMs;
}
