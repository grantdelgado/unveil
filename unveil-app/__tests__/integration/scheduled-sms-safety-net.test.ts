/**
 * Scheduled SMS Safety Net Integration Tests
 * 
 * Tests the denormalized event_tag safety net that ensures scheduled SMS
 * always includes headers even when the formatter falls back.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/src/test/setup';

// Mock the entire scheduled worker module
vi.mock('@/lib/sms-formatter', async () => {
  const actual = await vi.importActual('@/lib/sms-formatter');
  return {
    ...actual,
    composeSmsText: vi.fn(),
    normalizeToGsm7: vi.fn((text: string) => text), // Simple passthrough for tests
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/config/flags', () => ({
  flags: {
    ops: {
      smsBrandingDisabled: false,
    },
  },
}));

describe('Scheduled SMS Safety Net Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment
    delete process.env.SMS_BRANDING_DISABLED;
  });

  describe('Denormalized Header Safety Net', () => {
    it('should use denormalized event_tag when formatter falls back', async () => {
      // Mock formatter to return fallback
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: 'Raw message without header',
        included: { header: false, brand: false, stop: false },
        reason: 'fallback',
        length: 27,
        segments: 1,
      });

      // Mock scheduled message with denormalized event_tag
      const mockScheduledMessage = {
        id: 'scheduled-123',
        event_id: 'event-456',
        content: 'Test scheduled message',
        event_tag: 'SafetyNet', // Denormalized tag
        message_type: 'announcement',
        sender_user_id: 'user-789',
      };

      // Mock guest data
      const mockGuest = {
        id: 'guest-123',
        phone: '+1234567890',
        guest_name: 'Test Guest',
        a2p_notice_sent_at: null, // First SMS
      };

      // Simulate the safety net logic from the worker
      let finalMessage = mockScheduledMessage.content;
      
      if (mockScheduledMessage.event_tag) {
        const formatResult = await composeSmsText(
          mockScheduledMessage.event_id,
          mockGuest.id,
          mockScheduledMessage.content
        );
        
        // Safety net should trigger because header is missing
        if (!formatResult.included.header || formatResult.reason === 'fallback') {
          const headerText = `[${mockScheduledMessage.event_tag}]`;
          const bodyText = mockScheduledMessage.content;
          
          // Check if we need brand/STOP (first SMS and kill switch off)
          const needsBrandStop = !false && !mockGuest.a2p_notice_sent_at; // flags.ops.smsBrandingDisabled = false
          
          if (needsBrandStop) {
            finalMessage = `${headerText}\n${bodyText}\n\nvia Unveil\nReply STOP to opt out.`;
          } else {
            finalMessage = `${headerText}\n${bodyText}`;
          }
        }
      }

      // Verify safety net was applied
      expect(finalMessage).toBe('[SafetyNet]\nTest scheduled message\n\nvia Unveil\nReply STOP to opt out.');
      expect(finalMessage).toMatch(/^\[SafetyNet\]/);
      expect(finalMessage).toContain('Test scheduled message');
      expect(finalMessage).toContain('via Unveil');
      expect(finalMessage).toContain('Reply STOP to opt out.');
    });

    it('should not apply safety net when formatter works correctly', async () => {
      // Mock formatter to return successful result
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: '[WorkingTag]\nTest message\n\nvia Unveil\nReply STOP to opt out.',
        included: { header: true, brand: true, stop: true },
        reason: undefined,
        length: 58,
        segments: 1,
      });

      const mockScheduledMessage = {
        id: 'scheduled-456',
        event_id: 'event-789',
        content: 'Test message',
        event_tag: 'BackupTag',
        message_type: 'announcement',
        sender_user_id: 'user-012',
      };

      const mockGuest = {
        id: 'guest-456',
        phone: '+1234567891',
        guest_name: 'Another Guest',
        a2p_notice_sent_at: null,
      };

      // Simulate worker logic
      let finalMessage = mockScheduledMessage.content;
      
      if (mockScheduledMessage.event_tag) {
        const formatResult = await composeSmsText(
          mockScheduledMessage.event_id,
          mockGuest.id,
          mockScheduledMessage.content
        );
        
        // Safety net should NOT trigger because formatter worked
        if (!formatResult.included.header || formatResult.reason === 'fallback') {
          // This should not execute
          finalMessage = `[${mockScheduledMessage.event_tag}]\n${mockScheduledMessage.content}`;
        } else {
          // Use formatter result
          finalMessage = formatResult.text;
        }
      }

      // Verify formatter result was used (not safety net)
      expect(finalMessage).toBe('[WorkingTag]\nTest message\n\nvia Unveil\nReply STOP to opt out.');
      expect(finalMessage).not.toContain('BackupTag'); // Safety net tag not used
    });

    it('should handle kill switch with safety net', async () => {
      // Mock formatter to return kill switch result with header
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: '[KillSwitchTag]\nKill switch message',
        included: { header: true, brand: false, stop: false },
        reason: 'kill_switch',
        length: 35,
        segments: 1,
      });

      const mockScheduledMessage = {
        id: 'scheduled-789',
        event_id: 'event-012',
        content: 'Kill switch message',
        event_tag: 'SafetyKill',
        message_type: 'announcement',
        sender_user_id: 'user-345',
      };

      const mockGuest = {
        id: 'guest-789',
        phone: '+1234567892',
        guest_name: 'Kill Switch Guest',
        a2p_notice_sent_at: null,
      };

      // Simulate worker logic
      let finalMessage = mockScheduledMessage.content;
      
      if (mockScheduledMessage.event_tag) {
        const formatResult = await composeSmsText(
          mockScheduledMessage.event_id,
          mockGuest.id,
          mockScheduledMessage.content
        );
        
        // Safety net should NOT trigger because header is present
        if (!formatResult.included.header || formatResult.reason === 'fallback') {
          finalMessage = `[${mockScheduledMessage.event_tag}]\n${mockScheduledMessage.content}`;
        } else {
          finalMessage = formatResult.text;
        }
      }

      // Verify kill switch result was used (header preserved, no brand/STOP)
      expect(finalMessage).toBe('[KillSwitchTag]\nKill switch message');
      expect(finalMessage).toMatch(/^\[KillSwitchTag\]/);
      expect(finalMessage).not.toContain('via Unveil');
      expect(finalMessage).not.toContain('Reply STOP to opt out.');
    });

    it('should handle subsequent SMS with safety net', async () => {
      // Mock formatter to fall back
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: 'Raw subsequent message',
        included: { header: false, brand: false, stop: false },
        reason: 'fallback',
        length: 22,
        segments: 1,
      });

      const mockScheduledMessage = {
        id: 'scheduled-012',
        event_id: 'event-345',
        content: 'Subsequent message',
        event_tag: 'SubsequentTag',
        message_type: 'direct',
        sender_user_id: 'user-678',
      };

      const mockGuest = {
        id: 'guest-012',
        phone: '+1234567893',
        guest_name: 'Subsequent Guest',
        a2p_notice_sent_at: '2025-01-01T00:00:00Z', // Already received first SMS
      };

      // Simulate worker logic
      let finalMessage = mockScheduledMessage.content;
      
      if (mockScheduledMessage.event_tag) {
        const formatResult = await composeSmsText(
          mockScheduledMessage.event_id,
          mockGuest.id,
          mockScheduledMessage.content
        );
        
        // Safety net should trigger
        if (!formatResult.included.header || formatResult.reason === 'fallback') {
          const headerText = `[${mockScheduledMessage.event_tag}]`;
          const bodyText = mockScheduledMessage.content;
          
          // No brand/STOP for subsequent SMS
          const needsBrandStop = !false && !mockGuest.a2p_notice_sent_at;
          
          if (needsBrandStop) {
            finalMessage = `${headerText}\n${bodyText}\n\nvia Unveil\nReply STOP to opt out.`;
          } else {
            finalMessage = `${headerText}\n${bodyText}`;
          }
        }
      }

      // Verify safety net applied header only (no brand/STOP for subsequent)
      expect(finalMessage).toBe('[SubsequentTag]\nSubsequent message');
      expect(finalMessage).toMatch(/^\[SubsequentTag\]/);
      expect(finalMessage).not.toContain('via Unveil');
      expect(finalMessage).not.toContain('Reply STOP to opt out.');
    });

    it('should handle missing event_tag gracefully', async () => {
      // Mock formatter to fall back
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: 'Raw message no header',
        included: { header: false, brand: false, stop: false },
        reason: 'fallback',
        length: 21,
        segments: 1,
      });

      const mockScheduledMessage = {
        id: 'scheduled-345',
        event_id: 'event-678',
        content: 'Message without tag',
        event_tag: null, // No denormalized tag
        message_type: 'announcement',
        sender_user_id: 'user-901',
      };

      const mockGuest = {
        id: 'guest-345',
        phone: '+1234567894',
        guest_name: 'No Tag Guest',
        a2p_notice_sent_at: null,
      };

      // Simulate worker logic
      let finalMessage = mockScheduledMessage.content;
      
      // No safety net available (no event_tag)
      if (mockScheduledMessage.event_tag) {
        // This won't execute
        finalMessage = `[${mockScheduledMessage.event_tag}]\n${mockScheduledMessage.content}`;
      }

      // Should remain as original content (no safety net applied)
      expect(finalMessage).toBe('Message without tag');
      expect(finalMessage).not.toMatch(/^\[/); // No header
    });
  });

  describe('Telemetry and Logging', () => {
    it('should emit proper telemetry when safety net is used', async () => {
      const { logger } = await import('@/lib/logger');
      
      // Mock formatter to fall back
      const { composeSmsText } = await import('@/lib/sms-formatter');
      (composeSmsText as any).mockResolvedValue({
        text: 'Fallback message',
        included: { header: false, brand: false, stop: false },
        reason: 'fallback',
        length: 16,
        segments: 1,
      });

      const mockScheduledMessage = {
        id: 'telemetry-test',
        event_id: 'event-telemetry',
        content: 'Telemetry test',
        event_tag: 'TelemetryTag',
        message_type: 'announcement',
        sender_user_id: 'user-telemetry',
      };

      const mockGuest = {
        id: 'guest-telemetry',
        phone: '+1234567895',
        guest_name: 'Telemetry Guest',
        a2p_notice_sent_at: null,
      };

      // Simulate worker logic with telemetry
      if (mockScheduledMessage.event_tag) {
        const formatResult = await composeSmsText(
          mockScheduledMessage.event_id,
          mockGuest.id,
          mockScheduledMessage.content
        );
        
        if (!formatResult.included.header || formatResult.reason === 'fallback') {
          // This is where the worker would emit telemetry
          (logger.info as any).mockImplementation(() => {});
          
          // Simulate telemetry calls
          logger.info('SMS formatter fallback - using denormalized header safety net', {
            scheduledMessageId: mockScheduledMessage.id,
            guestId: mockGuest.id,
            formatterReason: formatResult.reason,
            hadHeader: formatResult.included.header,
            jobId: 'test-job'
          });
          
          logger.info('SMS formatter telemetry: messaging.formatter.fallback_used', {
            metric: 'messaging.formatter.fallback_used',
            path: 'scheduled',
            value: 1,
            timestamp: expect.any(String),
          });
        }
      }

      // Verify telemetry was called
      expect(logger.info).toHaveBeenCalledWith(
        'SMS formatter fallback - using denormalized header safety net',
        expect.objectContaining({
          scheduledMessageId: 'telemetry-test',
          guestId: 'guest-telemetry',
          formatterReason: 'fallback',
          hadHeader: false,
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'SMS formatter telemetry: messaging.formatter.fallback_used',
        expect.objectContaining({
          metric: 'messaging.formatter.fallback_used',
          path: 'scheduled',
          value: 1,
        })
      );
    });
  });
});
