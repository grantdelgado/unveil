/**
 * Request Throttling Utilities
 * Prevents excessive API calls and improves performance
 */

interface ThrottleEntry {
  lastCalled: number;
  timeoutId?: NodeJS.Timeout;
}

class RequestThrottler {
  private cache = new Map<string, ThrottleEntry>();
  private defaultDelay = 1000; // 1 second default

  /**
   * Throttle a function call by key
   * Ensures the function is not called more than once per delay period
   */
  throttle<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    delay: number = this.defaultDelay,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const now = Date.now();
      const entry = this.cache.get(key);

      if (entry && now - entry.lastCalled < delay) {
        // Clear existing timeout if it exists
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }

        // Set new timeout to call function after delay
        entry.timeoutId = setTimeout(
          () => {
            fn(...args);
            this.cache.set(key, { lastCalled: Date.now() });
          },
          delay - (now - entry.lastCalled),
        );

        return;
      }

      // Call function immediately and update cache
      fn(...args);
      this.cache.set(key, { lastCalled: now });
    };
  }

  /**
   * Debounce a function call by key
   * Ensures the function is only called after no more calls for the delay period
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    delay: number = this.defaultDelay,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const entry = this.cache.get(key);

      // Clear existing timeout
      if (entry?.timeoutId) {
        clearTimeout(entry.timeoutId);
      }

      // Set new timeout
      const timeoutId = setTimeout(() => {
        fn(...args);
        this.cache.set(key, { lastCalled: Date.now() });
      }, delay);

      this.cache.set(key, { lastCalled: Date.now(), timeoutId });
    };
  }

  /**
   * Clear throttle cache for a specific key
   */
  clear(key: string): void {
    const entry = this.cache.get(key);
    if (entry?.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all throttle caches
   */
  clearAll(): void {
    this.cache.forEach((entry) => {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
    });
    this.cache.clear();
  }

  /**
   * Check if a key is currently throttled
   */
  isThrottled(key: string, delay: number = this.defaultDelay): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    return Date.now() - entry.lastCalled < delay;
  }
}

// Global instance
const globalThrottler = new RequestThrottler();

/**
 * Throttle guest data fetching to prevent excessive API calls
 */
export function throttleGuestFetch(
  eventId: string,
  fetchFn: () => Promise<void>,
  delay: number = 5000, // 5 seconds
): () => void {
  const key = `guest-fetch-${eventId}`;
  return globalThrottler.throttle(key, fetchFn, delay);
}

/**
 * Debounce guest updates to batch multiple rapid changes
 */
export function debounceGuestUpdate(
  eventId: string,
  updateFn: () => Promise<void>,
  delay: number = 2000, // 2 seconds
): () => void {
  const key = `guest-update-${eventId}`;
  return globalThrottler.debounce(key, updateFn, delay);
}

/**
 * Throttle SMS sending to respect rate limits
 */
export function throttleSMSSend(
  eventId: string,
  smsFn: () => Promise<void>,
  delay: number = 10000, // 10 seconds
): () => void {
  const key = `sms-send-${eventId}`;
  return globalThrottler.throttle(key, smsFn, delay);
}

/**
 * Clear throttles for a specific event
 */
export function clearEventThrottles(eventId: string): void {
  globalThrottler.clear(`guest-fetch-${eventId}`);
  globalThrottler.clear(`guest-update-${eventId}`);
  globalThrottler.clear(`sms-send-${eventId}`);
}

/**
 * Create a smart request manager for an event
 */
export function createEventRequestManager(eventId: string) {
  return {
    throttledFetch: (fetchFn: () => Promise<void>) =>
      throttleGuestFetch(eventId, fetchFn),
    debouncedUpdate: (updateFn: () => Promise<void>) =>
      debounceGuestUpdate(eventId, updateFn),
    throttledSMS: (smsFn: () => Promise<void>) =>
      throttleSMSSend(eventId, smsFn),
    clearAll: () => clearEventThrottles(eventId),
    isThrottled: (type: 'fetch' | 'update' | 'sms', customDelay?: number) => {
      const delays = { fetch: 5000, update: 2000, sms: 10000 };
      const delay = customDelay || delays[type];
      return globalThrottler.isThrottled(`guest-${type}-${eventId}`, delay);
    },
  };
}

export { globalThrottler };
