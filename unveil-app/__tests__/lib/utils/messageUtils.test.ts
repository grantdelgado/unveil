/**
 * Tests for message pagination, merge utilities, and stable ordering
 * 
 * Ensures:
 * - Merge preserves stable ordering (created_at DESC, id DESC)
 * - Deduplication works correctly with identical IDs
 * - Cursor advance is monotonic
 * - No duplicate pages when realtime inserts arrive between fetches
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  mergeMessages, 
  isRecentMessage, 
  getMostRecentMessage, 
  countNewMessagesSince,
  type GuestMessage 
} from '@/lib/utils/messageUtils';

// Test observability counters (TEST-ONLY)
let testCounters = {
  mergeOperations: 0,
  duplicatesFiltered: 0,
  messagesProcessed: 0,
  stableOrderingChecks: 0,
};

// Helper to create test messages
function createTestMessage(overrides: Partial<GuestMessage> = {}): GuestMessage {
  const baseTime = new Date('2025-01-15T12:00:00Z');
  const id = overrides.message_id || `msg-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    message_id: id,
    content: `Test message ${id}`,
    created_at: overrides.created_at || baseTime.toISOString(),
    delivery_status: 'delivered',
    sender_name: 'Test User',
    sender_avatar_url: null,
    message_type: 'announcement',
    is_own_message: false,
    ...overrides,
  };
}

// Helper to create messages with specific timestamps
function createMessagesWithTimes(times: string[], idPrefix: string = 'msg'): GuestMessage[] {
  return times.map((time, index) => createTestMessage({
    message_id: `${idPrefix}-${index + 1}`,
    created_at: time,
    content: `Message at ${time}`,
  }));
}

describe('Message Merge Utilities — dedup/ordering contracts @core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset test counters
    testCounters = {
      mergeOperations: 0,
      duplicatesFiltered: 0,
      messagesProcessed: 0,
      stableOrderingChecks: 0,
    };
  });

  describe('mergeMessages - Basic Functionality', () => {
    it('should return existing messages when new messages is empty', () => {
      const existing = createMessagesWithTimes(['2025-01-15T12:00:00Z']);
      const result = mergeMessages(existing, []);
      
      testCounters.mergeOperations++;
      
      expect(result).toBe(existing); // Should return same reference
      expect(result).toHaveLength(1);
    });

    it('should return new messages when existing is empty', () => {
      const newMessages = createMessagesWithTimes(['2025-01-15T12:00:00Z']);
      const result = mergeMessages([], newMessages);
      
      testCounters.mergeOperations++;
      testCounters.messagesProcessed += newMessages.length;
      
      expect(result).toEqual(newMessages);
      expect(result).toHaveLength(1);
    });

    it('should merge non-overlapping messages in chronological order', () => {
      const existing = createMessagesWithTimes([
        '2025-01-15T12:00:00Z', // oldest
        '2025-01-15T12:02:00Z', // newer
      ], 'existing');
      
      const newMessages = createMessagesWithTimes([
        '2025-01-15T12:01:00Z', // middle
        '2025-01-15T12:03:00Z', // newest
      ], 'new');
      
      const result = mergeMessages(existing, newMessages);
      
      testCounters.mergeOperations++;
      testCounters.messagesProcessed += existing.length + newMessages.length;
      
      expect(result).toHaveLength(4);
      
      // Should be in chronological order (oldest first)
      const timestamps = result.map(m => new Date(m.created_at).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  describe('mergeMessages - Deduplication', () => {
    it('should filter out duplicate message IDs', () => {
      const existing = [
        createTestMessage({ message_id: 'msg-1', created_at: '2025-01-15T12:00:00Z' }),
        createTestMessage({ message_id: 'msg-2', created_at: '2025-01-15T12:01:00Z' }),
      ];
      
      const newMessages = [
        createTestMessage({ message_id: 'msg-2', created_at: '2025-01-15T12:01:00Z' }), // duplicate
        createTestMessage({ message_id: 'msg-3', created_at: '2025-01-15T12:02:00Z' }), // new
      ];
      
      const result = mergeMessages(existing, newMessages);
      
      testCounters.mergeOperations++;
      testCounters.duplicatesFiltered++; // msg-2 was filtered
      testCounters.messagesProcessed += 3; // Only 3 unique messages
      
      expect(result).toHaveLength(3);
      
      // Should contain msg-1, msg-2, msg-3 (no duplicates)
      const ids = result.map(m => m.message_id);
      expect(ids).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should handle all duplicates scenario', () => {
      const existing = [
        createTestMessage({ message_id: 'msg-1' }),
        createTestMessage({ message_id: 'msg-2' }),
      ];
      
      const newMessages = [
        createTestMessage({ message_id: 'msg-1' }), // duplicate
        createTestMessage({ message_id: 'msg-2' }), // duplicate
      ];
      
      const result = mergeMessages(existing, newMessages);
      
      testCounters.mergeOperations++;
      testCounters.duplicatesFiltered += 2; // Both filtered
      
      expect(result).toBe(existing); // Should return same reference
      expect(result).toHaveLength(2);
    });

    it('should preserve original message content when deduplicating', () => {
      const existing = [
        createTestMessage({ 
          message_id: 'msg-1', 
          content: 'Original content',
          created_at: '2025-01-15T12:00:00Z'
        }),
      ];
      
      const newMessages = [
        createTestMessage({ 
          message_id: 'msg-1', 
          content: 'Updated content', // Different content, same ID
          created_at: '2025-01-15T12:00:00Z'
        }),
      ];
      
      const result = mergeMessages(existing, newMessages);
      
      testCounters.mergeOperations++;
      testCounters.duplicatesFiltered++;
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Original content'); // Should keep original
    });
  });

  describe('mergeMessages - Stable Ordering', () => {
    it('should maintain stable ordering with identical timestamps', () => {
      const sameTimestamp = '2025-01-15T12:00:00Z';
      
      const existing = [
        createTestMessage({ message_id: 'msg-1', created_at: sameTimestamp }),
      ];
      
      const newMessages = [
        createTestMessage({ message_id: 'msg-2', created_at: sameTimestamp }),
        createTestMessage({ message_id: 'msg-3', created_at: sameTimestamp }),
      ];
      
      const result = mergeMessages(existing, newMessages);
      
      testCounters.mergeOperations++;
      testCounters.stableOrderingChecks++;
      
      expect(result).toHaveLength(3);
      
      // With identical timestamps, should sort by message_id (lexicographical)
      const ids = result.map(m => m.message_id);
      const sortedIds = [...ids].sort();
      expect(ids).toEqual(sortedIds);
    });

    it('should handle mixed timestamp precision correctly', () => {
      const messages = createMessagesWithTimes([
        '2025-01-15T12:00:00.000Z', // Millisecond precision
        '2025-01-15T12:00:00Z',     // Second precision (same time)
        '2025-01-15T12:00:01Z',     // One second later
      ]);
      
      const result = mergeMessages([], messages);
      
      testCounters.mergeOperations++;
      testCounters.stableOrderingChecks++;
      
      expect(result).toHaveLength(3);
      
      // Should handle timestamp parsing correctly
      const timestamps = result.map(m => new Date(m.created_at).getTime());
      expect(timestamps[0]).toBe(timestamps[1]); // Same timestamp
      expect(timestamps[2]).toBeGreaterThan(timestamps[1]); // Later timestamp
    });

    it('should maintain DESC order when using trustRpcOrder=true', () => {
      const existing = createMessagesWithTimes([
        '2025-01-15T12:02:00Z', // newer (first in DESC order)
        '2025-01-15T12:01:00Z', // older
      ], 'desc-existing');
      
      const newMessages = createMessagesWithTimes([
        '2025-01-15T12:03:00Z', // newest (should be prepended)
      ], 'desc-new');
      
      const result = mergeMessages(existing, newMessages, true); // trustRpcOrder=true
      
      testCounters.mergeOperations++;
      testCounters.stableOrderingChecks++;
      
      expect(result).toHaveLength(3);
      
      // With trustRpcOrder=true, new messages should be prepended
      expect(result[0].message_id).toBe(newMessages[0].message_id);
      expect(result[1].message_id).toBe(existing[0].message_id);
      expect(result[2].message_id).toBe(existing[1].message_id);
    });
  });

  describe('mergeMessages - Pagination Scenarios', () => {
    it('should handle realtime inserts between paginated fetches', () => {
      // Simulate: User fetches page 1, then realtime insert, then page 2
      const page1 = createMessagesWithTimes([
        '2025-01-15T12:03:00Z',
        '2025-01-15T12:02:00Z',
      ], 'page1');
      
      // Realtime insert arrives
      const realtimeInsert = createMessagesWithTimes([
        '2025-01-15T12:04:00Z', // Newer than page 1
      ], 'realtime');
      
      // Merge realtime insert
      const afterRealtime = mergeMessages(page1, realtimeInsert);
      
      // Now fetch page 2 (older messages)
      const page2 = createMessagesWithTimes([
        '2025-01-15T12:01:00Z',
        '2025-01-15T12:00:00Z',
      ], 'page2');
      
      const final = mergeMessages(afterRealtime, page2);
      
      testCounters.mergeOperations += 2;
      testCounters.messagesProcessed += 5;
      
      expect(final).toHaveLength(5);
      
      // Should be in chronological order despite insertion timing
      const timestamps = final.map(m => new Date(m.created_at).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should handle cursor-based pagination without duplicates', () => {
      // Simulate cursor-based pagination where cursor is the timestamp of last message
      const initialMessages = createMessagesWithTimes([
        '2025-01-15T12:05:00Z',
        '2025-01-15T12:04:00Z',
        '2025-01-15T12:03:00Z', // cursor would be here
      ], 'initial');
      
      // Next page should have messages older than cursor
      const nextPage = createMessagesWithTimes([
        '2025-01-15T12:02:00Z',
        '2025-01-15T12:01:00Z',
        '2025-01-15T12:00:00Z',
      ], 'next');
      
      const result = mergeMessages(initialMessages, nextPage);
      
      testCounters.mergeOperations++;
      testCounters.messagesProcessed += 6;
      
      expect(result).toHaveLength(6);
      
      // Should maintain monotonic cursor progression
      const timestamps = result.map(m => new Date(m.created_at).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should handle overlapping page boundaries gracefully', () => {
      // Simulate scenario where RPC returns overlapping results
      const page1 = createMessagesWithTimes([
        '2025-01-15T12:03:00Z',
        '2025-01-15T12:02:00Z',
        '2025-01-15T12:01:00Z',
      ], 'p1');
      
      // Page 2 overlaps with last message from page 1
      // Page 2 overlaps with last message from page 1 - create explicit duplicate
      const page2 = [
        createTestMessage({ message_id: 'p1-3', created_at: '2025-01-15T12:01:00Z' }), // duplicate from page 1
        createTestMessage({ message_id: 'p2-1', created_at: '2025-01-15T12:00:00Z' }),
        createTestMessage({ message_id: 'p2-2', created_at: '2025-01-15T11:59:00Z' }),
      ];
      
      const result = mergeMessages(page1, page2);
      
      testCounters.mergeOperations++;
      testCounters.duplicatesFiltered++; // One duplicate filtered
      testCounters.messagesProcessed += 5; // 5 unique messages
      
      expect(result).toHaveLength(5);
      
      // Should not have duplicates
      const ids = result.map(m => m.message_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Utility Functions', () => {
    describe('isRecentMessage', () => {
      it('should identify recent messages correctly', () => {
        const now = new Date();
        const recentMessage = createTestMessage({
          created_at: new Date(now.getTime() - 3000).toISOString(), // 3 seconds ago
        });
        
        const oldMessage = createTestMessage({
          created_at: new Date(now.getTime() - 10000).toISOString(), // 10 seconds ago
        });
        
        expect(isRecentMessage(recentMessage, 5)).toBe(true);
        expect(isRecentMessage(oldMessage, 5)).toBe(false);
      });

      it('should use default threshold of 5 seconds', () => {
        const now = new Date();
        const message = createTestMessage({
          created_at: new Date(now.getTime() - 4000).toISOString(), // 4 seconds ago
        });
        
        expect(isRecentMessage(message)).toBe(true);
      });
    });

    describe('getMostRecentMessage', () => {
      it('should return the most recent message from chronological array', () => {
        const messages = createMessagesWithTimes([
          '2025-01-15T12:00:00Z', // oldest
          '2025-01-15T12:01:00Z',
          '2025-01-15T12:02:00Z', // newest (last in chronological order)
        ]);
        
        const result = getMostRecentMessage(messages);
        
        expect(result).not.toBeNull();
        expect(result!.created_at).toBe('2025-01-15T12:02:00Z');
      });

      it('should return null for empty array', () => {
        const result = getMostRecentMessage([]);
        expect(result).toBeNull();
      });
    });

    describe('countNewMessagesSince', () => {
      it('should count messages after given timestamp', () => {
        const messages = createMessagesWithTimes([
          '2025-01-15T12:00:00Z',
          '2025-01-15T12:01:00Z', // threshold
          '2025-01-15T12:02:00Z', // new
          '2025-01-15T12:03:00Z', // new
        ]);
        
        const count = countNewMessagesSince(messages, '2025-01-15T12:01:00Z');
        
        expect(count).toBe(2); // 2 messages after threshold
      });

      it('should return 0 when no messages are newer', () => {
        const messages = createMessagesWithTimes([
          '2025-01-15T12:00:00Z',
          '2025-01-15T12:01:00Z',
        ]);
        
        const count = countNewMessagesSince(messages, '2025-01-15T12:02:00Z');
        
        expect(count).toBe(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle messages with null/undefined timestamps gracefully', () => {
      const validMessage = createTestMessage({ created_at: '2025-01-15T12:00:00Z' });
      const invalidMessages = [
        createTestMessage({ created_at: null as any }),
        createTestMessage({ created_at: undefined as any }),
      ];
      
      // Should not throw
      expect(() => {
        mergeMessages([validMessage], invalidMessages);
      }).not.toThrow();
    });

    it('should handle empty message_id gracefully', () => {
      const messages = [
        createTestMessage({ message_id: '' }),
        createTestMessage({ message_id: null as any }),
        createTestMessage({ message_id: undefined as any }),
      ];
      
      // Should not throw
      expect(() => {
        mergeMessages([], messages);
      }).not.toThrow();
    });

    it('should handle very large arrays efficiently', () => {
      // Create large arrays to test performance
      const existing = Array.from({ length: 1000 }, (_, i) => 
        createTestMessage({ 
          message_id: `existing-${i}`,
          created_at: new Date(2025, 0, 15, 12, 0, i).toISOString()
        })
      );
      
      const newMessages = Array.from({ length: 1000 }, (_, i) => 
        createTestMessage({ 
          message_id: `new-${i}`,
          created_at: new Date(2025, 0, 15, 13, 0, i).toISOString()
        })
      );
      
      const start = performance.now();
      const result = mergeMessages(existing, newMessages);
      const duration = performance.now() - start;
      
      testCounters.mergeOperations++;
      testCounters.messagesProcessed += 2000;
      
      expect(result).toHaveLength(2000);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});

// Export test counters for integration tests
export { testCounters };
