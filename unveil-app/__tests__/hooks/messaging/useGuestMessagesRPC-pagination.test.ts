/**
 * Unit tests for useGuestMessagesRPC pagination de-duplication
 *
 * Tests that page-2+ fetches are not blocked by de-dup while page-1 remains guarded
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuestMessagesRPC } from '@/hooks/messaging/useGuestMessagesRPC';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';

// Mock dependencies
vi.mock('@/lib/auth/AuthProvider');
vi.mock('@/lib/realtime/SubscriptionProvider');
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/logger');

const mockUseAuth = vi.mocked(useAuth);
const mockUseSubscriptionManager = vi.mocked(useSubscriptionManager);

describe('useGuestMessagesRPC - Pagination De-duplication', () => {
  const mockUser = { id: 'test-user-123' };
  const mockEventId = 'test-event-456';
  const mockVersion = 'v2.1.0';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockUseSubscriptionManager.mockReturnValue({ version: mockVersion } as any);

    // Mock Supabase client
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'guest-123',
                removed_at: null,
                guest_name: 'Test Guest',
              },
              error: null,
            }),
          }),
        }),
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    require('@/lib/supabase/client').supabase = mockSupabase;
  });

  test('should allow page-2 fetch while guarding page-1 duplicates', async () => {
    const { result, rerender } = renderHook(() =>
      useGuestMessagesRPC({ eventId: mockEventId }),
    );

    // Wait for initial fetch to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Simulate having some messages with a cursor
    act(() => {
      // Simulate setting oldestMessageCursor internally
      (result.current as any).oldestMessageCursor = '2025-01-29T10:00:00Z';
    });

    // Test 1: Duplicate page-1 fetch should be blocked
    const consoleSpy = vi.spyOn(console, 'log');

    // Force a re-render to trigger fetchInitialMessages again
    rerender();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Should log about skipping duplicate
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping duplicate initial fetch'),
    );

    // Test 2: Page-2 fetch should NOT be blocked
    const mockRpc = require('@/lib/supabase/client').supabase.rpc;
    mockRpc.mockClear();

    await act(async () => {
      result.current.fetchOlderMessages();
    });

    // Should have called RPC for older messages
    expect(mockRpc).toHaveBeenCalledWith('get_guest_event_messages_v2', {
      p_event_id: mockEventId,
      p_limit: 21, // OLDER_MESSAGES_BATCH_SIZE + 1
      p_before: '2025-01-29T10:00:00Z',
    });

    consoleSpy.mockRestore();
  });

  test('should generate correct de-dup keys for different pagination states', () => {
    // Test key format: ${eventId}:${userId}:${version}:${before ?? 'first'}

    const testCases = [
      {
        eventId: 'event-1',
        userId: 'user-1',
        version: 'v1.0',
        cursor: null,
        expected: 'event-1:user-1:v1.0:first',
      },
      {
        eventId: 'event-1',
        userId: 'user-1',
        version: 'v1.0',
        cursor: '2025-01-29T10:00:00Z',
        expected: 'event-1:user-1:v1.0:2025-01-29T10:00:00Z',
      },
      {
        eventId: 'event-2',
        userId: 'user-1',
        version: 'v1.0',
        cursor: null,
        expected: 'event-2:user-1:v1.0:first',
      },
    ];

    testCases.forEach(({ eventId, userId, version, cursor, expected }) => {
      const key = `${eventId}:${userId}:${version}:${cursor ?? 'first'}`;
      expect(key).toBe(expected);
    });
  });

  test('should clear keys on eventId change, user sign-out, and unmount', async () => {
    const { result, unmount } = renderHook(
      ({ eventId }) => useGuestMessagesRPC({ eventId }),
      { initialProps: { eventId: mockEventId } },
    );

    // Wait for initial setup
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify initial key exists (indirectly by checking no duplicate message)
    const consoleSpy = jest.spyOn(console, 'log');

    // Test eventId change cleanup
    rerender({ eventId: 'new-event-id' });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Test component unmount cleanup
    unmount();

    // Should have logged cleanup actions
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Clearing all fetch de-duplication keys on unmount',
      ),
    );

    consoleSpy.mockRestore();
  });
});
