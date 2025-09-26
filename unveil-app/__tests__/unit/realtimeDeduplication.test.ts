import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    realtime: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    realtime: {
      setAuth: vi.fn(),
    },
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
    },
  },
}));

vi.mock('@/lib/config/realtime', () => ({
  RealtimeFlags: {
    singleTokenAuthority: true,
  },
}));

vi.mock('@/lib/telemetry/realtime', () => ({
  emitTokenRefreshSuccess: vi.fn(),
  emitTokenRefreshFailure: vi.fn(),
  emitManagerReinit: vi.fn(),
  emitSetAuth: vi.fn(),
}));

vi.mock('./SubscriptionManager', () => ({
  SubscriptionManager: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

const mockUseAuth = vi.mocked(await import('@/lib/auth/AuthProvider')).useAuth;
const mockEmitManagerReinit = vi.mocked(await import('@/lib/telemetry/realtime')).emitManagerReinit;
const mockLogger = vi.mocked(await import('@/lib/logger')).logger;

// Import component after mocks are set up
const { SubscriptionProvider, useSubscriptionManager } = await import('@/lib/realtime/SubscriptionProvider');

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SubscriptionProvider, {}, children);
}

describe('Realtime Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default auth state
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: {
        access_token: 'test-token-12345678',
        user: { id: 'user-123' },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize subscription manager on first sign in', async () => {
    renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    // Wait for initialization
    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockEmitManagerReinit).toHaveBeenCalledWith({
      version: expect.any(Number),
      reason: 'sign_in',
      userId: 'user-123',
      hadPreviousManager: false,
    });
  });

  it('should deduplicate rapid reinit requests within 2000ms', async () => {
    const { rerender } = renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    // Initial sign in
    await act(async () => {
      vi.runAllTimers();
    });

    // Clear previous calls
    mockEmitManagerReinit.mockClear();
    mockLogger.realtime.mockClear();

    // Simulate rapid auth state changes (same session)
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: {
        access_token: 'test-token-12345678', // Same token suffix
        user: { id: 'user-123' },
      },
    });

    // Trigger multiple re-renders quickly
    rerender();
    await act(async () => {
      vi.advanceTimersByTime(100); // 100ms later
    });

    rerender();
    await act(async () => {
      vi.advanceTimersByTime(100); // 200ms total
    });

    // Should have logged deduplication
    expect(mockLogger.realtime).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring reinit - same session within 2000ms'),
      expect.objectContaining({
        timeSinceLastReinit: expect.any(Number),
        sessionId: expect.any(String),
        userId: 'user-123',
      })
    );

    // Should emit deduped event
    expect(mockEmitManagerReinit).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'deduped',
        deduped: true,
        timeSinceLastMs: expect.any(Number),
      })
    );
  });

  it('should allow reinit after 2000ms timeout', async () => {
    const { rerender } = renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    // Initial sign in
    await act(async () => {
      vi.runAllTimers();
    });

    mockEmitManagerReinit.mockClear();

    // Wait more than 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // Trigger re-render (same session but after timeout)
    rerender();
    await act(async () => {
      vi.runAllTimers();
    });

    // Should NOT be deduped - should allow reinit
    expect(mockEmitManagerReinit).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'sign_in', // Not deduped
        userId: 'user-123',
        hadPreviousManager: true, // Had previous manager
      })
    );

    // Should NOT emit deduped event
    expect(mockEmitManagerReinit).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deduped' })
    );
  });

  it('should allow reinit with different session ID', async () => {
    const { rerender } = renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    // Initial sign in
    await act(async () => {
      vi.runAllTimers();
    });

    mockEmitManagerReinit.mockClear();

    // Change to different session (different token)
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: {
        access_token: 'different-token-87654321', // Different token suffix
        user: { id: 'user-123' },
      },
    });

    // Trigger re-render immediately (same user, different session)
    rerender();
    await act(async () => {
      vi.advanceTimersByTime(50); // Very short time, but different session
    });

    // Should NOT be deduped - different session should reinit immediately
    expect(mockEmitManagerReinit).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'sign_in',
        userId: 'user-123',
        hadPreviousManager: true,
      })
    );

    expect(mockLogger.realtime).not.toHaveBeenCalledWith(
      expect.stringContaining('Ignoring reinit')
    );
  });

  it('should handle sign out without deduplication', async () => {
    const { rerender } = renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    // Initial sign in
    await act(async () => {
      vi.runAllTimers();
    });

    mockEmitManagerReinit.mockClear();

    // Sign out
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      session: null,
    });

    rerender();
    await act(async () => {
      vi.runAllTimers();
    });

    // Should emit sign out event (not deduped)
    expect(mockEmitManagerReinit).toHaveBeenCalledWith({
      version: expect.any(Number),
      reason: 'sign_out',
      hadPreviousManager: true,
    });
  });

  it('should track session ID using token suffix', () => {
    const testCases = [
      {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        expectedSuffix: 'dQssw5c',
      },
      {
        token: 'short-token-abc123',
        expectedSuffix: 'abc123',
      },
      {
        token: 'abcd1234', // Exactly 8 chars
        expectedSuffix: 'abcd1234',
      },
    ];

    testCases.forEach(({ token, expectedSuffix }) => {
      const actualSuffix = token.slice(-8);
      expect(actualSuffix).toBe(expectedSuffix);
    });
  });

  it('should emit observability metrics for deduplication', async () => {
    const { rerender } = renderHook(() => useSubscriptionManager(), {
      wrapper: TestWrapper,
    });

    await act(async () => {
      vi.runAllTimers();
    });

    mockEmitManagerReinit.mockClear();

    // Rapid reinit (should be deduped)
    rerender();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Check that deduplication metrics are emitted
    expect(mockEmitManagerReinit).toHaveBeenCalledWith(
      expect.objectContaining({
        version: expect.any(Number),
        reason: 'deduped',
        userId: 'user-123',
        hadPreviousManager: true,
        deduped: true,
        timeSinceLastMs: expect.any(Number),
      })
    );

    const call = mockEmitManagerReinit.mock.calls[0][0];
    expect(call.timeSinceLastMs).toBeLessThan(2000);
    expect(call.timeSinceLastMs).toBeGreaterThan(0);
  });
});
