/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from 'vitest';

/**
 * Test suite for guest message ordering logic
 * 
 * Validates that messages are displayed in correct chronological order
 * within date groups for natural reading flow (oldest to newest).
 */
describe('Guest Message Ordering', () => {
  describe('Message sorting within date groups', () => {
    it('should sort messages chronologically (oldest first) within same day', () => {
      // Arrange: Messages in reverse chronological order (as received from RPC)
      const messages = [
        { id: 'uuid-3', created_at: '2025-10-16T11:30:00Z', content: 'Message C' },
        { id: 'uuid-2', created_at: '2025-10-16T11:00:00Z', content: 'Message B' },
        { id: 'uuid-1', created_at: '2025-10-16T10:30:00Z', content: 'Message A' },
      ];

      // Act: Sort messages chronologically (oldest first)
      const sorted = [...messages].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;  // ASC
        return a.id < b.id ? -1 : 1;  // ASC (stable)
      });

      // Assert: Oldest message first, newest last
      expect(sorted[0].id).toBe('uuid-1'); // 10:30 AM
      expect(sorted[1].id).toBe('uuid-2'); // 11:00 AM
      expect(sorted[2].id).toBe('uuid-3'); // 11:30 AM
    });

    it('should use stable tie-breaker for identical timestamps', () => {
      // Arrange: Messages with identical created_at
      const messages = [
        { id: 'uuid-2', created_at: '2025-10-16T10:30:00Z', content: 'Second' },
        { id: 'uuid-1', created_at: '2025-10-16T10:30:00Z', content: 'First' },
      ];

      // Act: Sort with stable tie-breaker
      const sorted = [...messages].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;  // ASC
        return a.id < b.id ? -1 : 1;  // ASC (stable)
      });

      // Assert: Stable ordering by ID when timestamps match
      expect(sorted[0].id).toBe('uuid-1');
      expect(sorted[1].id).toBe('uuid-2');
    });

    it('should maintain order across date boundaries', () => {
      // Arrange: Messages spanning multiple days
      const messages = [
        { id: 'uuid-4', created_at: '2025-10-16T10:00:00Z', content: 'Today late' },
        { id: 'uuid-3', created_at: '2025-10-16T01:00:00Z', content: 'Today early' },
        { id: 'uuid-2', created_at: '2025-10-15T23:00:00Z', content: 'Yesterday' },
        { id: 'uuid-1', created_at: '2025-10-15T12:00:00Z', content: 'Yesterday morning' },
      ];

      // Act: Sort chronologically
      const sorted = [...messages].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;  // ASC
        return a.id < b.id ? -1 : 1;  // ASC (stable)
      });

      // Assert: Oldest to newest across all dates
      expect(sorted[0].id).toBe('uuid-1'); // Oct 15, 12:00 PM
      expect(sorted[1].id).toBe('uuid-2'); // Oct 15, 11:00 PM
      expect(sorted[2].id).toBe('uuid-3'); // Oct 16, 1:00 AM
      expect(sorted[3].id).toBe('uuid-4'); // Oct 16, 10:00 AM
    });
  });

  describe('Date group ordering', () => {
    it('should sort date keys chronologically (oldest first)', () => {
      // Arrange: Date keys in random order
      const dateGroups = {
        '2025-10-17': [],
        '2025-10-15': [],
        '2025-10-16': [],
      };

      // Act: Sort date keys chronologically
      const sortedDates = Object.keys(dateGroups).sort((a, b) => a.localeCompare(b));

      // Assert: Oldest date first
      expect(sortedDates[0]).toBe('2025-10-15');
      expect(sortedDates[1]).toBe('2025-10-16');
      expect(sortedDates[2]).toBe('2025-10-17');
    });
  });

  describe('Combined sorting behavior', () => {
    it('should display messages in natural reading order (top to bottom, oldest to newest)', () => {
      // Arrange: Messages as received from RPC (newest first)
      const rpcMessages = [
        { id: 'uuid-6', created_at: '2025-10-16T15:00:00Z', content: 'Today 3pm' },
        { id: 'uuid-5', created_at: '2025-10-16T12:00:00Z', content: 'Today noon' },
        { id: 'uuid-4', created_at: '2025-10-16T09:00:00Z', content: 'Today 9am' },
        { id: 'uuid-3', created_at: '2025-10-15T18:00:00Z', content: 'Yesterday 6pm' },
        { id: 'uuid-2', created_at: '2025-10-15T14:00:00Z', content: 'Yesterday 2pm' },
        { id: 'uuid-1', created_at: '2025-10-15T10:00:00Z', content: 'Yesterday 10am' },
      ];

      // Act: Group by date and sort within groups
      const groupedByDate: Record<string, typeof rpcMessages> = {};
      
      rpcMessages.forEach((msg) => {
        const date = msg.created_at.split('T')[0];
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(msg);
      });

      // Sort dates chronologically
      const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));

      // Sort messages within each date group
      sortedDateKeys.forEach((date) => {
        groupedByDate[date].sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return a.id < b.id ? -1 : 1;
        });
      });

      // Assert: Display order matches natural reading flow
      // October 15 group (oldest date first)
      expect(sortedDateKeys[0]).toBe('2025-10-15');
      expect(groupedByDate['2025-10-15'][0].id).toBe('uuid-1'); // 10am
      expect(groupedByDate['2025-10-15'][1].id).toBe('uuid-2'); // 2pm
      expect(groupedByDate['2025-10-15'][2].id).toBe('uuid-3'); // 6pm

      // October 16 group (newer date)
      expect(sortedDateKeys[1]).toBe('2025-10-16');
      expect(groupedByDate['2025-10-16'][0].id).toBe('uuid-4'); // 9am
      expect(groupedByDate['2025-10-16'][1].id).toBe('uuid-5'); // noon
      expect(groupedByDate['2025-10-16'][2].id).toBe('uuid-6'); // 3pm
    });
  });
});

