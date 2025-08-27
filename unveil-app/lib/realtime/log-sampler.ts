/**
 * Realtime Log Sampler
 * 
 * Implements time-window based sampling to reduce console noise from
 * repeated connection errors. Each sampling key gets a limited number
 * of log entries per time window.
 */

interface SamplingBucket {
  /** Window start time */
  start: number;
  /** Number of logs in current window */
  count: number;
}

/** Global sampling state - keyed by sampling key */
const buckets = new Map<string, SamplingBucket>();

/**
 * Determine if a log entry should be emitted based on sampling rules
 * 
 * @param key - Sampling key (e.g., "connection:join:fg")
 * @param now - Current timestamp (for testing)
 * @param windowMs - Sampling window duration
 * @param max - Max entries per window
 * @returns true if log should be emitted
 */
export function shouldLog(
  key: string, 
  now = Date.now(), 
  windowMs = 30_000, 
  max = 5
): boolean {
  const bucket = buckets.get(key);
  
  // No bucket or window expired - start new window
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  
  // Within window and under limit - allow log
  if (bucket.count < max) {
    bucket.count++;
    return true;
  }
  
  // Over limit - suppress log
  return false;
}

/**
 * Get current sampling stats for debugging
 */
export function getSamplingStats(): Record<string, { windowStart: number; count: number; age: number }> {
  const now = Date.now();
  const stats: Record<string, { windowStart: number; count: number; age: number }> = {};
  
  for (const [key, bucket] of buckets.entries()) {
    stats[key] = {
      windowStart: bucket.start,
      count: bucket.count,
      age: now - bucket.start,
    };
  }
  
  return stats;
}

/**
 * Clear old sampling buckets to prevent memory leaks
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupSamplingBuckets(now = Date.now(), maxAge = 5 * 60 * 1000): number {
  let cleaned = 0;
  
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.start > maxAge) {
      buckets.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Reset all sampling state (for testing)
 */
export function resetSampling(): void {
  buckets.clear();
}
