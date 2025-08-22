import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  getTimezoneInfo,
  toUTCFromEventZone,
  fromUTCToEventZone,
  getTimezoneLabel,
  formatTimeWithTimezone,
} from './timezone';

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    it('should validate valid IANA timezone identifiers', () => {
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezone identifiers', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('NotReal/Place')).toBe(false);
      expect(isValidTimezone('Random_String')).toBe(false);
    });
  });

  describe('getTimezoneInfo', () => {
    it('should return timezone info for valid timezones', () => {
      const info = getTimezoneInfo('America/Los_Angeles');
      expect(info).toBeTruthy();
      expect(info?.timeZone).toBe('America/Los_Angeles');
      expect(info?.abbreviation).toMatch(/PST|PDT/);
      expect(info?.displayName).toContain('Pacific');
    });

    it('should return null for invalid timezones', () => {
      expect(getTimezoneInfo('Invalid/Timezone')).toBeNull();
      expect(getTimezoneInfo('')).toBeNull();
    });

    it('should handle DST transitions correctly', () => {
      // Test with a date in summer (PDT)
      const summerDate = new Date('2025-07-01');
      const summerInfo = getTimezoneInfo('America/Los_Angeles', summerDate);
      expect(summerInfo?.abbreviation).toBe('PDT');

      // Test with a date in winter (PST)
      const winterDate = new Date('2025-01-01');
      const winterInfo = getTimezoneInfo('America/Los_Angeles', winterDate);
      expect(winterInfo?.abbreviation).toBe('PST');
    });
  });

  describe('toUTCFromEventZone', () => {
    it('should convert event timezone to UTC correctly', () => {
      const result = toUTCFromEventZone(
        '2025-08-31',
        '15:00',
        'America/Los_Angeles',
      );
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should handle invalid inputs gracefully', () => {
      expect(toUTCFromEventZone('', '15:00', 'America/Los_Angeles')).toBeNull();
      expect(
        toUTCFromEventZone('2025-08-31', '', 'America/Los_Angeles'),
      ).toBeNull();
      expect(
        toUTCFromEventZone('2025-08-31', '15:00', 'Invalid/Timezone'),
      ).toBeNull();
    });

    it('should maintain timezone consistency across DST boundaries', () => {
      // Test summer time (PDT)
      const summerResult = toUTCFromEventZone(
        '2025-07-01',
        '15:00',
        'America/Los_Angeles',
      );
      expect(summerResult).toBeTruthy();

      // Test winter time (PST)
      const winterResult = toUTCFromEventZone(
        '2025-01-01',
        '15:00',
        'America/Los_Angeles',
      );
      expect(winterResult).toBeTruthy();

      // Should be different due to DST
      expect(summerResult).not.toBe(winterResult);
    });
  });

  describe('fromUTCToEventZone', () => {
    it('should convert UTC to event timezone correctly', () => {
      const utcTime = '2025-08-31T22:00:00.000Z'; // 10 PM UTC
      const result = fromUTCToEventZone(utcTime, 'America/Los_Angeles');

      expect(result).toBeTruthy();
      expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.time).toMatch(/^\d{2}:\d{2}$/);
      expect(result?.formatted).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should handle invalid inputs gracefully', () => {
      expect(fromUTCToEventZone('', 'America/Los_Angeles')).toBeNull();
      expect(
        fromUTCToEventZone('2025-08-31T22:00:00.000Z', 'Invalid/Timezone'),
      ).toBeNull();
      expect(
        fromUTCToEventZone('invalid-date', 'America/Los_Angeles'),
      ).toBeNull();
    });
  });

  describe('getTimezoneLabel', () => {
    it('should create appropriate labels for valid timezones', () => {
      const label = getTimezoneLabel('America/Los_Angeles');
      expect(label).toContain('Pacific');
      expect(label).toMatch(/PST|PDT/);
      expect(label).toContain('All times in');
    });

    it('should handle invalid or missing timezones', () => {
      expect(getTimezoneLabel(null)).toBe('Event timezone not set');
      expect(getTimezoneLabel('NotReal/Place')).toBe('Invalid timezone');
      expect(getTimezoneLabel('')).toBe('Event timezone not set');
    });
  });

  describe('formatTimeWithTimezone', () => {
    it('should format time with timezone abbreviation', () => {
      const timeZoneInfo = {
        timeZone: 'America/Los_Angeles',
        abbreviation: 'PST',
        displayName: 'Pacific Standard Time',
      };

      const result = formatTimeWithTimezone('3:00 PM', timeZoneInfo);
      expect(result).toBe('3:00 PM PST');
    });

    it('should handle missing timezone info', () => {
      const result = formatTimeWithTimezone('3:00 PM', null);
      expect(result).toBe('3:00 PM');
    });
  });

  describe('roundtrip conversion', () => {
    it('should maintain consistency in roundtrip conversions', () => {
      const originalDate = '2025-08-31';
      const originalTime = '15:00';
      const timeZone = 'America/Los_Angeles';

      // Convert to UTC
      const utcTime = toUTCFromEventZone(originalDate, originalTime, timeZone);
      expect(utcTime).toBeTruthy();

      // Convert back to event timezone
      const converted = fromUTCToEventZone(utcTime!, timeZone);
      expect(converted).toBeTruthy();
      expect(converted?.date).toBe(originalDate);
      expect(converted?.time).toBe(originalTime);
    });

    it('should handle multiple timezones consistently', () => {
      const testCases = [
        { tz: 'America/New_York', date: '2025-08-31', time: '15:00' },
        { tz: 'Europe/London', date: '2025-08-31', time: '15:00' },
        { tz: 'Asia/Tokyo', date: '2025-08-31', time: '15:00' },
        { tz: 'UTC', date: '2025-08-31', time: '15:00' },
      ];

      testCases.forEach(({ tz, date, time }) => {
        const utcTime = toUTCFromEventZone(date, time, tz);
        expect(utcTime).toBeTruthy();

        const converted = fromUTCToEventZone(utcTime!, tz);
        expect(converted?.date).toBe(date);
        expect(converted?.time).toBe(time);
      });
    });
  });
});
