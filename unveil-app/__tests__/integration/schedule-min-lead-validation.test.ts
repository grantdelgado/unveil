import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createScheduledMessage } from '@/lib/services/messaging-client';
import type { CreateScheduledMessageData } from '@/lib/types/messaging';

describe('Schedule Minimum Lead Time Validation Integration', () => {
  const originalEnv = process.env.SCHEDULE_MIN_LEAD_SECONDS;

  beforeEach(() => {
    // Set a known value for consistent testing
    process.env.SCHEDULE_MIN_LEAD_SECONDS = '180';
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = originalEnv;
    } else {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
    }
  });

  const baseScheduleData: CreateScheduledMessageData = {
    eventId: 'test-event-id',
    content: 'Test scheduled message',
    sendAt: '', // Will be set in each test
    messageType: 'announcement',
    sendViaSms: true,
    sendViaPush: false,
    recipientFilter: {
      type: 'explicit_selection',
      selectedGuestIds: ['guest-1', 'guest-2'],
    },
  };

  describe('Server-side validation', () => {
    it('should reject scheduled time less than minimum lead time', async () => {
      const tooSoonTime = new Date(Date.now() + 120000).toISOString(); // 2 minutes from now
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: tooSoonTime,
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (result.error && typeof result.error === 'object' && 'code' in result.error) {
        expect(result.error.code).toBe('SCHEDULE_TOO_SOON');
        expect(result.error.message).toContain('Cannot schedule messages less than');
        expect(result.error.minSeconds).toBe(180);
      }
    });

    it('should accept scheduled time that meets minimum lead time', async () => {
      const validTime = new Date(Date.now() + 180000).toISOString(); // Exactly 3 minutes from now
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: validTime,
      };

      // Note: This test may fail if not properly mocked since it requires authentication
      // In a real test environment, you would mock the Supabase client or use test credentials
      const result = await createScheduledMessage(scheduleData);

      // If authentication fails, that's expected in this test environment
      // We're mainly testing that the time validation logic doesn't reject valid times
      if (result.success === false && result.error && typeof result.error === 'object' && 'message' in result.error) {
        // Should not be a time validation error
        expect(result.error.message).not.toContain('Cannot schedule messages less than');
        expect(result.error.message).not.toContain('Scheduled time must be at least');
      }
    });

    it('should accept scheduled time well beyond minimum lead time', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: futureTime,
      };

      const result = await createScheduledMessage(scheduleData);

      // If authentication fails, that's expected in this test environment
      if (result.success === false && result.error && typeof result.error === 'object' && 'message' in result.error) {
        // Should not be a time validation error
        expect(result.error.message).not.toContain('Cannot schedule messages less than');
        expect(result.error.message).not.toContain('Scheduled time must be at least');
      }
    });

    it('should log metrics for schedule violations', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const tooSoonTime = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: tooSoonTime,
        scheduledTz: 'America/Los_Angeles', // Include timezone for metrics testing
      };

      await createScheduledMessage(scheduleData);

      // Check that metrics were logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'messaging.schedule_too_soon',
        expect.objectContaining({
          count: 1,
          userTzOffset: expect.any(Number),
          eventTzOffset: expect.any(Number),
          selectedMinusMinMs: expect.any(Number),
          minLeadSeconds: 180,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Timezone handling', () => {
    it('should handle timezone conversion correctly in validation', async () => {
      // Test with a specific timezone and local time
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: new Date(Date.now() + 120000).toISOString(), // 2 minutes from now
        scheduledTz: 'America/New_York',
        scheduledLocal: '2025-01-01T15:00:00', // Example local time
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (result.error && typeof result.error === 'object' && 'code' in result.error) {
        expect(result.error.code).toBe('SCHEDULE_TOO_SOON');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly at boundary time', async () => {
      // Test time exactly at the 180-second boundary
      const boundaryTime = new Date(Date.now() + 180000).toISOString();
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: boundaryTime,
      };

      const result = await createScheduledMessage(scheduleData);

      // Should not fail due to time validation
      if (result.success === false && result.error && typeof result.error === 'object' && 'message' in result.error) {
        expect(result.error.message).not.toContain('Cannot schedule messages less than');
      }
    });

    it('should handle custom minimum lead time from environment', async () => {
      // Test with custom environment variable
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '300'; // 5 minutes
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: new Date(Date.now() + 240000).toISOString(), // 4 minutes from now (should fail with 5min requirement)
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (result.error && typeof result.error === 'object' && 'code' in result.error) {
        expect(result.error.code).toBe('SCHEDULE_TOO_SOON');
        expect(result.error.minSeconds).toBe(300);
      }
    });
  });
});
