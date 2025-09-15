/**
 * TEST-ONLY observability counters for messaging reliability tests
 * 
 * These counters are only active in test environments and help verify:
 * - Subscription deduplication behavior
 * - Message merge operations
 * - Query invalidation patterns
 * - Performance characteristics
 * 
 * IMPORTANT: These counters are guarded by NODE_ENV and will not be shipped to production
 */

// Global test counters (only active in test environment)
interface TestCounters {
  // Subscription lifecycle
  subscriptionCreations: number;
  subscriptionDestructions: number;
  duplicateSubscriptionsPrevented: number;
  subscriptionManagerVersions: number;
  
  // Message operations
  messageDeduplicationEvents: number;
  messageMergeOperations: number;
  paginationFetches: number;
  realtimeMessageUpdates: number;
  
  // Query management
  queryInvalidations: number;
  queryKeyGenerations: number;
  cacheHits: number;
  cacheMisses: number;
  
  // Performance metrics
  renderCycles: number;
  effectRuns: number;
  memoryLeakPrevented: number;
  
  // Error tracking
  subscriptionErrors: number;
  queryErrors: number;
  validationErrors: number;
}

// Initialize counters (only in test environment)
let testCounters: TestCounters = {
  subscriptionCreations: 0,
  subscriptionDestructions: 0,
  duplicateSubscriptionsPrevented: 0,
  subscriptionManagerVersions: 0,
  
  messageDeduplicationEvents: 0,
  messageMergeOperations: 0,
  paginationFetches: 0,
  realtimeMessageUpdates: 0,
  
  queryInvalidations: 0,
  queryKeyGenerations: 0,
  cacheHits: 0,
  cacheMisses: 0,
  
  renderCycles: 0,
  effectRuns: 0,
  memoryLeakPrevented: 0,
  
  subscriptionErrors: 0,
  queryErrors: 0,
  validationErrors: 0,
};

/**
 * Check if test observability is enabled
 */
function isTestObservabilityEnabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
}

/**
 * Increment a test counter (only in test environment)
 */
export function incrementTestCounter(counterName: keyof TestCounters, amount: number = 1): void {
  if (!isTestObservabilityEnabled()) {
    return; // No-op in production
  }
  
  testCounters[counterName] += amount;
  
  // Optional: Log counter updates for debugging
  if (process.env.DEBUG_TEST_COUNTERS === 'true') {
    console.log(`[TEST-COUNTER] ${counterName}: ${testCounters[counterName]}`);
  }
}

/**
 * Get current test counter values
 */
export function getTestCounters(): Readonly<TestCounters> {
  if (!isTestObservabilityEnabled()) {
    return {} as TestCounters; // Return empty object in production
  }
  
  return { ...testCounters };
}

/**
 * Reset all test counters
 */
export function resetTestCounters(): void {
  if (!isTestObservabilityEnabled()) {
    return; // No-op in production
  }
  
  testCounters = {
    subscriptionCreations: 0,
    subscriptionDestructions: 0,
    duplicateSubscriptionsPrevented: 0,
    subscriptionManagerVersions: 0,
    
    messageDeduplicationEvents: 0,
    messageMergeOperations: 0,
    paginationFetches: 0,
    realtimeMessageUpdates: 0,
    
    queryInvalidations: 0,
    queryKeyGenerations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    
    renderCycles: 0,
    effectRuns: 0,
    memoryLeakPrevented: 0,
    
    subscriptionErrors: 0,
    queryErrors: 0,
    validationErrors: 0,
  };
}

/**
 * Get test counter summary for reporting
 */
export function getTestCounterSummary(): string {
  if (!isTestObservabilityEnabled()) {
    return 'Test observability not enabled';
  }
  
  const counters = getTestCounters();
  
  return `
Test Counter Summary:
=====================
Subscriptions:
- Created: ${counters.subscriptionCreations}
- Destroyed: ${counters.subscriptionDestructions}
- Duplicates Prevented: ${counters.duplicateSubscriptionsPrevented}
- Manager Versions: ${counters.subscriptionManagerVersions}

Messages:
- Deduplication Events: ${counters.messageDeduplicationEvents}
- Merge Operations: ${counters.messageMergeOperations}
- Pagination Fetches: ${counters.paginationFetches}
- Realtime Updates: ${counters.realtimeMessageUpdates}

Queries:
- Invalidations: ${counters.queryInvalidations}
- Key Generations: ${counters.queryKeyGenerations}
- Cache Hits: ${counters.cacheHits}
- Cache Misses: ${counters.cacheMisses}

Performance:
- Render Cycles: ${counters.renderCycles}
- Effect Runs: ${counters.effectRuns}
- Memory Leaks Prevented: ${counters.memoryLeakPrevented}

Errors:
- Subscription Errors: ${counters.subscriptionErrors}
- Query Errors: ${counters.queryErrors}
- Validation Errors: ${counters.validationErrors}
`;
}

/**
 * Assert test counter expectations
 */
export function assertTestCounters(expectations: Partial<TestCounters>): void {
  if (!isTestObservabilityEnabled()) {
    return; // No-op in production
  }
  
  const current = getTestCounters();
  
  for (const [key, expectedValue] of Object.entries(expectations)) {
    const counterKey = key as keyof TestCounters;
    const currentValue = current[counterKey];
    
    if (currentValue !== expectedValue) {
      throw new Error(
        `Test counter assertion failed: ${counterKey} expected ${expectedValue}, got ${currentValue}`
      );
    }
  }
}

/**
 * Subscription lifecycle tracking helpers
 */
export const subscriptionObservability = {
  trackCreation: () => incrementTestCounter('subscriptionCreations'),
  trackDestruction: () => incrementTestCounter('subscriptionDestructions'),
  trackDuplicatePrevented: () => incrementTestCounter('duplicateSubscriptionsPrevented'),
  trackVersionIncrement: () => incrementTestCounter('subscriptionManagerVersions'),
  trackError: () => incrementTestCounter('subscriptionErrors'),
};

/**
 * Message operation tracking helpers
 */
export const messageObservability = {
  trackDeduplication: () => incrementTestCounter('messageDeduplicationEvents'),
  trackMerge: () => incrementTestCounter('messageMergeOperations'),
  trackPagination: () => incrementTestCounter('paginationFetches'),
  trackRealtimeUpdate: () => incrementTestCounter('realtimeMessageUpdates'),
};

/**
 * Query management tracking helpers
 */
export const queryObservability = {
  trackInvalidation: () => incrementTestCounter('queryInvalidations'),
  trackKeyGeneration: () => incrementTestCounter('queryKeyGenerations'),
  trackCacheHit: () => incrementTestCounter('cacheHits'),
  trackCacheMiss: () => incrementTestCounter('cacheMisses'),
  trackError: () => incrementTestCounter('queryErrors'),
};

/**
 * Performance tracking helpers
 */
export const performanceObservability = {
  trackRender: () => incrementTestCounter('renderCycles'),
  trackEffect: () => incrementTestCounter('effectRuns'),
  trackMemoryLeakPrevented: () => incrementTestCounter('memoryLeakPrevented'),
};

/**
 * Validation tracking helpers
 */
export const validationObservability = {
  trackError: () => incrementTestCounter('validationErrors'),
};

// Type exports for test files
export type { TestCounters };

// Guard against accidental production usage
if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
  console.warn(
    'Test observability module loaded in production. This should not happen and indicates a build configuration issue.'
  );
}
