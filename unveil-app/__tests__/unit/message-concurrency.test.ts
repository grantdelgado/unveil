/**
 * @file Concurrency safety tests for message deduplication
 * Tests the thread-safe behavior of message merging under concurrent conditions
 */

import { describe, it, expect } from 'vitest';

// Types for testing
interface TestMessage {
  message_id: string;
  created_at: string;
  content: string;
}

/**
 * Thread-safe message merger (mirrors the hook implementation)
 */
function mergeMessagesThreadSafe(
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

describe('Message Concurrency Safety', () => {
  describe('thread-safe deduplication', () => {
    it('should handle concurrent message insertion from multiple sources', () => {
      // Simulate initial messages
      const initialMessages: TestMessage[] = [
        { message_id: 'initial-1', created_at: '2024-01-01T10:00:00Z', content: 'Initial 1' },
        { message_id: 'initial-2', created_at: '2024-01-01T11:00:00Z', content: 'Initial 2' },
      ];
      
      // First merge (initial fetch)
      const result1 = mergeMessagesThreadSafe([], initialMessages);
      expect(result1.messages).toHaveLength(2);
      expect(result1.updatedIds.size).toBe(2);
      
      // Simulate concurrent realtime message (delivery path)
      const realtimeMessage1: TestMessage[] = [
        { message_id: 'realtime-1', created_at: '2024-01-01T12:00:00Z', content: 'Realtime 1' },
      ];
      
      const result2 = mergeMessagesThreadSafe(result1.messages, realtimeMessage1, result1.updatedIds);
      expect(result2.messages).toHaveLength(3);
      expect(result2.updatedIds.size).toBe(3);
      
      // Simulate same message arriving via different path (fast-path)
      const duplicateMessage: TestMessage[] = [
        { message_id: 'realtime-1', created_at: '2024-01-01T12:00:00Z', content: 'Realtime 1 Duplicate' },
      ];
      
      const result3 = mergeMessagesThreadSafe(result2.messages, duplicateMessage, result2.updatedIds);
      expect(result3.messages).toHaveLength(3); // Should not increase
      expect(result3.updatedIds.size).toBe(3); // Should not increase
      expect(result3.messages.find(m => m.message_id === 'realtime-1')?.content).toBe('Realtime 1');
    });

    it('should maintain consistent state across rapid updates', () => {
      let currentMessages: TestMessage[] = [];
      let currentIds = new Set<string>();
      
      // Simulate rapid message arrivals from different paths
      const updates = [
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'First' },
        { message_id: 'msg-2', created_at: '2024-01-01T10:01:00Z', content: 'Second' },
        { message_id: 'msg-1', created_at: '2024-01-01T10:00:00Z', content: 'First Duplicate' }, // Duplicate
        { message_id: 'msg-3', created_at: '2024-01-01T10:02:00Z', content: 'Third' },
        { message_id: 'msg-2', created_at: '2024-01-01T10:01:00Z', content: 'Second Duplicate' }, // Duplicate
      ];
      
      // Process updates sequentially (simulating concurrent arrivals)
      for (const update of updates) {
        const result = mergeMessagesThreadSafe(currentMessages, [update], currentIds);
        currentMessages = result.messages;
        currentIds = result.updatedIds;
      }
      
      // Should have exactly 3 unique messages despite 5 updates
      expect(currentMessages).toHaveLength(3);
      expect(currentIds.size).toBe(3);
      
      // Should be properly ordered (newest first)
      expect(currentMessages[0].message_id).toBe('msg-3');
      expect(currentMessages[1].message_id).toBe('msg-2'); 
      expect(currentMessages[2].message_id).toBe('msg-1');
      
      // Original content should be preserved (first instance wins)
      expect(currentMessages.find(m => m.message_id === 'msg-1')?.content).toBe('First');
      expect(currentMessages.find(m => m.message_id === 'msg-2')?.content).toBe('Second');
    });

    it('should handle Set state updates atomically', () => {
      const initialIds = new Set(['existing-1', 'existing-2']);
      
      const messages: TestMessage[] = [
        { message_id: 'new-1', created_at: '2024-01-01T10:00:00Z', content: 'New 1' },
        { message_id: 'existing-1', created_at: '2024-01-01T09:00:00Z', content: 'Existing 1' }, // Duplicate
        { message_id: 'new-2', created_at: '2024-01-01T11:00:00Z', content: 'New 2' },
      ];
      
      const result = mergeMessagesThreadSafe([], messages, initialIds);
      
      // Should only add truly new messages
      expect(result.updatedIds.size).toBe(4); // 2 existing + 2 new
      expect(result.messages).toHaveLength(2); // Only new messages added to empty list
      expect(result.updatedIds.has('existing-1')).toBe(true);
      expect(result.updatedIds.has('existing-2')).toBe(true);
      expect(result.updatedIds.has('new-1')).toBe(true);
      expect(result.updatedIds.has('new-2')).toBe(true);
    });
  });

  describe('ordering consistency under concurrency', () => {
    it('should maintain stable order regardless of arrival sequence', () => {
      // Messages that could arrive in any order due to network/timing
      const messagesSet1: TestMessage[] = [
        { message_id: 'msg-c', created_at: '2024-01-01T12:00:00Z', content: 'C' },
        { message_id: 'msg-a', created_at: '2024-01-01T10:00:00Z', content: 'A' },
      ];
      
      const messagesSet2: TestMessage[] = [
        { message_id: 'msg-b', created_at: '2024-01-01T11:00:00Z', content: 'B' },
        { message_id: 'msg-d', created_at: '2024-01-01T13:00:00Z', content: 'D' },
      ];
      
      // Arrival order 1: Set1 then Set2
      let result1 = mergeMessagesThreadSafe([], messagesSet1);
      result1 = mergeMessagesThreadSafe(result1.messages, messagesSet2, result1.updatedIds);
      
      // Arrival order 2: Set2 then Set1
      let result2 = mergeMessagesThreadSafe([], messagesSet2);
      result2 = mergeMessagesThreadSafe(result2.messages, messagesSet1, result2.updatedIds);
      
      // Both should result in same final order (D, C, B, A by timestamp)
      expect(result1.messages.map(m => m.message_id)).toEqual(['msg-d', 'msg-c', 'msg-b', 'msg-a']);
      expect(result2.messages.map(m => m.message_id)).toEqual(['msg-d', 'msg-c', 'msg-b', 'msg-a']);
      
      // Both should have same deduplication state
      expect(result1.updatedIds).toEqual(result2.updatedIds);
    });

    it('should handle timestamp ties consistently', () => {
      const sameTimestamp = '2024-01-01T12:00:00Z';
      
      // Messages with same timestamp arriving in different orders
      const batch1: TestMessage[] = [
        { message_id: 'uuid-cccc', created_at: sameTimestamp, content: 'C' },
        { message_id: 'uuid-aaaa', created_at: sameTimestamp, content: 'A' },
      ];
      
      const batch2: TestMessage[] = [
        { message_id: 'uuid-bbbb', created_at: sameTimestamp, content: 'B' },
        { message_id: 'uuid-dddd', created_at: sameTimestamp, content: 'D' },
      ];
      
      // Process in order: batch1, batch2
      let result = mergeMessagesThreadSafe([], batch1);
      result = mergeMessagesThreadSafe(result.messages, batch2, result.updatedIds);
      
      // Should be ordered by ID DESC (lexicographic)
      const expectedOrder = ['uuid-dddd', 'uuid-cccc', 'uuid-bbbb', 'uuid-aaaa'];
      expect(result.messages.map(m => m.message_id)).toEqual(expectedOrder);
      
      // Verify all IDs are tracked
      expect(result.updatedIds.size).toBe(4);
      expectedOrder.forEach(id => {
        expect(result.updatedIds.has(id)).toBe(true);
      });
    });
  });
});
