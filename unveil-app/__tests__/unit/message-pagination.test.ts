/**
 * @file Comprehensive pagination tests for useGuestMessagesRPC
 * Tests the actual hook behavior with realistic data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGuestMessagesRPC } from '@/hooks/messaging/useGuestMessagesRPC';

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' },
    session: { access_token: 'test-token' },
  })),
}));

vi.mock('@/lib/realtime/SubscriptionProvider', () => ({
  useSubscriptionManager: vi.fn(() => ({
    version: 1,
    manager: {},
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(await import('@/lib/supabase/client')).supabase;

// Sample message data for testing
const createTestMessage = (id: string, timestamp: string, content: string) => ({
  message_id: id,
  content,
  created_at: timestamp,
  delivery_status: 'delivered',
  sender_name: 'Test User',
  sender_avatar_url: null,
  message_type: 'announcement',
  is_own_message: false,
  source: 'delivery',
  is_catchup: false,
  channel_tags: null,
});

const initialMessages = [
  createTestMessage('msg-1', '2024-01-01T12:00:00Z', 'Message 1'),
  createTestMessage('msg-2', '2024-01-01T11:00:00Z', 'Message 2'), 
  createTestMessage('msg-3', '2024-01-01T10:00:00Z', 'Message 3'),
];

const olderMessages = [
  createTestMessage('msg-4', '2024-01-01T09:00:00Z', 'Message 4'),
  createTestMessage('msg-5', '2024-01-01T08:00:00Z', 'Message 5'),
];

describe('useGuestMessagesRPC Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
  });

  describe('initial message loading', () => {
    it('should load initial messages and set compound cursor', async () => {
      // Mock successful initial fetch
      mockSupabase.rpc.mockResolvedValueOnce({
        data: initialMessages,
        error: null,
      });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify messages loaded
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.hasMore).toBe(false); // No +1 message, so no more
      
      // Verify compound cursor is set (should be oldest message)
      const oldestMessage = result.current.messages[result.current.messages.length - 1];
      expect(oldestMessage.message_id).toBe('msg-3'); // Oldest by timestamp
    });

    it('should set hasMore true when RPC returns +1 messages', async () => {
      // Mock initial fetch with +1 message (indicating more available)
      const messagesWithMore = [...initialMessages, createTestMessage('msg-extra', '2024-01-01T09:30:00Z', 'Extra')];
      
      mockSupabase.rpc.mockResolvedValueOnce({
        data: messagesWithMore,
        error: null,
      });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should trim to window size but set hasMore true
      expect(result.current.messages).toHaveLength(3); // Trimmed from 4 to 3
      expect(result.current.hasMore).toBe(true); // More available
    });
  });

  describe('pagination behavior', () => {
    it('should enable pagination when compound cursor exists', async () => {
      // Mock initial fetch
      const messagesWithMore = [...initialMessages, createTestMessage('msg-extra', '2024-01-01T09:30:00Z', 'Extra')];
      mockSupabase.rpc.mockResolvedValueOnce({
        data: messagesWithMore,
        error: null,
      });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have pagination available
      expect(result.current.hasMore).toBe(true);
      expect(typeof result.current.fetchOlderMessages).toBe('function');
      
      // Should not be stuck in fetching state
      expect(result.current.isFetchingOlder).toBe(false);
    });

    it('should call RPC with compound cursor parameters for pagination', async () => {
      // Setup initial messages
      const messagesWithMore = [...initialMessages, createTestMessage('msg-extra', '2024-01-01T09:30:00Z', 'Extra')];
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: messagesWithMore, error: null }) // Initial
        .mockResolvedValueOnce({ data: olderMessages, error: null }); // Pagination

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger pagination
      await act(async () => {
        await result.current.fetchOlderMessages();
      });

      // Should have called RPC with compound cursor
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      
      const paginationCall = mockSupabase.rpc.mock.calls[1][1];
      expect(paginationCall).toMatchObject({
        p_event_id: 'test-event',
        p_cursor_created_at: expect.any(String),
        p_cursor_id: expect.any(String),
        p_before: undefined, // Legacy param should be undefined
      });
    });

    it('should merge paginated messages without duplicates', async () => {
      // Setup: initial + pagination with some overlapping IDs
      const initialWithMore = [...initialMessages, createTestMessage('msg-extra', '2024-01-01T09:30:00Z', 'Extra')];
      const paginationWithDupe = [...olderMessages, createTestMessage('msg-3', '2024-01-01T10:00:00Z', 'Message 3 Duplicate')];
      
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: initialWithMore, error: null })
        .mockResolvedValueOnce({ data: paginationWithDupe, error: null });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCount = result.current.messages.length;

      // Trigger pagination
      await act(async () => {
        await result.current.fetchOlderMessages();
      });

      await waitFor(() => {
        expect(result.current.isFetchingOlder).toBe(false);
      });

      // Should have new messages but no duplicates
      expect(result.current.messages.length).toBeGreaterThan(initialCount);
      
      // Should have only one instance of msg-3
      const msg3Instances = result.current.messages.filter(m => m.message_id === 'msg-3');
      expect(msg3Instances).toHaveLength(1);
      expect(msg3Instances[0].content).toBe('Message 3'); // Original content preserved
    });
  });

  describe('error handling', () => {
    it('should handle RPC errors gracefully during pagination', async () => {
      // Setup successful initial load
      const messagesWithMore = [...initialMessages, createTestMessage('msg-extra', '2024-01-01T09:30:00Z', 'Extra')];
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: messagesWithMore, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'RPC Error' } });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger pagination (should fail)
      await act(async () => {
        await result.current.fetchOlderMessages();
      });

      // Should set error state
      expect(result.current.error).toContain('Failed to fetch older messages');
      expect(result.current.isFetchingOlder).toBe(false);
    });
  });

  describe('state consistency', () => {
    it('should maintain consistent state between messages and messageIds', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: initialMessages,
        error: null,
      });

      const { result } = renderHook(() => useGuestMessagesRPC({ eventId: 'test-event' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Messages and messageIds should be in sync
      expect(result.current.messages).toHaveLength(3);
      // We can't directly access messageIds, but we can test deduplication behavior
      
      // Test that the state is internally consistent by checking no duplicates
      const messageIds = new Set(result.current.messages.map(m => m.message_id));
      expect(messageIds.size).toBe(result.current.messages.length);
    });
  });
});
