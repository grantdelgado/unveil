import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getScheduleMinLeadSeconds,
  getScheduleMinLeadMs,
  isValidScheduleTime,
  getNextValidScheduleTime,
  formatMinLeadTime,
} from '@/config/schedule';

describe('Schedule Configuration', () => {
  const originalEnv = process.env.SCHEDULE_MIN_LEAD_SECONDS;

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = originalEnv;
    } else {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
    }
  });

  describe('getScheduleMinLeadSeconds', () => {
    it('should return default 180 seconds when no env var is set', () => {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
      expect(getScheduleMinLeadSeconds()).toBe(180);
    });

    it('should return custom value from environment variable', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '300';
      expect(getScheduleMinLeadSeconds()).toBe(300);
    });

    it('should handle invalid env var by falling back to default', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = 'invalid';
      expect(getScheduleMinLeadSeconds()).toBe(180);
    });
  });

  describe('getScheduleMinLeadMs', () => {
    it('should return milliseconds equivalent of seconds', () => {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
      expect(getScheduleMinLeadMs()).toBe(180000); // 180 * 1000
    });

    it('should handle custom values correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '60';
      expect(getScheduleMinLeadMs()).toBe(60000);
    });
  });

  describe('isValidScheduleTime', () => {
    beforeEach(() => {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS; // Use default 180s
    });

    it('should reject times less than minimum lead time', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const tooSoon = new Date('2025-01-01T12:02:00Z'); // 2 minutes later (< 3 min required)
      
      expect(isValidScheduleTime(tooSoon.toISOString(), now)).toBe(false);
    });

    it('should accept times that meet minimum lead time', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const validTime = new Date('2025-01-01T12:03:00Z'); // Exactly 3 minutes later
      
      expect(isValidScheduleTime(validTime.toISOString(), now)).toBe(true);
    });

    it('should accept times well beyond minimum lead time', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const futureTime = new Date('2025-01-01T15:00:00Z'); // 3 hours later
      
      expect(isValidScheduleTime(futureTime.toISOString(), now)).toBe(true);
    });

    it('should use current time when nowUtc is not provided', () => {
      const futureTime = new Date(Date.now() + 300000); // 5 minutes from now
      expect(isValidScheduleTime(futureTime.toISOString())).toBe(true);
    });
  });

  describe('getNextValidScheduleTime', () => {
    beforeEach(() => {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS; // Use default 180s
    });

    it('should return time exactly minimum lead time from now', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const nextValid = getNextValidScheduleTime(now);
      const expected = new Date('2025-01-01T12:03:00Z'); // 3 minutes later
      
      expect(nextValid.getTime()).toBe(expected.getTime());
    });

    it('should use current time when nowUtc is not provided', () => {
      const before = Date.now();
      const nextValid = getNextValidScheduleTime();
      const after = Date.now();
      
      // Should be approximately 180 seconds from now
      const expectedMin = before + 180000;
      const expectedMax = after + 180000;
      
      expect(nextValid.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextValid.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('formatMinLeadTime', () => {
    it('should format seconds correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '30';
      expect(formatMinLeadTime()).toBe('30 seconds');
    });

    it('should format single second correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '1';
      expect(formatMinLeadTime()).toBe('1 second');
    });

    it('should format minutes correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '120';
      expect(formatMinLeadTime()).toBe('2 minutes');
    });

    it('should format single minute correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '60';
      expect(formatMinLeadTime()).toBe('1 minute');
    });

    it('should format minutes and seconds correctly', () => {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = '150';
      expect(formatMinLeadTime()).toBe('2m 30s');
    });

    it('should format default 180 seconds as minutes', () => {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
      expect(formatMinLeadTime()).toBe('3 minutes');
    });
  });
});
