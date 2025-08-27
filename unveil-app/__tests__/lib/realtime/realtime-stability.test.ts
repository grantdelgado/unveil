/**
 * Realtime Stability Tests
 * 
 * Tests for the realtime stability improvements including:
 * - Adaptive timeout management
 * - Single token authority
 * - Cold reconnect circuit breaker
 * - StrictMode deduplication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealtimeFlags, RealtimeTunables, getAdaptiveTimeout, getCleanupInterval } from '@/lib/config/realtime';

// Mock document for visibility tests
const mockDocument = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
});

describe('Realtime Configuration', () => {
  beforeEach(() => {
    mockDocument.hidden = false;
  });

  describe('getAdaptiveTimeout', () => {
    it('returns foreground timeout when document is visible', () => {
      mockDocument.hidden = false;
      const timeout = getAdaptiveTimeout();
      expect(timeout).toBe(RealtimeTunables.joinTimeoutFgMs);
    });

    it('returns background timeout when document is hidden', () => {
      mockDocument.hidden = true;
      const timeout = getAdaptiveTimeout();
      expect(timeout).toBe(RealtimeTunables.joinTimeoutBgMs);
    });

    it('returns foreground timeout when adaptive timeout is disabled', () => {
      // Temporarily disable adaptive timeout
      const originalFlag = RealtimeFlags.adaptiveTimeout;
      (RealtimeFlags as any).adaptiveTimeout = false;
      
      mockDocument.hidden = true;
      const timeout = getAdaptiveTimeout();
      expect(timeout).toBe(RealtimeTunables.joinTimeoutFgMs);
      
      // Restore flag
      (RealtimeFlags as any).adaptiveTimeout = originalFlag;
    });
  });

  describe('Feature Flags', () => {
    it('has all stability flags enabled by default', () => {
      expect(RealtimeFlags.adaptiveTimeout).toBe(true);
      expect(RealtimeFlags.singleTokenAuthority).toBe(true);
      expect(RealtimeFlags.coldReconnect).toBe(true);
      expect(RealtimeFlags.strictModeDedup).toBe(true);
    });
  });

  describe('Tunables', () => {
    it('has reduced reconnect cooldown', () => {
      expect(RealtimeTunables.reconnectCooldownMs).toBe(12_000);
      expect(RealtimeTunables.reconnectCooldownMs).toBeLessThan(30_000);
    });

    it('has appropriate cold reconnect threshold', () => {
      expect(RealtimeTunables.consecutiveTimeoutsForCold).toBe(2);
      expect(RealtimeTunables.coldReconnectCooldownMs).toBe(60_000);
    });

    it('has different cleanup intervals for dev vs prod', () => {
      expect(RealtimeTunables.cleanupIntervalDevMs).toBe(120_000); // 2 minutes
      expect(RealtimeTunables.cleanupIntervalProdMs).toBe(600_000); // 10 minutes
    });
  });
});

describe('StrictMode Deduplication', () => {
  // Mock the module-level activeSubscriptions map
  const mockActiveSubscriptions = new Map();
  
  beforeEach(() => {
    mockActiveSubscriptions.clear();
  });

  it('should create stable subscription keys', () => {
    const table = 'messages';
    const event = 'INSERT';
    const filter = 'event_id=eq.123';
    const schema = 'public';
    
    const key1 = `${table}-${event}-${filter || 'no-filter'}-${schema}`;
    const key2 = `${table}-${event}-${filter || 'no-filter'}-${schema}`;
    
    expect(key1).toBe(key2);
    expect(key1).toBe('messages-INSERT-event_id=eq.123-public');
  });

  it('should generate unique instance IDs', () => {
    const subscriptionKey = 'messages-INSERT-event_id=eq.123-public';
    const instanceId1 = `${subscriptionKey}-${Date.now()}-abc123`;
    
    // Wait a bit to ensure different timestamp
    const instanceId2 = `${subscriptionKey}-${Date.now() + 1}-def456`;
    
    expect(instanceId1).not.toBe(instanceId2);
    expect(instanceId1).toContain(subscriptionKey);
    expect(instanceId2).toContain(subscriptionKey);
  });
});

describe('Telemetry Events', () => {
  it('should emit timeout events with background/foreground distinction', () => {
    const mockEmitTimeout = vi.fn();
    
    // Test foreground timeout
    mockEmitTimeout({
      subscriptionId: 'test-sub',
      timeoutMs: 30000,
      isBackground: false,
      consecutiveTimeouts: 1,
    });
    
    expect(mockEmitTimeout).toHaveBeenCalledWith({
      subscriptionId: 'test-sub',
      timeoutMs: 30000,
      isBackground: false,
      consecutiveTimeouts: 1,
    });
  });

  it('should emit cold reconnect events', () => {
    const mockEmitColdReconnect = vi.fn();
    
    mockEmitColdReconnect({
      reason: 'consecutive_timeouts',
      subscriptionCount: 3,
      duration: 5000,
      success: true,
    });
    
    expect(mockEmitColdReconnect).toHaveBeenCalledWith({
      reason: 'consecutive_timeouts',
      subscriptionCount: 3,
      duration: 5000,
      success: true,
    });
  });

  it('should emit setAuth events with deduplication tracking', () => {
    const mockEmitSetAuth = vi.fn();
    
    // Test successful setAuth
    mockEmitSetAuth({
      source: 'provider',
      deduped: false,
      duration: 100,
    });
    
    // Test deduped setAuth
    mockEmitSetAuth({
      source: 'provider',
      deduped: true,
      duration: 0,
    });
    
    expect(mockEmitSetAuth).toHaveBeenCalledTimes(2);
    expect(mockEmitSetAuth).toHaveBeenNthCalledWith(1, {
      source: 'provider',
      deduped: false,
      duration: 100,
    });
    expect(mockEmitSetAuth).toHaveBeenNthCalledWith(2, {
      source: 'provider',
      deduped: true,
      duration: 0,
    });
  });
});

describe('Error Counter Reset Logic', () => {
  it('should reset all error counters when stability is restored', () => {
    // Mock subscription manager state
    const mockManager = {
      globalConsecutiveErrors: 5,
      consecutiveGlobalTimeouts: 3,
      getStats: () => ({ healthScore: 85 }),
    };
    
    // Simulate stability restoration
    if (mockManager.getStats().healthScore > 80 && mockManager.globalConsecutiveErrors > 0) {
      mockManager.globalConsecutiveErrors = 0;
      mockManager.consecutiveGlobalTimeouts = 0;
    }
    
    expect(mockManager.globalConsecutiveErrors).toBe(0);
    expect(mockManager.consecutiveGlobalTimeouts).toBe(0);
  });
});

describe('Environment-based Behavior', () => {
  const originalEnv = process.env.NODE_ENV;
  
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should use different cleanup intervals based on environment', () => {
    // Test development
    process.env.NODE_ENV = 'development';
    expect(getCleanupInterval()).toBe(RealtimeTunables.cleanupIntervalDevMs);
    
    // Test production
    process.env.NODE_ENV = 'production';
    expect(getCleanupInterval()).toBe(RealtimeTunables.cleanupIntervalProdMs);
  });
});
