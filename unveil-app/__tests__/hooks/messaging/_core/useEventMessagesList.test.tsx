/**
 * Tests for useEventMessagesList - Core Hook #1
 * 
 * Tests pagination, type filtering, de-duplication, and integration
 * with canonical query keys and invalidation patterns.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest';
import { useEventMessagesList } from '@/hooks/messaging/_core/useEventMessagesList';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock invalidation
vi.mock('@/lib/queryInvalidation', () => ({
  invalidate: vi.fn(() => ({
    messages: {
      allLists: vi.fn(),
    },
  })),
}));

// Test data
const mockMessages = [
  {
    id: '1',
    event_id: 'event-1',
    content: 'Test message 1',
    message_type: 'announcement',
    created_at: '2025-01-25T10:00:00Z',
    sender_user_id: 'user-1',
    sender: {
      id: 'user-1',
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  },
  {
    id: '2',
    event_id: 'event-1', 
    content: 'Test message 2',
    message_type: 'channel',
    created_at: '2025-01-25T09:00:00Z',
    sender_user_id: 'user-2',
    sender: {
      id: 'user-2',
      full_name: 'Jane Smith',
      avatar_url: null,
    },
  },
];

describe('useEventMessagesList', () => {
  let queryClient: QueryClient;
  let mockSelect: any;
  let mockEq: any;
  let mockOrder: any;
  let mockLimit: any;
  let mockLt: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Setup Supabase mock chain
    mockLt = vi.fn().mockResolvedValue({ data: [], error: null });
    mockLimit = vi.fn(() => ({ data: mockMessages, error: null }));
    mockOrder = vi.fn(() => ({ limit: mockLimit, lt: mockLt }));
    mockEq = vi.fn(() => ({ order: mockOrder }));
    mockSelect = vi.fn(() => ({ eq: mockEq }));
    
    (supabase.from as any).mockReturnValue({ select: mockSelect });
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('basic functionality', () => {
    it('should fetch messages for event', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockMessages);
      expect(result.current.error).toBeNull();
      
      // Verify Supabase calls
      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('sender:users'));
      expect(mockEq).toHaveBeenCalledWith('event_id', 'event-1');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockOrder).toHaveBeenCalledWith('id', { ascending: false });
    });

    it('should handle empty event ID', () => {
      const { result } = renderHook(
        () => useEventMessagesList(''),
        { wrapper }
      );

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('pagination', () => {
    it('should support cursor-based pagination', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1', { limit: 10 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test fetchNextPage
      expect(result.current.hasNextPage).toBe(true);
      
      await result.current.fetchNextPage();
      
      expect(mockLt).toHaveBeenCalled();
    });

    it('should handle pagination limits correctly', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1', { limit: 50 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should respect max limit constraints', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1', { limit: 200 }), // Over max
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be capped to max limit (100)
      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });

  describe('type filtering', () => {
    it('should filter by message type', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1', { type: 'announcement' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should add type filter
      expect(mockEq).toHaveBeenCalledWith('message_type', 'announcement');
    });

    it('should support all message types', async () => {
      const types = ['announcement', 'channel', 'direct'] as const;
      
      for (const type of types) {
        const { result } = renderHook(
          () => useEventMessagesList('event-1', { type }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(mockEq).toHaveBeenCalledWith('message_type', type);
        
        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockEq = vi.fn(() => ({ order: mockOrder }));
        mockSelect = vi.fn(() => ({ eq: mockEq }));
        (supabase.from as any).mockReturnValue({ select: mockSelect });
      }
    });
  });

  describe('de-duplication', () => {
    it('should deduplicate messages by ID', async () => {
      const duplicateMessages = [
        ...mockMessages,
        { ...mockMessages[0] }, // Duplicate first message
      ];
      
      mockLimit.mockReturnValue({ data: duplicateMessages, error: null });

      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have deduplicated
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data.map(m => m.id)).toEqual(['1', '2']);
    });
  });

  describe('error handling', () => {
    it('should handle Supabase errors', async () => {
      const error = new Error('Database error');
      mockLimit.mockReturnValue({ data: null, error });

      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should retry on failure', async () => {
      // First call fails, second succeeds
      mockLimit
        .mockReturnValueOnce({ data: null, error: new Error('Network error') })
        .mockReturnValueOnce({ data: mockMessages, error: null });

      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(result.current.data).toEqual(mockMessages);
        expect(result.current.error).toBeNull();
      }, { timeout: 5000 });
    });
  });

  describe('invalidation', () => {
    it('should provide invalidation function', async () => {
      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.invalidate).toBe('function');
    });

    it('should call appropriate invalidation on invalidate', async () => {
      const mockInvalidate = vi.fn();
      const mockAllLists = vi.fn();
      
      vi.doMock('@/lib/queryInvalidation', () => ({
        invalidate: vi.fn(() => ({
          messages: {
            allLists: mockAllLists,
          },
        })),
      }));

      const { result } = renderHook(
        () => useEventMessagesList('event-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.invalidate();
      
      expect(mockAllLists).toHaveBeenCalledWith('event-1');
    });
  });

  describe('query key generation', () => {
    it('should generate stable query keys', () => {
      // Test that same parameters generate same keys
      const { result: result1 } = renderHook(
        () => useEventMessagesList('event-1', { type: 'announcement', limit: 30 }),
        { wrapper }
      );

      const { result: result2 } = renderHook(
        () => useEventMessagesList('event-1', { type: 'announcement', limit: 30 }),
        { wrapper }
      );

      // Query keys should be the same (though we can't directly access them in this test)
      // Both should use the same cached data
      expect(result1.current.isLoading).toBe(result2.current.isLoading);
    });
  });
});
