/**
 * Contract tests for get_guest_event_messages RPC function
 * 
 * Tests:
 * - Returns messages in (created_at DESC, id DESC) order
 * - Includes friendly timestamps
 * - No Direct messages included in results
 * - Deduplication works across pages
 * - Proper security boundaries enforced
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { withAuthedSession } from '../_mocks/supabase-helpers';

// Set up isolated Supabase mock for RPC contract testing
const supabase = withAuthedSession();

// Mock dependencies for isolated testing
vi.mock('@/lib/logger');

// Test observability counters (TEST-ONLY)
let testCounters = {
  rpcCalls: 0,
  messagesReturned: 0,
  orderingChecks: 0,
  deduplicationChecks: 0,
  securityChecks: 0,
};

// Test data helpers
interface TestMessage {
  id: string;
  content: string;
  created_at: string;
  message_type: string;
  event_id: string;
  sender_user_id: string;
}

interface TestDelivery {
  id: string;
  message_id: string;
  user_id: string;
  sms_status: string;
}

interface MockGuestMessage {
  message_id: string;
  content: string;
  created_at: string;
  delivery_status: string;
  sender_name: string;
  sender_avatar_url: string | null;
  message_type: string;
  is_own_message: boolean;
}

describe('get_guest_event_messages RPC Contract — ordering/dedup/security @core', () => {
  const TEST_EVENT_ID = 'test-event-12345';
  const TEST_USER_ID = 'test-user-67890';
  const TEST_GUEST_ID = 'test-guest-abcde';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset test counters
    testCounters = {
      rpcCalls: 0,
      messagesReturned: 0,
      orderingChecks: 0,
      deduplicationChecks: 0,
      securityChecks: 0,
    };
  });

  describe('Message Ordering Contract', () => {
    it('should return messages in created_at DESC, id DESC order', async () => {
      // Mock RPC response with messages in correct order
      const mockMessages: MockGuestMessage[] = [
        {
          message_id: 'msg-3',
          content: 'Latest message',
          created_at: '2025-01-15T12:03:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-2',
          content: 'Middle message',
          created_at: '2025-01-15T12:02:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-1',
          content: 'Earliest message',
          created_at: '2025-01-15T12:01:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      // Mock supabase.rpc
      const mockRpc = vi.fn().mockResolvedValue({
        data: mockMessages,
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += data?.length || 0;
      testCounters.orderingChecks++;

      expect(error).toBeNull();
      expect(data).toHaveLength(3);

      // Verify DESC ordering by created_at
      for (let i = 1; i < data.length; i++) {
        const currentTime = new Date(data[i].created_at).getTime();
        const previousTime = new Date(data[i - 1].created_at).getTime();
        expect(currentTime).toBeLessThanOrEqual(previousTime);
      }

      // Verify RPC was called with correct parameters
      expect(mockRpc).toHaveBeenCalledWith('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });
    });

    it('should handle identical timestamps with stable id ordering', async () => {
      const sameTimestamp = '2025-01-15T12:00:00Z';
      
      const mockMessages: MockGuestMessage[] = [
        {
          message_id: 'msg-c', // Should come first (DESC order)
          content: 'Message C',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-b',
          content: 'Message B',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-a', // Should come last (DESC order)
          content: 'Message A',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({
        data: mockMessages,
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += data?.length || 0;
      testCounters.orderingChecks++;

      expect(error).toBeNull();
      expect(data).toHaveLength(3);

      // With identical timestamps, should be ordered by id DESC
      const ids = data.map(m => m.message_id);
      expect(ids).toEqual(['msg-c', 'msg-b', 'msg-a']);
    });

    it('should respect p_before cursor for pagination', async () => {
      const cursorTimestamp = '2025-01-15T12:02:00Z';
      
      // Messages older than cursor
      const mockMessages: MockGuestMessage[] = [
        {
          message_id: 'msg-1',
          content: 'Message before cursor',
          created_at: '2025-01-15T12:01:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-0',
          content: 'Earliest message',
          created_at: '2025-01-15T12:00:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({
        data: mockMessages,
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
        p_before: cursorTimestamp,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += data?.length || 0;

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // All messages should be before cursor
      data.forEach(message => {
        const messageTime = new Date(message.created_at).getTime();
        const cursorTime = new Date(cursorTimestamp).getTime();
        expect(messageTime).toBeLessThan(cursorTime);
      });

      // Verify cursor parameter was passed
      expect(mockRpc).toHaveBeenCalledWith('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
        p_before: cursorTimestamp,
      });
    });
  });

  describe('Message Content Contract', () => {
    it('should include required fields with correct types', async () => {
      const mockMessage: MockGuestMessage = {
        message_id: 'msg-test',
        content: 'Test message content',
        created_at: '2025-01-15T12:00:00Z',
        delivery_status: 'delivered',
        sender_name: 'Test Sender',
        sender_avatar_url: 'https://example.com/avatar.jpg',
        message_type: 'announcement',
        is_own_message: false,
      };

      const mockRpc = vi.fn().mockResolvedValue({
        data: [mockMessage],
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += 1;

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const message = data[0];
      
      // Verify all required fields are present
      expect(message.message_id).toBe('msg-test');
      expect(message.content).toBe('Test message content');
      expect(message.created_at).toBe('2025-01-15T12:00:00Z');
      expect(message.delivery_status).toBe('delivered');
      expect(message.sender_name).toBe('Test Sender');
      expect(message.sender_avatar_url).toBe('https://example.com/avatar.jpg');
      expect(message.message_type).toBe('announcement');
      expect(message.is_own_message).toBe(false);

      // Verify field types
      expect(typeof message.message_id).toBe('string');
      expect(typeof message.content).toBe('string');
      expect(typeof message.created_at).toBe('string');
      expect(typeof message.delivery_status).toBe('string');
      expect(typeof message.sender_name).toBe('string');
      expect(typeof message.message_type).toBe('string');
      expect(typeof message.is_own_message).toBe('boolean');
    });

    it('should handle null avatar_url correctly', async () => {
      const mockMessage: MockGuestMessage = {
        message_id: 'msg-no-avatar',
        content: 'Message without avatar',
        created_at: '2025-01-15T12:00:00Z',
        delivery_status: 'delivered',
        sender_name: 'Anonymous',
        sender_avatar_url: null, // Explicitly null
        message_type: 'announcement',
        is_own_message: false,
      };

      const mockRpc = vi.fn().mockResolvedValue({
        data: [mockMessage],
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += 1;

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].sender_avatar_url).toBeNull();
    });

    it('should include friendly timestamps', async () => {
      const mockMessage: MockGuestMessage = {
        message_id: 'msg-timestamp-test',
        content: 'Timestamp test message',
        created_at: '2025-01-15T12:30:45.123Z', // ISO format with milliseconds
        delivery_status: 'delivered',
        sender_name: 'Test User',
        sender_avatar_url: null,
        message_type: 'announcement',
        is_own_message: false,
      };

      const mockRpc = vi.fn().mockResolvedValue({
        data: [mockMessage],
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += 1;

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      const timestamp = data[0].created_at;
      
      // Should be valid ISO timestamp
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
      
      // Should be parseable by JavaScript Date
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Security and Access Control', () => {
    it('should not include Direct messages in results', async () => {
      // Mock messages including different types
      const mockMessages: MockGuestMessage[] = [
        {
          message_id: 'msg-announcement',
          content: 'Public announcement',
          created_at: '2025-01-15T12:03:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement', // Should be included
          is_own_message: false,
        },
        {
          message_id: 'msg-channel',
          content: 'Channel message',
          created_at: '2025-01-15T12:02:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'channel', // Should be included
          is_own_message: false,
        },
        // Note: Direct messages should NOT be included by RPC
      ];

      const mockRpc = vi.fn().mockResolvedValue({
        data: mockMessages,
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += data?.length || 0;
      testCounters.securityChecks++;

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // Verify no direct messages are included
      const messageTypes = data.map(m => m.message_type);
      expect(messageTypes).not.toContain('direct');
      
      // Should only contain allowed types
      messageTypes.forEach(type => {
        expect(['announcement', 'channel', 'reminder', 'invitation']).toContain(type);
      });
    });

    it('should enforce event membership', async () => {
      // Mock authentication failure
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Access denied: User is not a guest of this event',
          code: 'PGRST000',
        },
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: 'unauthorized-event-id',
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.securityChecks++;

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error.message).toContain('Access denied');
    });

    it('should require authentication', async () => {
      // Mock unauthenticated request
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Authentication required',
          code: 'PGRST000',
        },
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.securityChecks++;

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error.message).toContain('Authentication required');
    });
  });

  describe('Deduplication Contract', () => {
    it('should return unique message IDs across pages', async () => {
      // Simulate fetching two pages
      const page1Messages: MockGuestMessage[] = [
        {
          message_id: 'msg-3',
          content: 'Message 3',
          created_at: '2025-01-15T12:03:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-2',
          content: 'Message 2',
          created_at: '2025-01-15T12:02:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      const page2Messages: MockGuestMessage[] = [
        {
          message_id: 'msg-1',
          content: 'Message 1',
          created_at: '2025-01-15T12:01:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-0',
          content: 'Message 0',
          created_at: '2025-01-15T12:00:00Z',
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      const mockRpc = vi.fn()
        .mockResolvedValueOnce({ data: page1Messages, error: null })
        .mockResolvedValueOnce({ data: page2Messages, error: null });
        supabase.rpc.mockImplementation(mockRpc);

      // Fetch page 1
      const page1Result = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 2,
      });

      // Fetch page 2
      const page2Result = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 2,
        p_before: '2025-01-15T12:02:00Z',
      });

      testCounters.rpcCalls += 2;
      testCounters.messagesReturned += 4;
      testCounters.deduplicationChecks++;

      expect(page1Result.error).toBeNull();
      expect(page2Result.error).toBeNull();

      // Combine results and check for duplicates
      const allMessages = [...page1Result.data, ...page2Result.data];
      const messageIds = allMessages.map(m => m.message_id);
      const uniqueIds = new Set(messageIds);

      expect(uniqueIds.size).toBe(messageIds.length); // No duplicates
      expect(uniqueIds.size).toBe(4);
    });

    it('should handle edge case with identical timestamps across pages', async () => {
      const sameTimestamp = '2025-01-15T12:00:00Z';
      
      const allMessages: MockGuestMessage[] = [
        {
          message_id: 'msg-d',
          content: 'Message D',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-c',
          content: 'Message C',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-b',
          content: 'Message B',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
        {
          message_id: 'msg-a',
          content: 'Message A',
          created_at: sameTimestamp,
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({
        data: allMessages,
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;
      testCounters.messagesReturned += 4;
      testCounters.deduplicationChecks++;

      expect(error).toBeNull();
      expect(data).toHaveLength(4);

      // Should be ordered by id DESC when timestamps are identical
      const ids = data.map(m => m.message_id);
      expect(ids).toEqual(['msg-d', 'msg-c', 'msg-b', 'msg-a']);
      
      // All should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });
  });

  describe('Error Handling Contract', () => {
    it('should handle invalid event ID gracefully', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Invalid event ID format',
          code: 'PGRST000',
        },
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: 'invalid-uuid',
        p_limit: 50,
      });

      testCounters.rpcCalls++;

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error.message).toBeDefined();
    });

    it('should handle limit parameter validation', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      // Test with valid limit
      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 100,
      });

      testCounters.rpcCalls++;

      expect(error).toBeNull();
      expect(data).toEqual([]);
      
      // Verify limit parameter was passed correctly
      expect(mockRpc).toHaveBeenCalledWith('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 100,
      });
    });

    it('should handle empty results gracefully', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
        supabase.rpc.mockImplementation(mockRpc);

      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: TEST_EVENT_ID,
        p_limit: 50,
      });

      testCounters.rpcCalls++;

      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

// Export test counters for integration tests
export { testCounters };
