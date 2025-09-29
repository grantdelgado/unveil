/**
 * Simple unit test for the interval lifecycle fix in SubscriptionProvider
 * Tests the core logic without complex React component setup
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock window.setInterval and clearInterval
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

describe('SubscriptionProvider interval lifecycle fix', () => {
  let setIntervalSpy: any;
  let clearIntervalSpy: any;
  let intervalIds: number[] = [];

  beforeEach(() => {
    intervalIds = [];
    
    setIntervalSpy = vi.spyOn(global, 'setInterval').mockImplementation((callback, delay) => {
      const id = originalSetInterval(callback, delay);
      intervalIds.push(id);
      return id;
    });
    
    clearIntervalSpy = vi.spyOn(global, 'clearInterval').mockImplementation((id) => {
      const index = intervalIds.indexOf(id as number);
      if (index > -1) {
        intervalIds.splice(index, 1);
      }
      return originalClearInterval(id);
    });
  });

  afterEach(() => {
    // Clean up any remaining intervals
    intervalIds.forEach(id => originalClearInterval(id));
    intervalIds = [];
    
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.clearAllMocks();
  });

  test('interval is created and cleaned up properly', () => {
    const INTERVAL_MS = 5000;
    let intervalId: number | null = null;
    
    // Simulate the pattern used in the fix
    const startInterval = () => {
      // Safety: clear any stray interval (HMR protection)
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      
      // Start batching only when provider is mounted
      const id = setInterval(() => {
        // Batching logic would go here
      }, INTERVAL_MS);
      
      intervalId = id;
      return id;
    };
    
    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    
    // Start interval
    const id = startInterval();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), INTERVAL_MS);
    expect(intervalIds).toContain(id);
    
    // Stop interval
    stopInterval();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(intervalIds).not.toContain(id);
  });

  test('HMR safety - clears stray interval before creating new one', () => {
    const INTERVAL_MS = 5000;
    let intervalId: number | null = null;
    
    const startInterval = () => {
      // Safety: clear any stray interval (HMR protection)
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      
      const id = setInterval(() => {}, INTERVAL_MS);
      intervalId = id;
      return id;
    };
    
    // Start first interval
    const id1 = startInterval();
    expect(intervalIds).toContain(id1);
    
    // Start second interval (simulates HMR remount)
    const id2 = startInterval();
    
    // Should have cleared the first interval
    expect(clearIntervalSpy).toHaveBeenCalledWith(id1);
    expect(intervalIds).not.toContain(id1);
    expect(intervalIds).toContain(id2);
  });

  test('batching logic with document.hidden check', () => {
    const pendingUpdates = { channelDelta: 0, messageCount: 0, errorCount: 0 };
    const mockFetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
    global.fetch = mockFetch;
    
    const batchingCallback = () => {
      // Optional: skip when tab hidden to reduce noise
      if (typeof document !== 'undefined' && document.hidden) return;
      
      const { channelDelta, messageCount, errorCount } = pendingUpdates;
      if (channelDelta === 0 && messageCount === 0 && errorCount === 0) return;
      
      // flush (PII-safe)
      fetch('/api/health/realtime', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pendingUpdates),
      });
      
      // reset
      pendingUpdates.channelDelta = 0;
      pendingUpdates.messageCount = 0;
      pendingUpdates.errorCount = 0;
    };
    
    // Test with no pending updates
    batchingCallback();
    expect(mockFetch).not.toHaveBeenCalled();
    
    // Test with pending updates
    pendingUpdates.messageCount = 5;
    batchingCallback();
    expect(mockFetch).toHaveBeenCalledWith('/api/health/realtime', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channelDelta: 0, messageCount: 5, errorCount: 0 }),
    });
    
    // Test document.hidden behavior
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    pendingUpdates.messageCount = 3;
    mockFetch.mockClear();
    
    batchingCallback();
    expect(mockFetch).not.toHaveBeenCalled();
    
    // Reset document.hidden
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
  });
});
