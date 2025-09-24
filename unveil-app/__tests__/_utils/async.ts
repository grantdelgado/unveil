/**
 * Async utilities for test timing and lifecycle management
 */
import { vi } from 'vitest';

/**
 * Flush all pending microtasks and timers
 * Useful for components with async effects, subscriptions, or state updates
 */
export const flushMicrotasks = (): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Wait for React state updates to complete
 * Combines act() with microtask flushing for complex async scenarios
 */
export const flushReactUpdates = async (): Promise<void> => {
  await flushMicrotasks();
  await flushMicrotasks(); // Double flush for nested async effects
};

/**
 * Wait for subscriptions and real-time updates to settle
 * Specifically for components using Supabase realtime channels
 */
export const flushSubscriptions = async (): Promise<void> => {
  await flushMicrotasks();
  // Additional delay for subscription establishment
  await new Promise(resolve => setTimeout(resolve, 10));
};

/**
 * Helper for tests with timer/interval dependencies
 * Advances fake timers and flushes resulting microtasks
 */
export const advanceTimersAndFlush = async (ms: number): Promise<void> => {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
};

/**
 * Comprehensive flush for integration tests with complex async behavior
 * Standard pattern for deterministic test execution
 */
export const flushAll = async (timerMs: number = 0): Promise<void> => {
  // Initial microtask flush
  await Promise.resolve();
  
  // Handle pending timers
  if (timerMs > 0) {
    vi.advanceTimersByTime(timerMs);
  } else {
    // Run only pending timers without advancing system time
    vi.runOnlyPendingTimers();
  }
  
  // Flush microtasks after timers
  await Promise.resolve();
  
  // Additional flush for nested async effects
  await flushReactUpdates();
};

/**
 * Standard cleanup pattern for tests with timers and mocks
 */
export const standardCleanup = () => {
  vi.useRealTimers();
  vi.clearAllMocks();
};
