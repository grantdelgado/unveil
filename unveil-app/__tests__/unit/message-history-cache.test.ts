import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

// Mock the cache merge functionality that would be in useScheduledMessagesCache
class MockScheduledMessagesCache {
  private messages: ScheduledMessage[] = [];

  constructor(initialMessages: ScheduledMessage[] = []) {
    this.messages = [...initialMessages];
  }

  handleRealtimeInsert(newMessage: ScheduledMessage): boolean {
    // Check for duplicates
    const existingIds = new Set(this.messages.map(msg => msg.id));
    if (existingIds.has(newMessage.id)) {
      return false; // Already exists, skip
    }

    // Add new message and maintain order (scheduled_at DESC, id DESC)
    this.messages.push(newMessage);
    this.messages.sort((a, b) => {
      const timeA = new Date(a.send_at).getTime();
      const timeB = new Date(b.send_at).getTime();
      if (timeA !== timeB) return timeB - timeA; // DESC
      return b.id.localeCompare(a.id); // DESC
    });

    return true;
  }

  handleRealtimeUpdate(updatedMessage: ScheduledMessage): boolean {
    const index = this.messages.findIndex(msg => msg.id === updatedMessage.id);
    if (index === -1) return false;

    this.messages[index] = updatedMessage;
    
    // Re-sort to maintain order
    this.messages.sort((a, b) => {
      const timeA = new Date(a.send_at).getTime();
      const timeB = new Date(b.send_at).getTime();
      if (timeA !== timeB) return timeB - timeA; // DESC
      return b.id.localeCompare(a.id); // DESC
    });

    return true;
  }

  handleRealtimeDelete(deletedMessage: ScheduledMessage): boolean {
    const initialLength = this.messages.length;
    this.messages = this.messages.filter(msg => msg.id !== deletedMessage.id);
    return this.messages.length < initialLength;
  }

  getMessages(): ScheduledMessage[] {
    return [...this.messages];
  }
}

// Helper to create mock scheduled messages
function createMockScheduledMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: `msg_${Math.random().toString(36).substr(2, 9)}`,
    event_id: 'test_event_123',
    content: 'Test message content',
    message_type: 'announcement',
    status: 'scheduled',
    send_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sender_user_id: 'user_123',
    recipient_count: null,
    success_count: null,
    failure_count: null,
    sent_at: null,
    scheduled_tz: 'America/New_York',
    scheduled_local: null,
    modification_count: 0,
    send_via_push: true,
    send_via_sms: false,
    guest_selection_type: 'all',
    selected_guest_ids: null,
    selected_tags: null,
    ...overrides,
  };
}

