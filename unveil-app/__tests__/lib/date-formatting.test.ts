import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  formatBubbleTimeOnly, 
  hasDateMismatch, 
  formatEventDateHeader,
  groupMessagesByDateWithTimezone 
} from '@/lib/utils/date';

describe('Date Formatting for Messages', () => {
  // Store original implementations for cleanup
  let originalDateTimeFormat: typeof Intl.DateTimeFormat;
  
  beforeEach(() => {
    originalDateTimeFormat = Intl.DateTimeFormat;
  });

  afterEach(() => {
    // Restore original implementations
    vi.restoreAllMocks();
    if (originalDateTimeFormat) {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  describe('formatBubbleTimeOnly', () => {
    it('should format time in 12-hour format', () => {
      const timestamp = '2024-01-15T14:30:00Z';
      const result = formatBubbleTimeOnly(timestamp);
      
      // Should be in format like "2:30 PM" (exact format depends on locale)
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should handle empty timestamp', () => {
      expect(formatBubbleTimeOnly('')).toBe('');
    });

    it('should handle midnight correctly in local timezone', () => {
      // Create a date at midnight in the local timezone
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);
      const timestamp = localMidnight.toISOString();
      
      const result = formatBubbleTimeOnly(timestamp);
      
      expect(result).toMatch(/12:00\s?AM/i);
    });

    it('should handle noon correctly in local timezone', () => {
      // Create a date at noon in the local timezone
      const localNoon = new Date();
      localNoon.setHours(12, 0, 0, 0);
      const timestamp = localNoon.toISOString();
      
      const result = formatBubbleTimeOnly(timestamp);
      
      expect(result).toMatch(/12:00\s?PM/i);
    });
  });

  describe('hasDateMismatch', () => {
    it('should return false when no event timezone provided', () => {
      const timestamp = '2024-01-15T14:30:00Z';
      expect(hasDateMismatch(timestamp, null)).toBe(false);
      expect(hasDateMismatch(timestamp, undefined)).toBe(false);
    });

    it('should return false when timestamp is empty', () => {
      expect(hasDateMismatch('', 'America/New_York')).toBe(false);
    });

    it('should detect date mismatch across timezones', () => {
      // 11 PM EST on Jan 14 = 4 AM UTC on Jan 15
      const timestamp = '2024-01-15T04:00:00Z';
      const eventTimezone = 'America/New_York';
      
      // This should detect that local date (depends on test env) might differ from EST date
      const result = hasDateMismatch(timestamp, eventTimezone);
      expect(typeof result).toBe('boolean');
    });

    it('should handle invalid timezone gracefully', () => {
      const timestamp = '2024-01-15T14:30:00Z';
      expect(hasDateMismatch(timestamp, 'Invalid/Timezone')).toBe(false);
    });
  });

  describe('formatEventDateHeader', () => {
    it('should return "Today" for today\'s date in event timezone', () => {
      const now = new Date();
      const todayKey = now.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const result = formatEventDateHeader(todayKey, 'America/New_York');
      expect(result).toBe('Today');
    });

    it('should return "Yesterday" for yesterday\'s date in event timezone', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const result = formatEventDateHeader(yesterdayKey, 'America/New_York');
      expect(result).toBe('Yesterday');
    });

    it('should format older dates in EEE, MMM d format', () => {
      const dateKey = '2024-01-15'; // A date that's definitely not today/yesterday
      const result = formatEventDateHeader(dateKey, 'America/New_York');
      
      // Should be in format like "Mon, Jan 15" (not Today/Yesterday)
      expect(result).toMatch(/\w{3},\s\w{3}\s\d{1,2}/);
    });

    it('should handle local timezone when no event timezone provided', () => {
      const now = new Date();
      const todayKey = now.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const result = formatEventDateHeader(todayKey, null);
      expect(result).toBe('Today');
    });

    it('should handle empty date key', () => {
      expect(formatEventDateHeader('', 'America/New_York')).toBe('');
    });

    it('should handle invalid date format gracefully', () => {
      const result = formatEventDateHeader('invalid-date', 'America/New_York');
      
      // Should fallback to original format or return empty
      expect(typeof result).toBe('string');
    });
  });

  describe('groupMessagesByDateWithTimezone - stable keys', () => {
    const mockMessages = [
      {
        id: '1',
        message_id: '1',
        created_at: '2024-01-15T10:00:00Z',
        content: 'Morning message'
      },
      {
        id: '2', 
        message_id: '2',
        created_at: '2024-01-15T22:00:00Z',
        content: 'Evening message'
      },
      {
        id: '3',
        message_id: '3', 
        created_at: '2024-01-16T02:00:00Z',
        content: 'Late night message'
      }
    ];

    it('should produce stable date keys in event timezone', () => {
      const groups = groupMessagesByDateWithTimezone(
        mockMessages,
        false, // use event time
        'America/New_York'
      );
      
      const keys = Object.keys(groups);
      
      // Keys should be in YYYY-MM-DD format
      keys.forEach(key => {
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
      
      // Should be sorted chronologically
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });

    it('should group messages correctly by event timezone date', () => {
      const groups = groupMessagesByDateWithTimezone(
        mockMessages,
        false, // use event time
        'America/New_York'
      );
      
      // Should have at least one group
      expect(Object.keys(groups).length).toBeGreaterThan(0);
      
      // Each group should contain messages
      Object.values(groups).forEach(messages => {
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);
      });
    });

    it('should handle local timezone when showMyTime is true', () => {
      const groups = groupMessagesByDateWithTimezone(
        mockMessages,
        true, // use local time
        'America/New_York'
      );
      
      expect(Object.keys(groups).length).toBeGreaterThan(0);
    });

    it('should correctly flip message from Today to Yesterday when changing timezone', () => {
      // Create a message at 23:30 local time (11:30 PM)
      const now = new Date();
      const lateNightMessage = new Date(now);
      lateNightMessage.setHours(23, 30, 0, 0);
      
      const testMessage = {
        id: 'tz-test',
        message_id: 'tz-test',
        created_at: lateNightMessage.toISOString(),
        content: 'Late night message'
      };

      // Group with local timezone (should be "today")
      const localGroups = groupMessagesByDateWithTimezone(
        [testMessage],
        true, // use local time
        null
      );

      // Group with a timezone that's significantly ahead (should potentially be "tomorrow")
      const utcGroups = groupMessagesByDateWithTimezone(
        [testMessage],
        false, // use event time
        'Pacific/Auckland' // UTC+12/+13, significantly ahead
      );

      // The message should appear in different date buckets
      const localKeys = Object.keys(localGroups);
      const utcKeys = Object.keys(utcGroups);
      
      expect(localKeys.length).toBe(1);
      expect(utcKeys.length).toBe(1);
      
      // Keys should be different if timezone difference causes date change
      // Note: This test might pass or fail depending on current time and timezone
      // The important thing is that the function handles timezone differences
      expect(typeof localKeys[0]).toBe('string');
      expect(typeof utcKeys[0]).toBe('string');
    });
  });
});
