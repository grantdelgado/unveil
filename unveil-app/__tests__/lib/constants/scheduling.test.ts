import { describe, it, expect } from 'vitest';
import {
  MIN_SCHEDULE_BUFFER_MINUTES,
  QUICK_SET_BUFFER_MINUTES,
  minutesToMs,
  roundUpToMinute,
  addMinutes,
} from '@/lib/constants/scheduling';

describe('Scheduling Constants', () => {
  describe('Buffer constants', () => {
    it('should have correct validation buffer', () => {
      expect(MIN_SCHEDULE_BUFFER_MINUTES).toBe(3);
    });

    it('should have correct quick action buffer', () => {
      expect(QUICK_SET_BUFFER_MINUTES).toBe(5);
    });

    it('should have quick action buffer greater than validation buffer', () => {
      expect(QUICK_SET_BUFFER_MINUTES).toBeGreaterThan(MIN_SCHEDULE_BUFFER_MINUTES);
    });
  });

  describe('minutesToMs', () => {
    it('should convert minutes to milliseconds correctly', () => {
      expect(minutesToMs(1)).toBe(60 * 1000);
      expect(minutesToMs(3)).toBe(3 * 60 * 1000);
      expect(minutesToMs(5)).toBe(5 * 60 * 1000);
    });

    it('should handle zero minutes', () => {
      expect(minutesToMs(0)).toBe(0);
    });

    it('should handle fractional minutes', () => {
      expect(minutesToMs(1.5)).toBe(90 * 1000);
    });
  });

  describe('roundUpToMinute', () => {
    it('should round up when seconds > 0', () => {
      const date = new Date('2025-01-01T12:00:30Z'); // 30 seconds
      const rounded = roundUpToMinute(date);
      
      expect(rounded.getMinutes()).toBe(1);
      expect(rounded.getSeconds()).toBe(0);
      expect(rounded.getMilliseconds()).toBe(0);
    });

    it('should round up when milliseconds > 0', () => {
      const date = new Date('2025-01-01T12:00:00.500Z'); // 500ms
      const rounded = roundUpToMinute(date);
      
      expect(rounded.getMinutes()).toBe(1);
      expect(rounded.getSeconds()).toBe(0);
      expect(rounded.getMilliseconds()).toBe(0);
    });

    it('should not change time when already at exact minute', () => {
      const date = new Date('2025-01-01T12:00:00.000Z');
      const rounded = roundUpToMinute(date);
      
      expect(rounded.getTime()).toBe(date.getTime());
    });

    it('should handle hour boundary correctly', () => {
      const date = new Date('2025-01-01T12:59:30Z'); // 59 minutes 30 seconds
      const rounded = roundUpToMinute(date);
      
      expect(rounded.getUTCHours()).toBe(13);
      expect(rounded.getUTCMinutes()).toBe(0);
      expect(rounded.getUTCSeconds()).toBe(0);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes correctly', () => {
      const date = new Date('2025-01-01T12:00:00Z');
      const result = addMinutes(date, 5);
      
      expect(result.getTime()).toBe(date.getTime() + 5 * 60 * 1000);
    });

    it('should add minutes without rounding by default', () => {
      const date = new Date('2025-01-01T12:00:30Z'); // 30 seconds
      const result = addMinutes(date, 5);
      
      expect(result.getMinutes()).toBe(5);
      expect(result.getSeconds()).toBe(30); // Should preserve seconds
    });

    it('should add minutes with rounding when requested', () => {
      const date = new Date('2025-01-01T12:00:30Z'); // 30 seconds
      const result = addMinutes(date, 5, true);
      
      expect(result.getMinutes()).toBe(6); // 5 + 1 (rounded up)
      expect(result.getSeconds()).toBe(0); // Should be rounded
    });

    it('should handle negative minutes', () => {
      const date = new Date('2025-01-01T12:05:00Z');
      const result = addMinutes(date, -3);
      
      expect(result.getMinutes()).toBe(2);
    });

    it('should handle hour boundaries', () => {
      const date = new Date('2025-01-01T12:50:00Z');
      const result = addMinutes(date, 20);
      
      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(10);
    });
  });

  describe('Integration with buffer constants', () => {
    it('should work correctly with MIN_SCHEDULE_BUFFER_MINUTES', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const minAllowed = addMinutes(now, MIN_SCHEDULE_BUFFER_MINUTES);
      
      expect(minAllowed.getTime()).toBe(now.getTime() + 3 * 60 * 1000);
    });

    it('should work correctly with QUICK_SET_BUFFER_MINUTES', () => {
      const now = new Date('2025-01-01T12:00:30Z'); // 30 seconds
      const quickSet = addMinutes(now, QUICK_SET_BUFFER_MINUTES, true);
      
      // Should be 5 minutes + rounded up to next minute
      expect(quickSet.getMinutes()).toBe(6);
      expect(quickSet.getSeconds()).toBe(0);
    });

    it('should ensure quick action time is always valid', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const minAllowed = addMinutes(now, MIN_SCHEDULE_BUFFER_MINUTES);
      const quickSet = roundUpToMinute(addMinutes(now, QUICK_SET_BUFFER_MINUTES));
      
      expect(quickSet.getTime()).toBeGreaterThan(minAllowed.getTime());
    });
  });
});
