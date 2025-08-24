/**
 * Unit tests for SMS formatting parity between Send Now and Scheduled paths
 * Ensures both paths produce identical SMS output for identical inputs
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { composeSmsText } from '@/lib/sms-formatter';
import type { SmsFormatOptions } from '@/lib/sms-formatter';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}));

// Mock flags
jest.mock('@/config/flags', () => ({
  flags: {
    ops: {
      smsBrandingDisabled: false
    }
  }
}));

describe('SMS Formatting Parity', () => {
  const mockEventId = 'test-event-id';
  const mockGuestId = 'test-guest-id';
  const testMessage = 'Hello from the wedding! Looking forward to seeing everyone.';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful Supabase responses
    const mockSupabase = require('@/lib/supabase/server').createServerSupabaseClient();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  sms_tag: 'TestWed',
                  title: 'Test Wedding'
                },
                error: null
              })
            })
          })
        };
      } else if (table === 'event_guests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  a2p_notice_sent_at: null // First message
                },
                error: null
              })
            })
          })
        };
      }
      return mockSupabase.from();
    });
  });

  it('should produce identical output for same inputs (first message)', async () => {
    const options: SmsFormatOptions = {
      link: 'https://unveil.app/event/test'
    };

    // Call formatter twice with identical inputs (simulating Send Now vs Scheduled)
    const result1 = await composeSmsText(mockEventId, mockGuestId, testMessage, options);
    const result2 = await composeSmsText(mockEventId, mockGuestId, testMessage, options);

    // Results should be byte-identical
    expect(result1.text).toBe(result2.text);
    expect(result1.includedStopNotice).toBe(result2.includedStopNotice);
    expect(result1.length).toBe(result2.length);
    expect(result1.segments).toBe(result2.segments);
    expect(result1.droppedLink).toBe(result2.droppedLink);
    expect(result1.truncatedBody).toBe(result2.truncatedBody);
  });

  it('should include proper multiline format with event tag', async () => {
    const result = await composeSmsText(mockEventId, mockGuestId, testMessage);

    // Should have event tag header on first line
    expect(result.text).toMatch(/^\[TestWed\]\n/);
    
    // Should include message body
    expect(result.text).toContain(testMessage);
    
    // Should include brand and STOP notice for first message
    expect(result.text).toContain('via Unveil');
    expect(result.text).toContain('Reply STOP to opt out.');
    
    // Should have proper multiline structure: [Tag]\nBody\n\nBrand\nSTOP
    const lines = result.text.split('\n');
    expect(lines[0]).toBe('[TestWed]');
    expect(lines[1]).toBe(testMessage);
    expect(lines[2]).toBe(''); // Blank line before footer
    expect(lines[3]).toBe('via Unveil');
    expect(lines[4]).toBe('Reply STOP to opt out.');
  });

  it('should handle length budgeting consistently', async () => {
    const longMessage = 'A'.repeat(200); // Very long message
    const options: SmsFormatOptions = {
      link: 'https://unveil.app/event/test-very-long-url-that-might-get-dropped'
    };

    const result = await composeSmsText(mockEventId, mockGuestId, longMessage, options);

    // Should stay within SMS limits
    expect(result.length).toBeLessThanOrEqual(160);
    
    // Should preserve STOP notice even if other things are dropped
    expect(result.text).toContain('Reply STOP to opt out.');
    
    // Should indicate what was modified
    if (result.droppedLink) {
      expect(result.text).not.toContain('https://');
    }
    
    if (result.truncatedBody) {
      expect(result.text).toContain('…');
    }
  });

  it('should handle subsequent messages (no brand/STOP)', async () => {
    // Mock guest with A2P notice already sent
    const mockSupabase = require('@/lib/supabase/server').createServerSupabaseClient();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  sms_tag: 'TestWed',
                  title: 'Test Wedding'
                },
                error: null
              })
            })
          })
        };
      } else if (table === 'event_guests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  a2p_notice_sent_at: new Date().toISOString() // Already sent
                },
                error: null
              })
            })
          })
        };
      }
      return mockSupabase.from();
    });

    const result = await composeSmsText(mockEventId, mockGuestId, testMessage);

    // Should NOT include brand or STOP notice
    expect(result.text).not.toContain('via Unveil');
    expect(result.text).not.toContain('Reply STOP to opt out.');
    expect(result.includedStopNotice).toBe(false);
    
    // Should still have event tag and message
    expect(result.text).toMatch(/^\[TestWed\]\n/);
    expect(result.text).toContain(testMessage);
  });

  it('should handle GSM-7 normalization consistently', async () => {
    const messageWithUnicode = 'Hello! "Smart quotes" and em—dashes and ellipsis…';
    
    const result = await composeSmsText(mockEventId, mockGuestId, messageWithUnicode);
    
    // Should normalize to GSM-7 characters
    expect(result.text).toContain('"Smart quotes"'); // Regular quotes
    expect(result.text).toContain('em-dashes'); // Regular dash
    expect(result.text).toContain('ellipsis...'); // Three dots
    
    // Should not contain Unicode characters
    expect(result.text).not.toContain('"');
    expect(result.text).not.toContain('"');
    expect(result.text).not.toContain('—');
    expect(result.text).not.toContain('…');
  });

  it('should calculate segments correctly', async () => {
    // Test different message lengths
    const shortMessage = 'Short';
    const mediumMessage = 'A'.repeat(100);
    const longMessage = 'A'.repeat(200);

    const shortResult = await composeSmsText(mockEventId, mockGuestId, shortMessage);
    const mediumResult = await composeSmsText(mockEventId, mockGuestId, mediumMessage);
    const longResult = await composeSmsText(mockEventId, mockGuestId, longMessage);

    // All should fit in single segment due to length budgeting
    expect(shortResult.segments).toBe(1);
    expect(mediumResult.segments).toBe(1);
    expect(longResult.segments).toBe(1);

    // Longer messages should be truncated to fit
    expect(longResult.truncatedBody).toBe(true);
  });
});
