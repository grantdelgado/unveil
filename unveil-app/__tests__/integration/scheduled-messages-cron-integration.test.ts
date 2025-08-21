import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/messages/process-scheduled/route';

// Mock dependencies with more detailed implementations for integration testing
vi.mock('@/lib/logger', () => ({
  logger: {
    api: vi.fn(),
    apiError: vi.fn(),
  }
}));

vi.mock('@/lib/sms', () => ({
  sendBulkSMS: vi.fn()
}));

describe('Scheduled Messages Cron Integration Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'integration-test-secret';
    process.env.SCHEDULED_MAX_PER_TICK = '50';
    process.env.NODE_ENV = 'test';

    // Create detailed mock for Supabase
    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: { id: 'msg-record-123' }, error: null }))
          }))
        }))
      }))
    };

    // Mock the Supabase module
    vi.doMock('@/lib/supabase/admin', () => ({
      supabase: mockSupabase
    }));
  });

  describe('Full Processing Flow Integration', () => {
    it('should process scheduled messages end-to-end with SMS delivery', async () => {
      // Mock scheduled messages ready for processing
      const mockScheduledMessages = [
        {
          id: 'sched-msg-123',
          event_id: 'event-456',
          sender_user_id: 'user-789',
          content: 'Integration test message',
          message_type: 'announcement',
          send_at: '2025-08-21T16:38:00Z',
          target_all_guests: false,
          target_guest_ids: ['guest-1', 'guest-2', 'guest-3'],
          target_guest_tags: [],
          send_via_sms: true,
          send_via_push: false,
          send_via_email: false,
          recipient_count: 3,
          status: 'scheduled'
        }
      ];

      // Mock resolved recipients
      const mockResolvedRecipients = [
        { id: 'guest-1', phone: '+1234567890', guest_name: 'John Doe' },
        { id: 'guest-2', phone: '+1234567891', guest_name: 'Jane Smith' },
        { id: 'guest-3', phone: '+1234567892', guest_name: 'Bob Johnson' }
      ];

      // Setup RPC mocks
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockScheduledMessages, error: null }) // get_scheduled_messages_for_processing
        .mockResolvedValueOnce({ data: 'delivery-123', error: null }) // upsert_message_delivery (guest 1)
        .mockResolvedValueOnce({ data: 'delivery-124', error: null }) // upsert_message_delivery (guest 2)
        .mockResolvedValueOnce({ data: 'delivery-125', error: null }); // upsert_message_delivery (guest 3)

      // Mock SMS service
      const { sendBulkSMS } = await import('@/lib/sms');
      (sendBulkSMS as any).mockResolvedValue({ sent: 3, failed: 0 });

      // Mock the recipient resolution function by setting up the from() chain
      const mockFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              is: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    neq: vi.fn(() => ({ data: mockResolvedRecipients, error: null }))
                  }))
                }))
              }))
            }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockFromChain);

      // Create cron request
      const request = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: {
          'x-vercel-cron-signature': 'test-cron-signature'
        }
      });

      // Execute the request
      const response = await GET(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProcessed).toBe(1);
      expect(data.successful).toBe(1);
      expect(data.failed).toBe(0);
      expect(data.isDryRun).toBe(false);
      expect(data.jobId).toMatch(/^job_\d+_[a-z0-9]{6}$/);

      // Verify processing details
      expect(data.details).toHaveLength(1);
      expect(data.details[0]).toEqual({
        messageId: 'sched-msg-123',
        status: 'sent',
        recipientCount: 3,
        error: undefined
      });

      // Verify RPC calls
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_scheduled_messages_for_processing', {
        p_limit: 50,
        p_current_time: expect.any(String)
      });

      // Verify SMS was sent
      expect(sendBulkSMS).toHaveBeenCalledWith([
        {
          to: '+1234567890',
          message: 'Integration test message',
          eventId: 'event-456',
          guestId: 'guest-1',
          messageType: 'announcement'
        },
        {
          to: '+1234567891',
          message: 'Integration test message',
          eventId: 'event-456',
          guestId: 'guest-2',
          messageType: 'announcement'
        },
        {
          to: '+1234567892',
          message: 'Integration test message',
          eventId: 'event-456',
          guestId: 'guest-3',
          messageType: 'announcement'
        }
      ]);

      // Verify delivery records were created
      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_message_delivery', {
        p_message_id: 'msg-record-123',
        p_guest_id: 'guest-1',
        p_phone_number: '+1234567890',
        p_user_id: undefined,
        p_sms_status: 'sent',
        p_push_status: 'not_applicable',
        p_email_status: 'not_applicable'
      });
    });

    it('should handle idempotency - no duplicate processing on repeated calls', async () => {
      // First call - return scheduled message
      const mockScheduledMessages = [
        {
          id: 'sched-msg-456',
          event_id: 'event-789',
          content: 'Idempotency test message',
          status: 'scheduled',
          recipient_count: 1,
          send_via_sms: true
        }
      ];

      mockSupabase.rpc.mockResolvedValueOnce({ data: mockScheduledMessages, error: null });
      
      const request1 = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: { 'x-vercel-cron-signature': 'test-sig-1' }
      });

      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Second call - return empty (message already processed due to FOR UPDATE SKIP LOCKED)
      mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const request2 = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: { 'x-vercel-cron-signature': 'test-sig-2' }
      });

      const response2 = await GET(request2);
      const data2 = await response2.json();

      // Verify first call processed the message
      expect(data1.totalProcessed).toBe(1);
      
      // Verify second call found no messages to process (idempotency)
      expect(data2.totalProcessed).toBe(0);
      expect(data2.message).toBe('No messages ready for processing');
    });

    it('should handle partial failures gracefully', async () => {
      const mockScheduledMessages = [
        {
          id: 'sched-msg-789',
          event_id: 'event-123',
          content: 'Partial failure test',
          status: 'scheduled',
          recipient_count: 3,
          send_via_sms: true,
          target_guest_ids: ['guest-1', 'guest-2', 'guest-3']
        }
      ];

      const mockResolvedRecipients = [
        { id: 'guest-1', phone: '+1234567890', guest_name: 'John' },
        { id: 'guest-2', phone: '+1234567891', guest_name: 'Jane' },
        { id: 'guest-3', phone: '+1234567892', guest_name: 'Bob' }
      ];

      // Setup mocks for partial SMS failure
      mockSupabase.rpc.mockResolvedValueOnce({ data: mockScheduledMessages, error: null });
      
      const mockFromChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              is: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    neq: vi.fn(() => ({ data: mockResolvedRecipients, error: null }))
                  }))
                }))
              }))
            }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockFromChain);

      // Mock SMS service with partial failure
      const { sendBulkSMS } = await import('@/lib/sms');
      (sendBulkSMS as any).mockResolvedValue({ sent: 2, failed: 1 });

      const request = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: { 'x-vercel-cron-signature': 'test-sig' }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProcessed).toBe(1);
      expect(data.successful).toBe(0); // No fully successful messages
      expect(data.failed).toBe(1); // Message marked as failed due to partial failure
      expect(data.details[0].status).toBe('partially_failed');
      expect(data.details[0].error).toBe('1 delivery failures');
    });

    it('should respect rate limiting from environment variable', async () => {
      process.env.SCHEDULED_MAX_PER_TICK = '2';

      // Mock more messages than the limit
      const mockScheduledMessages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        event_id: 'event-123',
        content: `Message ${i}`,
        status: 'scheduled',
        recipient_count: 1
      }));

      mockSupabase.rpc.mockResolvedValue({ data: mockScheduledMessages, error: null });

      const request = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'POST',
        headers: { 'x-cron-key': 'integration-test-secret' }
      });

      await POST(request);

      // Verify RPC was called with the rate limit
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_scheduled_messages_for_processing', {
        p_limit: 2, // Should use environment variable value
        p_current_time: expect.any(String)
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle RPC errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' }
      });

      const request = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: { 'x-vercel-cron-signature': 'test-sig' }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Failed to fetch scheduled messages');
    });

    it('should handle message creation errors', async () => {
      const mockScheduledMessages = [
        {
          id: 'error-msg-123',
          event_id: 'event-456',
          content: 'Error test message',
          status: 'scheduled',
          recipient_count: 1,
          send_via_sms: true
        }
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockScheduledMessages, error: null });

      // Mock message insert failure
      const mockFromChain = {
        update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })) })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'Insert failed' } }))
          }))
        }))
      };
      mockSupabase.from.mockReturnValue(mockFromChain);

      const request = new NextRequest('http://localhost:3000/api/messages/process-scheduled', {
        method: 'GET',
        headers: { 'x-vercel-cron-signature': 'test-sig' }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200); // Overall success, but individual message failed
      expect(data.totalProcessed).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.details[0].status).toBe('failed');
      expect(data.details[0].error).toBe('Insert failed');
    });
  });
});
