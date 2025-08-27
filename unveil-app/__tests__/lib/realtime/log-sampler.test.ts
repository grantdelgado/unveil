/**
 * Tests for realtime log sampler
 */

import { vi } from 'vitest';
import { shouldLog, getSamplingStats, cleanupSamplingBuckets, resetSampling } from '@/lib/realtime/log-sampler';

describe('shouldLog', () => {
  beforeEach(() => {
    resetSampling();
  });

  it('should allow first log for new key', () => {
    expect(shouldLog('test-key', 1000, 30000, 5)).toBe(true);
  });

  it('should allow logs within limit', () => {
    const now = 1000;
    const windowMs = 30000;
    const max = 3;
    
    expect(shouldLog('test-key', now, windowMs, max)).toBe(true); // 1st
    expect(shouldLog('test-key', now + 1000, windowMs, max)).toBe(true); // 2nd
    expect(shouldLog('test-key', now + 2000, windowMs, max)).toBe(true); // 3rd
  });

  it('should suppress logs over limit within window', () => {
    const now = 1000;
    const windowMs = 30000;
    const max = 2;
    
    expect(shouldLog('test-key', now, windowMs, max)).toBe(true); // 1st - allowed
    expect(shouldLog('test-key', now + 1000, windowMs, max)).toBe(true); // 2nd - allowed
    expect(shouldLog('test-key', now + 2000, windowMs, max)).toBe(false); // 3rd - suppressed
    expect(shouldLog('test-key', now + 3000, windowMs, max)).toBe(false); // 4th - suppressed
  });

  it('should reset window after expiry', () => {
    const windowMs = 10000; // 10 second window
    const max = 2;
    
    // Fill up the window
    expect(shouldLog('test-key', 1000, windowMs, max)).toBe(true); // 1st
    expect(shouldLog('test-key', 2000, windowMs, max)).toBe(true); // 2nd
    expect(shouldLog('test-key', 3000, windowMs, max)).toBe(false); // 3rd - suppressed
    
    // Move past window expiry
    const afterWindow = 1000 + windowMs + 1000; // 1 second after window expires
    expect(shouldLog('test-key', afterWindow, windowMs, max)).toBe(true); // New window - allowed
  });

  it('should handle different keys independently', () => {
    const now = 1000;
    const windowMs = 30000;
    const max = 1;
    
    expect(shouldLog('key-1', now, windowMs, max)).toBe(true); // key-1: 1st - allowed
    expect(shouldLog('key-2', now, windowMs, max)).toBe(true); // key-2: 1st - allowed
    expect(shouldLog('key-1', now + 1000, windowMs, max)).toBe(false); // key-1: 2nd - suppressed
    expect(shouldLog('key-2', now + 1000, windowMs, max)).toBe(false); // key-2: 2nd - suppressed
  });

  it('should use default parameters correctly', () => {
    // Default: 30s window, 5 max
    const now = Date.now();
    
    // Should allow 5 logs
    for (let i = 0; i < 5; i++) {
      expect(shouldLog('test-key', now + i * 1000)).toBe(true);
    }
    
    // 6th should be suppressed
    expect(shouldLog('test-key', now + 5000)).toBe(false);
  });
});

describe('getSamplingStats', () => {
  beforeEach(() => {
    resetSampling();
  });

  it('should return empty stats initially', () => {
    const stats = getSamplingStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it('should track sampling stats', () => {
    const now = 1000;
    
    shouldLog('key-1', now, 30000, 5);
    shouldLog('key-1', now + 1000, 30000, 5);
    shouldLog('key-2', now + 2000, 30000, 5);
    
    const stats = getSamplingStats();
    
    expect(stats['key-1']).toBeDefined();
    expect(stats['key-1'].count).toBe(2);
    expect(stats['key-1'].windowStart).toBe(now);
    
    expect(stats['key-2']).toBeDefined();
    expect(stats['key-2'].count).toBe(1);
    expect(stats['key-2'].windowStart).toBe(now + 2000);
  });

  it('should calculate age correctly', () => {
    const startTime = 1000;
    const currentTime = 5000;
    
    shouldLog('test-key', startTime, 30000, 5);
    
    // Mock Date.now for age calculation
    const originalNow = Date.now;
    Date.now = vi.fn(() => currentTime);
    
    const stats = getSamplingStats();
    expect(stats['test-key'].age).toBe(currentTime - startTime);
    
    // Restore Date.now
    Date.now = originalNow;
  });
});

describe('cleanupSamplingBuckets', () => {
  beforeEach(() => {
    resetSampling();
  });

  it('should remove old buckets', () => {
    const oldTime = 1000;
    const newTime = 10000;
    const maxAge = 5000;
    
    // Create some old buckets
    shouldLog('old-key-1', oldTime, 30000, 5);
    shouldLog('old-key-2', oldTime + 100, 30000, 5);
    
    // Create a recent bucket
    shouldLog('new-key', newTime - 1000, 30000, 5);
    
    // Cleanup old buckets
    const cleaned = cleanupSamplingBuckets(newTime, maxAge);
    
    expect(cleaned).toBe(2); // Should clean up 2 old buckets
    
    const stats = getSamplingStats();
    expect(stats['old-key-1']).toBeUndefined();
    expect(stats['old-key-2']).toBeUndefined();
    expect(stats['new-key']).toBeDefined();
  });

  it('should not remove recent buckets', () => {
    const now = 5000;
    const maxAge = 10000;
    
    shouldLog('recent-key', now - 5000, 30000, 5); // 5 seconds old
    
    const cleaned = cleanupSamplingBuckets(now, maxAge);
    
    expect(cleaned).toBe(0);
    
    const stats = getSamplingStats();
    expect(stats['recent-key']).toBeDefined();
  });

  it('should use default parameters', () => {
    const now = Date.now();
    const oldTime = now - 6 * 60 * 1000; // 6 minutes ago (older than default 5 min)
    
    shouldLog('old-key', oldTime, 30000, 5);
    
    const cleaned = cleanupSamplingBuckets(); // Use defaults
    
    expect(cleaned).toBe(1);
  });
});

describe('resetSampling', () => {
  it('should clear all sampling state', () => {
    // Create some buckets
    shouldLog('key-1', 1000, 30000, 5);
    shouldLog('key-2', 2000, 30000, 5);
    
    let stats = getSamplingStats();
    expect(Object.keys(stats)).toHaveLength(2);
    
    // Reset
    resetSampling();
    
    stats = getSamplingStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });
});
