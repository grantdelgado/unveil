/**
 * Integration tests for SMS send path with Twilio mocking
 * Tests the complete SMS sending flow with event tag branding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockTwilioClient } from '@/src/test/setup';
import { logger } from '@/lib/logger';

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

const createSelectSingleChain = (data: unknown) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data, error: null })),
    })),
  })),
});

const createSelectSingleRejectChain = (error: Error) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      single: vi.fn(() => Promise.reject(error)),
      maybeSingle: vi.fn(() => Promise.reject(error)),
    })),
  })),
});

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabase: mockSupabase,
}));

describe('SMS Send Integration', () => {
  let sendSMS: typeof import('@/lib/sms').sendSMS;
  let sendBulkSMS: typeof import('@/lib/sms').sendBulkSMS;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set environment variables for testing (branding enabled by default)
    delete process.env.SMS_BRANDING_DISABLED;
    process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+12345678900';
    process.env.NODE_ENV = 'test';
    process.env.DEV_SIMULATE_INVITES = 'false';

    ({ sendSMS, sendBulkSMS } = await import('@/lib/sms'));
  });

  describe('sendSMS with Event Tag Branding', () => {
    it('should send SMS with event tag and call Twilio with formatted body', async () => {
      // Mock event and guest data
      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'TestEvent',
            title: 'Test Event',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      // Mock A2P notice marking
      mockSupabase.rpc.mockResolvedValue({ error: null });

      const result = await sendSMS({
        to: '+12345678901',
        message: 'Hello, this is a test message!',
        eventId: 'event-123',
        guestId: 'guest-456',
        messageType: 'custom',
      });

      // Verify Twilio was called with formatted message
      const firstCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(firstCall.to).toBe('+12345678901');
      expect(firstCall.from).toBe('+12345678900');
      expect(firstCall.body).toContain('TestEvent:');
      expect(firstCall.body).toContain('Hello, this is a test message!');

      // A2P notice not marked when STOP notice omitted
      expect(mockSupabase.rpc).not.toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcdef');
      expect(result.messageSid).toBe('SM1234567890abcdef1234567890abcdef');
    });

    it('should not include STOP notice for subsequent SMS to same guest', async () => {
      // Mock event and guest data (guest already received STOP notice)
      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'TestEvent',
            title: 'Test Event',
          });
        }

        return createSelectSingleChain({
          a2p_notice_sent_at: '2024-01-01T12:00:00Z',
        });
      });

      await sendSMS({
        to: '+12345678901',
        message: 'Follow-up message',
        eventId: 'event-123',
        guestId: 'guest-456',
        messageType: 'custom',
      });

      // Verify Twilio was called without STOP notice
      const followUpCall = mockTwilioClient.messages.create.mock.calls[0][0];
      expect(followUpCall.to).toBe('+12345678901');
      expect(followUpCall.from).toBe('+12345678900');
      expect(followUpCall.body).toContain('TestEvent:');
      expect(followUpCall.body).toContain('Follow-up message');

      // Verify A2P notice was NOT marked (already sent)
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should never include sender name in SMS body', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'Wedding',
            title: 'Sarah & David Wedding',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      await sendSMS({
        to: '+12345678901',
        message: 'Welcome to our wedding!',
        eventId: 'event-123',
        guestId: undefined,
        messageType: 'welcome',
      });

      const twilioCall = mockTwilioClient.messages.create.mock.calls[0][0];
      
      // Verify no sender name patterns exist
      expect(twilioCall.body).not.toMatch(/^[A-Za-z]+:\s*here/); // No "Name here" prefix
      expect(twilioCall.body).not.toContain(' here'); // No "Sarah here" patterns
      expect(twilioCall.body).toContain('Wedding:');
      expect(twilioCall.body).toContain('Welcome to our wedding!');
    });

    it('should handle auto-generated event tags from title', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: '',
            title: 'Sarah & David Wedding 2024',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      await sendSMS({
        to: '+12345678901',
        message: 'Test message',
        eventId: 'event-123',
        guestId: undefined,
        messageType: 'custom',
      });

      const twilioCall = mockTwilioClient.messages.create.mock.calls[0][0];
      
      // Should auto-generate tag from title (multiline format, no STOP so no brand line)
      expect(twilioCall.body).toContain('Sarah+Dav+Wed+:');
      expect(twilioCall.body).toContain('Test message');
    });

    it('should log SMS metrics without PII', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'Test',
            title: 'Test Event',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      await sendSMS({
        to: '+12345678901',
        message: 'Test message for logging',
        eventId: 'event-123',
        guestId: undefined,
        messageType: 'custom',
      });

      // Verify logger was called with metrics but no PII
      const logCalls = (logger.info as any).mock.calls;
      const formattingLogCall = logCalls.find((call: any) => 
        call[0] === 'SMS formatting completed'
      );
      
      expect(formattingLogCall).toBeDefined();
      expect(formattingLogCall[1]).toMatchObject({
        eventId: 'event-123',
        originalLength: expect.any(Number),
        finalLength: expect.any(Number),
        segments: expect.any(Number),
        includedStopNotice: expect.any(Boolean),
        droppedLink: expect.any(Boolean),
        truncatedBody: expect.any(Boolean),
      });

      // Verify no message content in logs
      const logMessages = logCalls.map((call: any) => JSON.stringify(call));
      logMessages.forEach((logMessage: string) => {
        expect(logMessage).not.toContain('Test message for logging');
        expect(logMessage).not.toContain('+12345678901');
      });
    });

    it('should handle simulation mode with formatting', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_SIMULATE_INVITES = 'true';

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'SimTest',
            title: 'Simulation Test',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });

      const result = await sendSMS({
        to: '+12345678901',
        message: 'Simulation test message',
        eventId: 'event-123',
        guestId: 'guest-456',
        messageType: 'custom',
      });

      // Should not call Twilio in simulation mode
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
      
      // A2P notice not marked when STOP notice omitted
      expect(mockSupabase.rpc).not.toHaveBeenCalled();

      // Should log simulation with formatted message preview
      expect(logger.info).toHaveBeenCalledWith(
        '🔧 SMS SIMULATION MODE - No actual SMS sent',
        expect.objectContaining({
          eventId: 'event-123',
          guestId: 'guest-456',
          messageType: 'custom',
          messageLength: expect.any(Number),
          includedStopNotice: false,
        })
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^sim_/);
    });
  });

  describe('sendBulkSMS', () => {
    it('should send multiple SMS with proper formatting', async () => {
      // Mock for all messages - simulate guests who already received STOP notice
      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'Bulk',
            title: 'Bulk Test',
          });
        }

        return createSelectSingleChain({
          a2p_notice_sent_at: '2024-01-01T12:00:00Z',
        });
      });

      const messages = [
        {
          to: '+12345678901',
          message: 'Message 1',
          eventId: 'event-123',
          guestId: 'guest-1',
          messageType: 'announcement' as const,
        },
        {
          to: '+12345678902',
          message: 'Message 2',
          eventId: 'event-123',
          guestId: 'guest-2',
          messageType: 'announcement' as const,
        },
      ];

      const result = await sendBulkSMS(messages);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
      
      // Verify both messages were formatted with event tag (no STOP since already sent)
      const calls = mockTwilioClient.messages.create.mock.calls;
      expect(calls[0][0].body).toContain('Bulk:');
      expect(calls[0][0].body).toContain('Message 1');
      expect(calls[1][0].body).toContain('Bulk:');
      expect(calls[1][0].body).toContain('Message 2');
    });
  });

  describe('Error Handling', () => {
    it('should handle Twilio errors gracefully', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'Error',
            title: 'Error Test',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      mockTwilioClient.messages.create.mockRejectedValue(
        new Error('Twilio API error')
      );

      const result = await sendSMS({
        to: '+12345678901',
        message: 'This will fail',
        eventId: 'event-123',
        guestId: undefined,
        messageType: 'custom',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio API error');
      
      // Should log error without PII
      expect(logger.smsError).toHaveBeenCalledWith(
        'Failed to send SMS',
        expect.objectContaining({
          error: 'Twilio API error',
          eventId: 'event-123',
        })
      );
    });

    it('should handle formatter errors gracefully', async () => {
      // This test verifies that the formatter handles errors gracefully
      // The actual SMS sending is tested separately with working mocks
      
      // Mock database error in formatter
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleRejectChain(new Error('DB error'));
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      // Test the formatter directly to verify fallback behavior
      const { composeSmsText } = await import('@/lib/sms-formatter');
      const result = await composeSmsText('event-123', undefined, 'Fallback message');

      // Should fallback to unformatted message
      expect(result.text).toBe('Fallback message');
      expect(result.includedStopNotice).toBe(false);
    });
  });

  describe('Kill Switch', () => {
    it('should use legacy behavior when kill switch is enabled', async () => {
      process.env.SMS_BRANDING_DISABLED = 'true';

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'KillSwitch',
            title: 'Kill Switch Event',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      // Test the formatter directly to verify kill switch behavior
      const { composeSmsText } = await import('@/lib/sms-formatter');
      const result = await composeSmsText('event-123', 'guest-456', 'Original message');

      // Should keep header while removing brand/stop when kill switch is enabled
      expect(result.text).toContain('KillSwitch:');
      expect(result.text).toContain('Original message');
      expect(result.includedStopNotice).toBe(false);
      
      // Should have called Supabase for header data
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should use branding by default when no environment variable is set', async () => {
      // Ensure no kill switch is set (default behavior)
      delete process.env.SMS_BRANDING_DISABLED;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return createSelectSingleChain({
            sms_tag: 'Default',
            title: 'Default Event',
          });
        }

        return createSelectSingleChain({ a2p_notice_sent_at: null });
      });

      const { composeSmsText } = await import('@/lib/sms-formatter');
      const result = await composeSmsText('event-123', undefined, 'Default behavior');

      // Should format message by default
      expect(result.text).toContain('Default:');
      expect(result.text).toContain('Default behavior');
      expect(result.includedStopNotice).toBe(false);
      
      // Should have called Supabase for event data
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});
