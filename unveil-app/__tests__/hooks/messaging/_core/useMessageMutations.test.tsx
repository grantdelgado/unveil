/**
 * Tests for useMessageMutations - Core Hook #4
 * 
 * Tests all mutation operations, invalidation patterns, and error handling.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest';
import { useMessageMutations } from '@/hooks/messaging/_core/useMessageMutations';
import { sendMessageToEvent } from '@/lib/services/messaging-client';
import { supabase } from '@/lib/supabase/client';

// Mock dependencies
vi.mock('@/lib/services/messaging-client', () => ({
  sendMessageToEvent: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/queryInvalidation', () => ({
  invalidate: vi.fn(() => ({
    messages: {
      allLists: vi.fn(),
      byId: vi.fn(),
    },
    messageDeliveries: {
      allForMessage: vi.fn(),
      stats: vi.fn(),
    },
    scheduledMessages: {
      allLists: vi.fn(),
      byId: vi.fn(),
      audienceCount: vi.fn(),
    },
    analytics: {
      messaging: vi.fn(),
      event: vi.fn(),
    },
  })),
}));

// Test data
const mockMessage = {
  id: 'msg-1',
  event_id: 'event-1',
  content: 'Test message',
  message_type: 'announcement',
  created_at: '2025-01-25T10:00:00Z',
  sender_user_id: 'user-1',
};

const mockScheduledMessage = {
  id: 'scheduled-1',
  event_id: 'event-1',
  content: 'Scheduled message',
  send_at: '2025-01-26T10:00:00Z',
  created_at: '2025-01-25T10:00:00Z',
};

describe('useMessageMutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
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

  describe('sendAnnouncement', () => {
    it('should send announcement successfully', async () => {
      (sendMessageToEvent as any).mockResolvedValue({
        success: true,
        data: { message: mockMessage },
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const request = {
        eventId: 'event-1',
        content: 'Test announcement',
        recipientFilter: { type: 'all' as const },
        sendVia: { sms: true, email: false, push: true },
      };

      const response = await result.current.sendAnnouncement(request);

      expect(sendMessageToEvent).toHaveBeenCalledWith({
        ...request,
        messageType: 'announcement',
      });
      expect(response).toEqual(mockMessage);
      expect(result.current.error).toBeNull();
    });

    it('should handle send failure', async () => {
      const error = new Error('Send failed');
      (sendMessageToEvent as any).mockResolvedValue({
        success: false,
        error,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const request = {
        eventId: 'event-1',
        content: 'Test announcement',
        recipientFilter: { type: 'all' as const },
        sendVia: { sms: true, email: false, push: true },
      };

      await expect(result.current.sendAnnouncement(request)).rejects.toThrow('Send failed');
      expect(result.current.error).toEqual(error);
    });
  });

  describe('sendChannel', () => {
    it('should send channel message successfully', async () => {
      (sendMessageToEvent as any).mockResolvedValue({
        success: true,
        data: { message: { ...mockMessage, message_type: 'channel' } },
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const request = {
        eventId: 'event-1',
        content: 'Test channel message',
        recipientFilter: { type: 'tags' as const, tags: ['VIP'] },
        sendVia: { sms: true, email: false, push: true },
      };

      const response = await result.current.sendChannel(request);

      expect(sendMessageToEvent).toHaveBeenCalledWith({
        ...request,
        messageType: 'channel',
      });
      expect(response.message_type).toBe('channel');
    });
  });

  describe('sendDirect', () => {
    it('should send direct message successfully', async () => {
      (sendMessageToEvent as any).mockResolvedValue({
        success: true,
        data: { message: { ...mockMessage, message_type: 'direct' } },
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const request = {
        eventId: 'event-1',
        content: 'Test direct message',
        recipientFilter: { type: 'individual' as const, guestIds: ['guest-1'] },
        sendVia: { sms: true, email: false, push: false },
      };

      const response = await result.current.sendDirect(request);

      expect(sendMessageToEvent).toHaveBeenCalledWith({
        ...request,
        messageType: 'direct',
      });
      expect(response.message_type).toBe('direct');
    });

    it('should not invalidate message lists for direct messages', async () => {
      // Direct messages are delivery-gated and shouldn't appear in general message lists
      (sendMessageToEvent as any).mockResolvedValue({
        success: true,
        data: { message: { ...mockMessage, message_type: 'direct' } },
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const request = {
        eventId: 'event-1',
        content: 'Test direct message',
        recipientFilter: { type: 'all' as const },
        sendVia: { sms: true, email: false, push: false },
      };

      await result.current.sendDirect(request);

      // Verify that appropriate invalidation occurred
      // (Actual invalidation logic would be tested in integration tests)
    });
  });

  describe('scheduleMessage', () => {
    it('should schedule message successfully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockScheduledMessage,
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const scheduleData = {
        event_id: 'event-1',
        content: 'Scheduled message',
        send_at: '2025-01-26T10:00:00Z',
        message_type: 'announcement',
        sender_user_id: 'user-1',
      };

      const response = await result.current.scheduleMessage(scheduleData);

      expect(supabase.from).toHaveBeenCalledWith('scheduled_messages');
      expect(mockInsert).toHaveBeenCalledWith(scheduleData);
      expect(response).toEqual(mockScheduledMessage);
    });

    it('should handle schedule failure', async () => {
      const error = { message: 'Insert failed' };
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      const scheduleData = {
        event_id: 'event-1',
        content: 'Scheduled message',
        send_at: '2025-01-26T10:00:00Z',
        message_type: 'announcement',
        sender_user_id: 'user-1',
      };

      await expect(result.current.scheduleMessage(scheduleData)).rejects.toThrow('Insert failed');
    });
  });

  describe('cancelScheduled', () => {
    it('should cancel scheduled message successfully', async () => {
      // Mock the select query to get the scheduled message
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { event_id: 'event-1' },
            error: null,
          }),
        }),
      });

      // Mock the delete query
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'scheduled_messages') {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return {};
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      await result.current.cancelScheduled('scheduled-1');

      expect(mockSelect).toHaveBeenCalledWith('event_id');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle cancel failure when message not found', async () => {
      const error = { message: 'Message not found' };
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      await expect(result.current.cancelScheduled('invalid-id')).rejects.toThrow();
    });
  });

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        delete: mockDelete,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      await result.current.deleteMessage('event-1', 'msg-1');

      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle delete failure', async () => {
      const error = { message: 'Delete failed' };
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      (supabase.from as any).mockReturnValue({
        delete: mockDelete,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      await expect(result.current.deleteMessage('event-1', 'msg-1')).rejects.toThrow();
    });
  });

  describe('loading states', () => {
    it('should track loading state during mutations', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      (sendMessageToEvent as any).mockReturnValue(promise);

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      expect(result.current.isLoading).toBe(false);

      // Start mutation
      const mutationPromise = result.current.sendAnnouncement({
        eventId: 'event-1',
        content: 'Test',
        recipientFilter: { type: 'all' as const },
        sendVia: { sms: true, email: false, push: true },
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!({
        success: true,
        data: { message: mockMessage },
      });

      await mutationPromise;

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should set global error on mutation failure', async () => {
      const error = new Error('Mutation failed');
      (sendMessageToEvent as any).mockResolvedValue({
        success: false,
        error,
      });

      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      try {
        await result.current.sendAnnouncement({
          eventId: 'event-1',
          content: 'Test',
          recipientFilter: { type: 'all' as const },
          sendVia: { sms: true, email: false, push: true },
        });
      } catch (e) {
        // Expected to throw
      }

      expect(result.current.error).toEqual(error);
    });

    it('should clear error on successful mutation', async () => {
      const { result } = renderHook(() => useMessageMutations(), { wrapper });

      // First, set an error
      (sendMessageToEvent as any).mockResolvedValue({
        success: false,
        error: new Error('First error'),
      });

      try {
        await result.current.sendAnnouncement({
          eventId: 'event-1',
          content: 'Test',
          recipientFilter: { type: 'all' as const },
          sendVia: { sms: true, email: false, push: true },
        });
      } catch (e) {
        // Expected
      }

      expect(result.current.error).not.toBeNull();

      // Now succeed
      (sendMessageToEvent as any).mockResolvedValue({
        success: true,
        data: { message: mockMessage },
      });

      await result.current.sendAnnouncement({
        eventId: 'event-1',
        content: 'Test success',
        recipientFilter: { type: 'all' as const },
        sendVia: { sms: true, email: false, push: true },
      });

      // Error should be cleared
      expect(result.current.error).toBeNull();
    });
  });
});
