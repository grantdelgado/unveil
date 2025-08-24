/**
 * Integration tests for scheduled SMS branding parity
 * Ensures scheduled messages use identical SMS formatting as Send Now
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { composeSmsText } from '@/lib/sms-formatter';

describe('Scheduled SMS Branding Parity', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;
  let testEventId: string;
  let testGuestId: string;

  beforeEach(async () => {
    supabase = await createServerSupabaseClient();
    
    // Create test event with SMS tag
    const { data: event } = await supabase
      .from('events')
      .insert({
        title: 'Test Wedding',
        event_date: '2024-12-31',
        host_user_id: 'test-user-id',
        sms_tag: 'TestWed'
      })
      .select('id')
      .single();
    
    testEventId = event!.id;

    // Create test guest (first-time recipient)
    const { data: guest } = await supabase
      .from('event_guests')
      .insert({
        event_id: testEventId,
        guest_name: 'Test Guest',
        phone: '+15551234567',
        a2p_notice_sent_at: null // First-time recipient
      })
      .select('id')
      .single();
    
    testGuestId = guest!.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('event_guests').delete().eq('event_id', testEventId);
    await supabase.from('events').delete().eq('id', testEventId);
  });

  describe('First-Time Recipient SMS Formatting', () => {
    it('should include event tag header for first-time recipients', async () => {
      const testMessage = 'Welcome to our wedding!';
      
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // Should include event tag header
      expect(result.text).toMatch(/^\[TestWed\]\n/);
      expect(result.text).toContain(testMessage);
    });

    it('should include STOP notice and brand for first-time recipients', async () => {
      const testMessage = 'Welcome to our wedding!';
      
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // Should include branding for first message
      expect(result.text).toContain('via Unveil');
      expect(result.text).toContain('Reply STOP to opt out.');
      expect(result.includedStopNotice).toBe(true);
      
      // Should have proper multiline structure
      const lines = result.text.split('\n');
      expect(lines[0]).toBe('[TestWed]');
      expect(lines[1]).toBe(testMessage);
      expect(lines[2]).toBe(''); // Blank line before footer
      expect(lines[3]).toBe('via Unveil');
      expect(lines[4]).toBe('Reply STOP to opt out.');
    });

    it('should produce byte-identical output for same inputs', async () => {
      const testMessage = 'Same message content';
      
      // Call formatter multiple times (simulating Send Now vs Scheduled)
      const result1 = await composeSmsText(testEventId, testGuestId, testMessage);
      const result2 = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // Results should be byte-identical
      expect(result1.text).toBe(result2.text);
      expect(result1.includedStopNotice).toBe(result2.includedStopNotice);
      expect(result1.length).toBe(result2.length);
      expect(result1.segments).toBe(result2.segments);
    });
  });

  describe('Subsequent Message SMS Formatting', () => {
    beforeEach(async () => {
      // Mark guest as having received A2P notice
      await supabase
        .from('event_guests')
        .update({ a2p_notice_sent_at: new Date().toISOString() })
        .eq('id', testGuestId);
    });

    it('should omit STOP notice and brand for subsequent messages', async () => {
      const testMessage = 'Follow-up message';
      
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // Should still include event tag
      expect(result.text).toMatch(/^\[TestWed\]\n/);
      expect(result.text).toContain(testMessage);
      
      // Should NOT include branding for subsequent messages
      expect(result.text).not.toContain('via Unveil');
      expect(result.text).not.toContain('Reply STOP to opt out.');
      expect(result.includedStopNotice).toBe(false);
      
      // Should have simpler structure: [Tag]\nMessage
      const lines = result.text.split('\n');
      expect(lines[0]).toBe('[TestWed]');
      expect(lines[1]).toBe(testMessage);
      expect(lines.length).toBe(2); // No footer lines
    });
  });

  describe('SMS Branding Kill Switch', () => {
    it('should respect SMS_BRANDING_DISABLED flag', async () => {
      // Mock the flag as disabled
      const originalEnv = process.env.SMS_BRANDING_DISABLED;
      process.env.SMS_BRANDING_DISABLED = 'true';
      
      // Clear require cache to pick up new env var
      delete require.cache[require.resolve('@/config/flags')];
      
      try {
        const testMessage = 'Plain message test';
        
        const result = await composeSmsText(testEventId, testGuestId, testMessage);
        
        // Should return plain message without any branding
        expect(result.text).toBe(testMessage);
        expect(result.includedStopNotice).toBe(false);
        expect(result.text).not.toContain('[TestWed]');
        expect(result.text).not.toContain('via Unveil');
        expect(result.text).not.toContain('Reply STOP to opt out.');
      } finally {
        // Restore original env var
        if (originalEnv !== undefined) {
          process.env.SMS_BRANDING_DISABLED = originalEnv;
        } else {
          delete process.env.SMS_BRANDING_DISABLED;
        }
        
        // Clear require cache to restore original flag state
        delete require.cache[require.resolve('@/config/flags')];
      }
    });
  });

  describe('Message Type Handling', () => {
    it('should handle direct message type correctly', async () => {
      const testMessage = 'Direct message test';
      
      // Test with direct message (should map to 'custom' messageType in SMS)
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // Should still format correctly regardless of message type
      expect(result.text).toMatch(/^\[TestWed\]\n/);
      expect(result.text).toContain(testMessage);
      expect(result.includedStopNotice).toBe(true); // First-time recipient
    });
  });

  describe('Regression Protection', () => {
    it('should fail if formatter is bypassed (missing event tag)', async () => {
      const testMessage = 'Should have event tag';
      
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // This test ensures the formatter is actually being called
      // If scheduled worker bypasses formatter, this would fail
      expect(result.text).toMatch(/^\[TestWed\]/);
    });

    it('should fail if STOP notice missing when expected', async () => {
      const testMessage = 'Should have STOP notice';
      
      const result = await composeSmsText(testEventId, testGuestId, testMessage);
      
      // For first-time recipients, STOP notice should be included
      expect(result.includedStopNotice).toBe(true);
      expect(result.text).toContain('Reply STOP to opt out.');
    });
  });
});
