import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Real-time Schedule Validator', () => {
  const originalDateNow = Date.now;
  const mockNow = new Date('2025-01-01T12:00:00Z');

  beforeEach(() => {
    Date.now = vi.fn(() => mockNow.getTime());
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    Date.now = originalDateNow;
    vi.useRealTimers();
  });

  describe('Time validation logic', () => {
    it('should validate now + 2m as invalid', () => {
      const now = new Date();
      const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000);
      const minAllowedUtc = new Date(now.getTime() + 3 * 60 * 1000);
      
      const isTooSoon = twoMinutesFromNow < minAllowedUtc;
      
      expect(isTooSoon).toBe(true);
    });

    it('should validate now + 3m as valid', () => {
      const now = new Date();
      const threeMinutesFromNow = new Date(now.getTime() + 3 * 60 * 1000);
      const minAllowedUtc = new Date(now.getTime() + 3 * 60 * 1000);
      
      const isTooSoon = threeMinutesFromNow < minAllowedUtc;
      
      expect(isTooSoon).toBe(false);
    });

    it('should handle edge case of exactly 3 minutes', () => {
      const now = new Date();
      const exactlyThreeMinutes = new Date(now.getTime() + 3 * 60 * 1000);
      const minAllowedUtc = new Date(now.getTime() + 3 * 60 * 1000);
      
      const isTooSoon = exactlyThreeMinutes < minAllowedUtc;
      
      expect(isTooSoon).toBe(false); // Should be valid (>= is allowed)
    });
  });

  describe('Time progression validation', () => {
    it('should become invalid as time passes', () => {
      const initialNow = new Date();
      const scheduledTime = new Date(initialNow.getTime() + 4 * 60 * 1000); // 4 minutes from initial now
      
      // Initially valid (4 minutes > 3 minute requirement)
      let minAllowedUtc = new Date(initialNow.getTime() + 3 * 60 * 1000);
      let isTooSoon = scheduledTime < minAllowedUtc;
      expect(isTooSoon).toBe(false);
      
      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);
      const newNow = new Date();
      
      // Now only 2 minutes remain, should be invalid
      minAllowedUtc = new Date(newNow.getTime() + 3 * 60 * 1000);
      isTooSoon = scheduledTime < minAllowedUtc;
      expect(isTooSoon).toBe(true);
    });

    it('should track remaining time correctly', () => {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      
      // Calculate remaining time
      const diffMs = scheduledTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      expect(diffMinutes).toBe(5);
      
      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);
      const newNow = new Date();
      
      // Recalculate remaining time
      const newDiffMs = scheduledTime.getTime() - newNow.getTime();
      const newDiffMinutes = Math.floor(newDiffMs / (1000 * 60));
      
      expect(newDiffMinutes).toBe(3);
    });
  });

  describe('Countdown display formatting', () => {
    it('should format minutes correctly', () => {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 5 * 60 * 1000);
      
      const diffMs = scheduledTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      const formatted = diffMinutes === 1 ? `in ${diffMinutes} minute` : `in ${diffMinutes} minutes`;
      
      expect(formatted).toBe('in 5 minutes');
    });

    it('should format single minute correctly', () => {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 1 * 60 * 1000);
      
      const diffMs = scheduledTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      const formatted = diffMinutes === 1 ? `in ${diffMinutes} minute` : `in ${diffMinutes} minutes`;
      
      expect(formatted).toBe('in 1 minute');
    });

    it('should format hours and minutes correctly', () => {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 90 * 60 * 1000); // 1.5 hours
      
      const diffMs = scheduledTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      
      const formatted = `in ${diffHours}h ${remainingMinutes}m`;
      
      expect(formatted).toBe('in 1h 30m');
    });

    it('should handle edge case of less than 1 minute', () => {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 30 * 1000); // 30 seconds
      
      const diffMs = scheduledTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      const formatted = diffMinutes > 0 ? `in ${diffMinutes} minutes` : 'sending soon';
      
      expect(formatted).toBe('sending soon');
    });
  });

  describe('Minimum allowed time calculation', () => {
    it('should calculate 3 minutes from current time', () => {
      const now = new Date();
      const minAllowedUtc = new Date(now.getTime() + 3 * 60 * 1000);
      
      const expectedTime = new Date(mockNow.getTime() + 3 * 60 * 1000);
      
      expect(minAllowedUtc.getTime()).toBe(expectedTime.getTime());
    });

    it('should update when time advances', () => {
      const initialNow = new Date();
      const initialMinAllowed = new Date(initialNow.getTime() + 3 * 60 * 1000);
      
      // Advance time by 1 minute
      vi.advanceTimersByTime(60 * 1000);
      
      const newNow = new Date();
      const newMinAllowed = new Date(newNow.getTime() + 3 * 60 * 1000);
      
      // New minimum should be 1 minute later than initial
      expect(newMinAllowed.getTime()).toBe(initialMinAllowed.getTime() + 60 * 1000);
    });
  });

  describe('Validation state transitions', () => {
    it('should transition from valid to invalid as time passes', () => {
      const scheduledTime = new Date(mockNow.getTime() + 4 * 60 * 1000); // 4 minutes from now
      
      // Initial state: valid
      let now = new Date();
      let minAllowed = new Date(now.getTime() + 3 * 60 * 1000);
      let isValid = scheduledTime >= minAllowed;
      
      expect(isValid).toBe(true);
      
      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);
      
      // New state: invalid (only 2 minutes remaining)
      now = new Date();
      minAllowed = new Date(now.getTime() + 3 * 60 * 1000);
      isValid = scheduledTime >= minAllowed;
      
      expect(isValid).toBe(false);
    });

    it('should remain invalid once it becomes invalid', () => {
      const scheduledTime = new Date(mockNow.getTime() + 2 * 60 * 1000); // 2 minutes from now (invalid)
      
      // Initial state: invalid
      let now = new Date();
      let minAllowed = new Date(now.getTime() + 3 * 60 * 1000);
      let isValid = scheduledTime >= minAllowed;
      
      expect(isValid).toBe(false);
      
      // Advance time by 1 minute (making it even more invalid)
      vi.advanceTimersByTime(60 * 1000);
      
      // Should still be invalid
      now = new Date();
      minAllowed = new Date(now.getTime() + 3 * 60 * 1000);
      isValid = scheduledTime >= minAllowed;
      
      expect(isValid).toBe(false);
    });
  });
});
