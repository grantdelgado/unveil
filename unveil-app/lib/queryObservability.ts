/**
 * React Query Key Observability System
 * 
 * Auto-enables in development/test environments to detect non-canonical
 * query key patterns. Zero production overhead (hard no-op in prod).
 * 
 * Features:
 * - Automatic dev/test detection with no environment flags
 * - PII-safe logging with truncated strings  
 * - Lightweight cache event subscription
 * - Zero production bundle impact
 * 
 * @version 2.0.0
 */

import type { QueryClient } from '@tanstack/react-query';

let initialized = false;

/**
 * PII-safe canonical key classifier
 * Validates key structure without exposing sensitive data
 */
const isCanonicalKey = (key: unknown): boolean => {
  if (!Array.isArray(key) || key.length < 2) return false;
  
  const [domain, version] = key;
  if (typeof domain !== 'string' || version !== 'v1') return false;

  // If a params object exists, ensure it's a plain object
  const last = key[key.length - 1];
  if (last !== undefined && last !== null && typeof last !== 'object') return false;
  
  return true;
};

/**
 * PII-safe key formatter
 * Truncates long strings to prevent logging sensitive data
 */
const formatKey = (key: unknown): string => {
  try {
    return JSON.stringify(key, (_k, v) => 
      (typeof v === 'string' && v.length > 24 ? v.slice(0, 24) + '…' : v)
    );
  } catch {
    return String(key);
  }
};

/**
 * Get minimal stack trace for discoverability
 * Returns 1-2 frames without noise
 */
const getMinimalStack = (): string => {
  try {
    return new Error().stack?.split('\n').slice(1, 3).join('\n') || '';
  } catch {
    return '';
  }
};

/**
 * Initialize query key observability
 * 
 * Automatically enables in development/test environments.
 * Hard no-op in production with zero overhead.
 * 
 * @param qc QueryClient instance to monitor
 */
export function initQueryObservability(qc: QueryClient): void {
  if (initialized) return;
  initialized = true;

  // Hard no-op in production - zero overhead
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // Development/test only: monitor for non-canonical keys
  const handleQueryAdded = ({ query }: { query: { queryKey: unknown } }): void => {
    const key = query.queryKey;
    
    if (!isCanonicalKey(key)) {
      // Soft warning with minimal context for discoverability
      console.warn(
        '[RQ][non-canonical-key]',
        formatKey(key),
        getMinimalStack()
      );
    }
  };

  // Subscribe to cache events with minimal overhead
  qc.getQueryCache().subscribe((event) => {
    if (event?.type === 'added') {
      handleQueryAdded(event);
    }
  });

  // Log initialization in dev/test for visibility
  if (process.env.NODE_ENV === 'development') {
    console.log('[RQ] Canonical key observer initialized');
  }
}

/**
 * Development utilities for testing and debugging
 * Available in development and test environments
 */
export const devObservabilityUtils = (process.env.NODE_ENV === 'production') 
  ? {} 
  : {
    // Export classifier for testing
    isCanonicalKey,
    formatKey,
    
    // Test helper to simulate cache events
    simulateNonCanonicalKeyUsage: (key: unknown): boolean => {
      const result = !isCanonicalKey(key);
      if (result && process.env.NODE_ENV !== 'production') {
        console.warn('[RQ][test][non-canonical-key]', formatKey(key));
      }
      return result;
    },

    // Reset initialization state for testing
    resetInitialization: (): void => {
      initialized = false;
    },
  } as const;

// For test compatibility - always export these in non-production
export const testUtils = process.env.NODE_ENV === 'production' ? null : {
  isCanonicalKey,
  formatKey,
};

/**
 * Legacy API compatibility
 * @deprecated Use initQueryObservability directly - no env flag needed
 */
export const getObservabilityStats = (): null => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[RQ] getObservabilityStats is deprecated. Use browser dev tools to monitor queries.');
  }
  return null;
};

/**
 * Legacy API compatibility  
 * @deprecated Use initQueryObservability directly - no env flag needed
 */
export const logQueryUsageReport = (): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[RQ] logQueryUsageReport is deprecated. Use browser dev tools to monitor queries.');
  }
};