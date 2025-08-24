/**
 * Unit tests for SMS formatter utility
 * Tests event tag generation, A2P footer logic, and length budgeting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { composeSmsText, markA2pNoticeSent } from '@/lib/sms-formatter';
import { mockSupabaseClient } from '@/src/test/setup';

describe('SMS Formatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variable (default to branding enabled)
    delete process.env.SMS_BRANDING_DISABLED;
  });

  describe('Kill Switch', () => {
    it('should preserve header but remove brand/STOP when kill switch is enabled', async () => {
      process.env.SMS_BRANDING_DISABLED = 'true';
      
      // Mock event data for header generation
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { sms_tag: 'TestEvent', title: 'Test Event' }, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });
      
      const result = await composeSmsText('event-123', 'guest-456', 'Hello world!');
      
      // Kill switch should preserve header but remove brand/STOP
      expect(result.included.header).toBe(true);
      expect(result.included.brand).toBe(false);
      expect(result.included.stop).toBe(false);
      expect(result.reason).toBe('kill_switch');
      expect(result.text).toMatch(/^\[TestEvent\]/);
      expect(result.text).toContain('Hello world!');
      expect(result.includedStopNotice).toBe(false);
    });
  });

  describe('Event Tag Generation', () => {
    it('should use custom sms_tag when provided', async () => {
      // Mock successful event lookup with custom tag
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValueOnce({
              data: { sms_tag: 'CustomTag', title: 'My Wedding' },
              error: null,
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', undefined, 'Hello!');
      
      expect(result.text).toBe('[CustomTag]\nHello!');
      expect(result.includedStopNotice).toBe(false);
    });

    it('should generate tag from event title when sms_tag is empty', async () => {
      // Mock event lookup returning empty sms_tag
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First call: event lookup
                return Promise.resolve({
                  data: { sms_tag: '', title: 'Sarah & David Wedding' },
                  error: null,
                });
              } else {
                // Second call: guest lookup
                return Promise.resolve({
                  data: null,
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', undefined, 'Hello!');
      
      expect(result.text).toBe('[Sarah+Dav+Wed]\nHello!');
    });

    it('should handle single word title', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: null, title: 'Wedding' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: null,
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', undefined, 'Hello!');
      
      expect(result.text).toBe('[Wedding]\nHello!');
    });

    it('should limit tag length to 14 characters', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'VeryLongEventTagName', title: 'Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: null,
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', undefined, 'Hello!');
      
      expect(result.text).toBe('[VeryLongEventT]\nHello!');
      expect(result.text.split(']')[0].length).toBe(15); // [VeryLongEventT] = 15 chars
    });
  });

  describe('A2P Footer Logic', () => {
    it('should include STOP notice for first SMS to guest', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'Test', title: 'Test Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: { a2p_notice_sent_at: null },
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Hello!');
      
      expect(result.text).toBe('[Test]\nHello!\n\nvia Unveil\nReply STOP to opt out.');
      expect(result.includedStopNotice).toBe(true);
    });

    it('should not include STOP notice for subsequent SMS to guest', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'Test', title: 'Test Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: { a2p_notice_sent_at: '2024-01-01T12:00:00Z' },
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Hello!');
      
      expect(result.text).toBe('[Test]\nHello!');
      expect(result.includedStopNotice).toBe(false);
    });

    it('should not include STOP notice when no guestId provided', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'Test', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', undefined, 'Hello!');
      
      expect(result.text).toBe('[Test]\nHello!');
      expect(result.includedStopNotice).toBe(false);
    });
  });

  describe('GSM-7 Normalization', () => {
    it('should normalize smart quotes and dashes', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'Test', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });

      const result = await composeSmsText(
        'event-123',
        undefined,
        'Hello "world" — this is a test with \'smart quotes\'…'
      );
      
      expect(result.text).toBe('[Test]\nHello "world" - this is a test with \'smart quotes\'...');
    });

    it('should remove emojis and non-GSM-7 characters', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'Test', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });

      const result = await composeSmsText(
        'event-123',
        undefined,
        'Hello 🎉 world! ñoël'
      );
      
      expect(result.text).toBe('[Test]\nHello world! ol');
    });
  });

  describe('Length Budget Management', () => {
    it('should preserve single segment messages', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'Test', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });

      const shortMessage = 'Hello world!';
      const result = await composeSmsText('event-123', undefined, shortMessage);
      
      expect(result.text).toBe('[Test]\nHello world!');
      expect(result.segments).toBe(1);
      expect(result.length).toBeLessThanOrEqual(160);
    });

    it('should include brand line in first message with STOP notice', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'Test', title: 'Test Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: { a2p_notice_sent_at: null },
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Short message');
      
      expect(result.text).toBe('[Test]\nShort message\n\nvia Unveil\nReply STOP to opt out.');
      expect(result.includedStopNotice).toBe(true);
    });

    it('should drop link first when over length budget', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'Test', title: 'Test Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: { a2p_notice_sent_at: null },
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const longMessage = 'A'.repeat(120); // Long but fits with tag + STOP
      const result = await composeSmsText(
        'event-123',
        'guest-456',
        longMessage,
        { link: 'https://example.com/very-long-link' }
      );
      
      expect(result.text).not.toContain('https://example.com/very-long-link');
      expect(result.text).toContain('\n\nReply STOP to opt out.');
      expect(result.droppedLink).toBe(true);
      // Brand line may be dropped for long messages to preserve STOP notice
      expect(result.segments).toBe(1);
    });

    it('should truncate body when necessary', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: { sms_tag: 'Test', title: 'Test Event' },
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: { a2p_notice_sent_at: null },
                  error: null,
                });
              }
            }),
          }),
        }),
      });

      const veryLongMessage = 'A'.repeat(200);
      const result = await composeSmsText('event-123', 'guest-456', veryLongMessage);
      
      expect(result.text).toContain('…');
      expect(result.text).toContain('\n\nReply STOP to opt out.');
      expect(result.truncatedBody).toBe(true);
      expect(result.segments).toBe(1);
      expect(result.length).toBeLessThanOrEqual(160);
    });
  });

  describe('Segment Calculation', () => {
    it('should calculate segments correctly', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'Test', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });

      // Single segment
      let result = await composeSmsText('event-123', undefined, 'Short');
      expect(result.segments).toBe(1);

      // Two segments would be over 160 chars, but our formatter keeps it to 1 segment
      const longMessage = 'A'.repeat(200);
      result = await composeSmsText('event-123', undefined, longMessage);
      expect(result.segments).toBe(1); // Formatter truncates to keep single segment
    });
  });

  describe('Error Handling', () => {
    it('should fallback to unformatted message on database error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Hello!');
      
      expect(result).toEqual({
        text: 'Hello!',
        includedStopNotice: false,
        length: 6,
        segments: 1,
        droppedLink: false,
        truncatedBody: false,
        included: { header: false, brand: false, stop: false },
        reason: 'fallback',
      });
    });

    it('should fallback to unformatted message when event not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Event not found' },
            }),
          }),
        }),
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Hello!');
      
      expect(result.text).toBe('Hello!');
    });
  });

  describe('markA2pNoticeSent', () => {
    it('should call the database function correctly', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        error: null,
      });

      await markA2pNoticeSent('event-123', 'guest-456');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('mark_a2p_notice_sent', {
        _event_id: 'event-123',
        _guest_id: 'guest-456',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        error: { message: 'Database error' },
      });

      // Should not throw
      await expect(markA2pNoticeSent('event-123', 'guest-456')).resolves.not.toThrow();
    });
  });
});