describe('Message History Cache Operations', () => {
  let cache: MockScheduledMessagesCache;

  beforeEach(() => {
    cache = new MockScheduledMessagesCache();
  });

  describe('handleRealtimeInsert', () => {
    it('should add new message and maintain order', () => {
      const message1 = createMockScheduledMessage({
        id: 'msg_1',
        send_at: new Date(Date.now() + 120000).toISOString(), // 2 minutes from now
      });
      const message2 = createMockScheduledMessage({
        id: 'msg_2', 
        send_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      });

      cache.handleRealtimeInsert(message1);
      cache.handleRealtimeInsert(message2);

      const messages = cache.getMessages();
      expect(messages).toHaveLength(2);
      // Should be ordered by send_at DESC (message1 first, then message2)
      expect(messages[0].id).toBe('msg_1');
      expect(messages[1].id).toBe('msg_2');
    });

    it('should prevent duplicate messages', () => {
      const message = createMockScheduledMessage({ id: 'msg_duplicate' });

      const result1 = cache.handleRealtimeInsert(message);
      const result2 = cache.handleRealtimeInsert(message);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(cache.getMessages()).toHaveLength(1);
    });

    it('should handle messages with same send_at by id DESC', () => {
      const sameTime = new Date(Date.now() + 60000).toISOString();
      const message1 = createMockScheduledMessage({
        id: 'msg_a',
        send_at: sameTime,
      });
      const message2 = createMockScheduledMessage({
        id: 'msg_z',
        send_at: sameTime,
      });

      cache.handleRealtimeInsert(message1);
      cache.handleRealtimeInsert(message2);

      const messages = cache.getMessages();
      // With same time, should order by id DESC (z before a)
      expect(messages[0].id).toBe('msg_z');
      expect(messages[1].id).toBe('msg_a');
    });
  });

  describe('handleRealtimeUpdate', () => {
    it('should update existing message and maintain order', () => {
      const originalMessage = createMockScheduledMessage({
        id: 'msg_update',
        content: 'Original content',
        send_at: new Date(Date.now() + 60000).toISOString(),
      });

      cache.handleRealtimeInsert(originalMessage);

      const updatedMessage = {
        ...originalMessage,
        content: 'Updated content',
        send_at: new Date(Date.now() + 120000).toISOString(), // Different time
      };

      const result = cache.handleRealtimeUpdate(updatedMessage);

      expect(result).toBe(true);
      const messages = cache.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Updated content');
    });

    it('should return false for non-existent message', () => {
      const nonExistentMessage = createMockScheduledMessage({ id: 'msg_nonexistent' });
      const result = cache.handleRealtimeUpdate(nonExistentMessage);
      expect(result).toBe(false);
    });
  });

  describe('handleRealtimeDelete', () => {
    it('should remove message from cache', () => {
      const message = createMockScheduledMessage({ id: 'msg_delete' });
      
      cache.handleRealtimeInsert(message);
      expect(cache.getMessages()).toHaveLength(1);

      const result = cache.handleRealtimeDelete(message);

      expect(result).toBe(true);
      expect(cache.getMessages()).toHaveLength(0);
    });

    it('should return false for non-existent message', () => {
      const nonExistentMessage = createMockScheduledMessage({ id: 'msg_nonexistent' });
      const result = cache.handleRealtimeDelete(nonExistentMessage);
      expect(result).toBe(false);
    });
  });

  describe('realtime event idempotency', () => {
    it('should handle multiple identical INSERT events gracefully', () => {
      const message = createMockScheduledMessage({ id: 'msg_idempotent' });

      // Simulate multiple INSERT events for the same message
      cache.handleRealtimeInsert(message);
      cache.handleRealtimeInsert(message);
      cache.handleRealtimeInsert(message);

      expect(cache.getMessages()).toHaveLength(1);
    });

    it('should handle UPDATE events for messages that may not exist', () => {
      const message = createMockScheduledMessage({ id: 'msg_maybe_exists' });

      // Try to update before insert
      const updateResult1 = cache.handleRealtimeUpdate(message);
      expect(updateResult1).toBe(false);

      // Insert then update
      cache.handleRealtimeInsert(message);
      const updateResult2 = cache.handleRealtimeUpdate({
        ...message,
        content: 'Updated',
      });
      expect(updateResult2).toBe(true);
    });

    it('should handle DELETE events for messages that may not exist', () => {
      const message = createMockScheduledMessage({ id: 'msg_maybe_deleted' });

      // Try to delete before insert
      const deleteResult1 = cache.handleRealtimeDelete(message);
      expect(deleteResult1).toBe(false);

      // Insert then delete
      cache.handleRealtimeInsert(message);
      const deleteResult2 = cache.handleRealtimeDelete(message);
      expect(deleteResult2).toBe(true);
    });
  });

  describe('performance with large datasets', () => {
    it('should maintain performance with many messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockScheduledMessage({
          id: `msg_${i.toString().padStart(3, '0')}`,
          send_at: new Date(Date.now() + i * 60000).toISOString(),
        })
      );

      const start = performance.now();
      
      // Insert all messages
      messages.forEach(msg => cache.handleRealtimeInsert(msg));
      
      // Update some messages
      for (let i = 0; i < 10; i++) {
        cache.handleRealtimeUpdate({
          ...messages[i],
          content: `Updated content ${i}`,
        });
      }
      
      // Delete some messages
      for (let i = 90; i < 100; i++) {
        cache.handleRealtimeDelete(messages[i]);
      }

      const end = performance.now();
      const duration = end - start;

      expect(cache.getMessages()).toHaveLength(90); // 100 - 10 deleted
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
