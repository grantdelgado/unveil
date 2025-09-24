/**
 * SMS Formatter Contract Tests
 * 
 * Tests the enhanced formatter contract with explicit signals for header/brand/stop inclusion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { composeSmsText } from '@/lib/sms-formatter';
import { supabase } from '@/src/test/setup';

describe('SMS Formatter Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variable (default to branding enabled)
    delete process.env.SMS_BRANDING_DISABLED;
  });

  describe('Enhanced Contract Fields', () => {
    it('should include explicit signals in result', async () => {
      // Mock successful event and guest fetch
      supabase.from.mockImplementation((table: string) => {
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
        } else if (table === 'event_guests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { a2p_notice_sent_at: null }, // First-time recipient
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Verify new contract fields exist
      expect(result).toHaveProperty('included');
      expect(result.included).toHaveProperty('header');
      expect(result.included).toHaveProperty('brand');
      expect(result.included).toHaveProperty('stop');
      
      // Verify first SMS includes all elements
      expect(result.included.header).toBe(true);
      expect(result.included.brand).toBe(true);
      expect(result.included.stop).toBe(true);
      expect(result.reason).toBeUndefined(); // No fallback
    });

    it('should indicate subsequent SMS correctly', async () => {
      // Mock returning recipient
      supabase.from.mockImplementation((table: string) => {
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
        } else if (table === 'event_guests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { a2p_notice_sent_at: '2025-01-01T00:00:00Z' }, // Returning recipient
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Subsequent SMS should have header only
      expect(result.included.header).toBe(true);
      expect(result.included.brand).toBe(false);
      expect(result.included.stop).toBe(false);
    });
  });

  describe('Kill Switch Behavior', () => {
    it('should preserve header when kill switch is active', async () => {
      // Enable kill switch
      process.env.SMS_BRANDING_DISABLED = 'true';
      
      // Mock event fetch (still needed for header)
      supabase.from.mockImplementation((table: string) => {
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

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Kill switch should preserve header but remove brand/STOP
      expect(result.included.header).toBe(true);
      expect(result.included.brand).toBe(false);
      expect(result.included.stop).toBe(false);
      expect(result.reason).toBe('kill_switch');
      
      // Text should still have header
      expect(result.text).toMatch(/^\[TestEvent\]/);
      expect(result.text).toContain('Test message');
      expect(result.text).not.toContain('via Unveil');
      expect(result.text).not.toContain('Reply STOP');
    });
  });

  describe('Fallback Scenarios', () => {
    it('should indicate fallback when event fetch fails', async () => {
      // Mock event fetch failure
      supabase.from.mockImplementation((table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: null, 
                  error: { message: 'Event not found' } 
                }),
              }),
            }),
          };
        }
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Fallback should have no formatting
      expect(result.included.header).toBe(false);
      expect(result.included.brand).toBe(false);
      expect(result.included.stop).toBe(false);
      expect(result.reason).toBe('fallback');
      expect(result.text).toBe('Test message'); // Raw message
    });
  });

  describe('Regression Protection', () => {
    it('should never use fallback in normal operation', async () => {
      // Mock successful operation
      supabase.from.mockImplementation((table: string) => {
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
        } else if (table === 'event_guests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { a2p_notice_sent_at: null },
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Should never fallback in normal operation
      expect(result.reason).not.toBe('fallback');
      expect(result.included.header).toBe(true);
    });

    it('should always include header when kill switch is off', async () => {
      // Ensure kill switch is off
      process.env.SMS_BRANDING_DISABLED = 'false';
      
      // Mock successful operation
      supabase.from.mockImplementation((table: string) => {
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
        } else if (table === 'event_guests') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { a2p_notice_sent_at: null },
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      const result = await composeSmsText('event-123', 'guest-456', 'Test message');

      // Header must be included when kill switch is off
      expect(result.included.header).toBe(true);
      expect(result.reason).not.toBe('kill_switch');
    });
  });
});
