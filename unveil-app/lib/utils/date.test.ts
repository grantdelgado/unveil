import { describe, it, expect, vi } from 'vitest';
import { formatEventDate, formatEventDateTime } from './date';

describe('Date Formatting Utilities', () => {
  describe('formatEventDate', () => {
    it('should format a valid date string correctly', () => {
      const result = formatEventDate('2025-08-31');
      expect(result).toMatch(/Sunday, August 31, 2025/);
    });

    it('should handle different dates consistently', () => {
      const result1 = formatEventDate('2025-12-25');
      const result2 = formatEventDate('2025-01-01');
      
      expect(result1).toMatch(/December 25, 2025/);
      expect(result2).toMatch(/January 1, 2025/);
    });

    it('should return empty string for empty input', () => {
      expect(formatEventDate('')).toBe('');
    });

    it('should handle invalid date format gracefully', () => {
      const invalidDate = '2025/08/31';
      const result = formatEventDate(invalidDate);
      expect(result).toBe(invalidDate); // Should return original string
    });

    it('should warn for invalid date format', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      formatEventDate('2025-13-45'); // Invalid month and day
      expect(consoleSpy).toHaveBeenCalledWith('Invalid date format: 2025-13-45. Expected YYYY-MM-DD');
      consoleSpy.mockRestore();
    });

    /**
     * Critical test: Ensure consistent calendar day across timezones
     * This test verifies that the date parsing doesn't shift due to UTC interpretation
     */
    it('should preserve calendar day regardless of timezone', () => {
      // Mock different timezone offsets to simulate users around the world
      const originalTimezoneOffset = Date.prototype.getTimezoneOffset;
      
      // Test PST (UTC-8): +480 minutes
      Date.prototype.getTimezoneOffset = vi.fn(() => 480);
      const pstResult = formatEventDate('2025-08-31');
      
      // Test EST (UTC-5): +300 minutes
      Date.prototype.getTimezoneOffset = vi.fn(() => 300);
      const estResult = formatEventDate('2025-08-31');
      
      // Test UTC: 0 minutes
      Date.prototype.getTimezoneOffset = vi.fn(() => 0);
      const utcResult = formatEventDate('2025-08-31');
      
      // Test JST (UTC+9): -540 minutes
      Date.prototype.getTimezoneOffset = vi.fn(() => -540);
      const jstResult = formatEventDate('2025-08-31');
      
      // Restore original function
      Date.prototype.getTimezoneOffset = originalTimezoneOffset;
      
      // All should show the same calendar day
      expect(pstResult).toMatch(/August 31, 2025/);
      expect(estResult).toMatch(/August 31, 2025/);
      expect(utcResult).toMatch(/August 31, 2025/);
      expect(jstResult).toMatch(/August 31, 2025/);
      
      // They should all be identical
      expect(pstResult).toBe(estResult);
      expect(estResult).toBe(utcResult);
      expect(utcResult).toBe(jstResult);
    });
  });

  describe('formatEventDateTime', () => {
    it('should format datetime strings with time information', () => {
      const result = formatEventDateTime('2025-08-31T15:30:00');
      expect(result).toMatch(/August 31, 2025/);
      expect(result).toMatch(/3:30 PM/);
    });

    it('should handle ISO datetime strings', () => {
      const result = formatEventDateTime('2025-08-31T09:00:00.000Z');
      expect(result).toMatch(/August 31, 2025/);
    });
  });
});
