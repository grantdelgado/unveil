/**
 * @file Unit tests for compound cursor pagination logic
 * Tests the stable ordering and deduplication behavior
 */

import { describe, it, expect } from 'vitest';

// Types for testing
interface TestMessage {
  message_id: string;
  created_at: string;
  content: string;
}

/**
 * Merge messages with stable ordering and deduplication
 * This mirrors the logic from useGuestMessagesRPC (thread-safe version)
 */
function mergeMessagesStable(
  existingMessages: TestMessage[], 
  newMessages: TestMessage[],
  existingIds: Set<string> = new Set()
): { messages: TestMessage[], updatedIds: Set<string> } {
  const messageIds = new Set(existingIds);
  existingMessages.forEach(m => messageIds.add(m.message_id));
  
  const combined = [...existingMessages];
  
  // Add new messages, deduplicating by ID
  for (const newMsg of newMessages) {
    if (!messageIds.has(newMsg.message_id)) {
      messageIds.add(newMsg.message_id);
      combined.push(newMsg);
    }
  }
  
  // Sort by (created_at DESC, id DESC) for stable ordering
  combined.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeB !== timeA) {
      return timeB - timeA; // DESC by created_at
    }
    // Tiebreaker: DESC by message_id (lexicographic for UUIDs)
    return a.message_id > b.message_id ? -1 : 1;
  });
  
  return { messages: combined, updatedIds: messageIds };
}

describe('Compound Cursor Pagination', () => {
  describe('mergeMessagesStable', () => {
    it('should maintain DESC order by (created_at, message_id)', () => {
      const existing: TestMessage[] = [
        { message_id: 'msg-3', created_at: '2024-01-01T12:00:00Z', content: 'Third' },
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'First' },
      ];
      
      const newMessages: TestMessage[] = [
        { message_id: 'msg-2', created_at: '2024-01-01T11:00:00Z', content: 'Second' },
      ];
      
      const result = mergeMessagesStable(existing, newMessages);
      
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].message_id).toBe('msg-3'); // Latest timestamp
      expect(result.messages[1].message_id).toBe('msg-2'); // Middle timestamp  
      expect(result.messages[2].message_id).toBe('msg-1'); // Earliest timestamp
    });

    it('should handle same timestamp with ID tiebreaker', () => {
      const sameTime = '2024-01-01T12:00:00Z';
      
      const existing: TestMessage[] = [
        { message_id: 'uuid-aaaa', created_at: sameTime, content: 'A' },
      ];
      
      const newMessages: TestMessage[] = [
        { message_id: 'uuid-bbbb', created_at: sameTime, content: 'B' },
        { message_id: 'uuid-aaab', created_at: sameTime, content: 'C' },
      ];
      
      const result = mergeMessagesStable(existing, newMessages);
      
      expect(result.messages).toHaveLength(3);
      // All same timestamp, so should be ordered by ID DESC (lexicographic)
      expect(result.messages[0].message_id).toBe('uuid-bbbb');
      expect(result.messages[1].message_id).toBe('uuid-aaab'); 
      expect(result.messages[2].message_id).toBe('uuid-aaaa');
    });

    it('should deduplicate by message_id', () => {
      const existing: TestMessage[] = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'Original' },
      ];
      
      const newMessages: TestMessage[] = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'Duplicate' },
        { message_id: 'msg-2', created_at: '2024-01-01T11:00:00Z', content: 'New' },
      ];
      
      const result = mergeMessagesStable(existing, newMessages);
      
      expect(result.messages).toHaveLength(2); // Duplicate should be filtered out
      expect(result.messages.find(m => m.message_id === 'msg-1')?.content).toBe('Original');
      expect(result.messages.find(m => m.message_id === 'msg-2')?.content).toBe('New');
    });

    it('should handle empty inputs gracefully', () => {
      expect(mergeMessagesStable([], []).messages).toEqual([]);
      
      const existing: TestMessage[] = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'Existing' }
      ];
      
      expect(mergeMessagesStable(existing, []).messages).toEqual(existing);
      expect(mergeMessagesStable([], existing).messages).toEqual(existing);
    });

    it('should handle pagination boundary correctly', () => {
      // Simulate pagination where boundary messages share the same created_at
      const existing: TestMessage[] = [
        { message_id: 'msg-newest', created_at: '2024-01-01T12:00:00Z', content: 'Newest' },
        { message_id: 'boundary-b', created_at: '2024-01-01T11:00:00Z', content: 'Boundary B' },
        { message_id: 'boundary-a', created_at: '2024-01-01T11:00:00Z', content: 'Boundary A' },
      ];
      
      // Next page should include more messages from same timestamp
      const newMessages: TestMessage[] = [
        { message_id: 'boundary-c', created_at: '2024-01-01T11:00:00Z', content: 'Boundary C' },
        { message_id: 'msg-older', created_at: '2024-01-01T10:00:00Z', content: 'Older' },
      ];
      
      const result = mergeMessagesStable(existing, newMessages);
      
      expect(result.messages).toHaveLength(5);
      
      // Should maintain stable ordering across the boundary
      const elevenOClockMessages = result.messages.filter(m => m.created_at === '2024-01-01T11:00:00Z');
      expect(elevenOClockMessages).toHaveLength(3);
      
      // Verify proper ID-based tiebreaker ordering for same timestamp
      const sortedIds = elevenOClockMessages.map(m => m.message_id).sort().reverse();
      elevenOClockMessages.forEach((msg, index) => {
        expect(msg.message_id).toBe(sortedIds[index]);
      });
    });
  });

  describe('cursor extraction', () => {
    it('should identify correct compound cursor from message list', () => {
      const messages: TestMessage[] = [
        { message_id: 'newest', created_at: '2024-01-01T12:00:00Z', content: 'Newest' },
        { message_id: 'middle', created_at: '2024-01-01T11:00:00Z', content: 'Middle' },
        { message_id: 'oldest', created_at: '2024-01-01T10:00:00Z', content: 'Oldest' },
      ];
      
      // In DESC order, oldest message is the last one
      const oldestMessage = messages[messages.length - 1];
      const cursor = {
        created_at: oldestMessage.created_at,
        id: oldestMessage.message_id,
      };
      
      expect(cursor.created_at).toBe('2024-01-01T10:00:00Z');
      expect(cursor.id).toBe('oldest');
    });
  });

  describe('realtime merge behavior', () => {
    it('should handle realtime message insertion', () => {
      const existingMessages: TestMessage[] = [
        { message_id: 'msg-2', created_at: '2024-01-01T11:00:00Z', content: 'Second' },
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'First' },
      ];
      
      // Realtime message arrives
      const realtimeMessage: TestMessage[] = [
        { message_id: 'msg-3', created_at: '2024-01-01T12:00:00Z', content: 'Latest' },
      ];
      
      const result = mergeMessagesStable(existingMessages, realtimeMessage);
      
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].message_id).toBe('msg-3'); // Should be first (newest)
      expect(result.messages[1].message_id).toBe('msg-2');
      expect(result.messages[2].message_id).toBe('msg-1');
    });

    it('should ignore duplicate realtime messages', () => {
      const existingMessages: TestMessage[] = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'Original' },
      ];
      
      // Duplicate realtime message (maybe from both delivery and announcement paths)
      const duplicateMessage: TestMessage[] = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'Duplicate' },
      ];
      
      const result = mergeMessagesStable(existingMessages, duplicateMessage);
      
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('Original'); // Original should be preserved
    });
  });
});
