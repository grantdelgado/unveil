/**
 * Tests for message merge utility functions
 */

import { mergeMessages, isRecentMessage, getMostRecentMessage, type GuestMessage } from '../messageUtils';

// Helper to create test messages
const createMessage = (id: string, createdAt: string, content: string = 'Test message'): GuestMessage => ({
  message_id: id,
  content,
  created_at: createdAt,
  delivery_status: 'delivered',
  sender_name: 'Test User',
  sender_avatar_url: null,
  message_type: 'direct',
  is_own_message: false,
});

describe('mergeMessages', () => {
  it('should merge new messages maintaining chronological order', () => {
    const existing = [
      createMessage('1', '2024-01-01T10:00:00Z'),
      createMessage('2', '2024-01-01T11:00:00Z'),
    ];
    
    const newMessages = [
      createMessage('3', '2024-01-01T12:00:00Z'),
      createMessage('4', '2024-01-01T09:00:00Z'), // Older message
    ];
    
    const result = mergeMessages(existing, newMessages);
    
    expect(result).toHaveLength(4);
    expect(result.map(m => m.message_id)).toEqual(['4', '1', '2', '3']); // Chronological order
  });

  it('should deduplicate messages by ID', () => {
    const existing = [
      createMessage('1', '2024-01-01T10:00:00Z'),
      createMessage('2', '2024-01-01T11:00:00Z'),
    ];
    
    const newMessages = [
      createMessage('1', '2024-01-01T10:00:00Z'), // Duplicate
      createMessage('3', '2024-01-01T12:00:00Z'), // New
    ];
    
    const result = mergeMessages(existing, newMessages);
    
    expect(result).toHaveLength(3);
    expect(result.map(m => m.message_id)).toEqual(['1', '2', '3']);
  });

  it('should handle empty arrays', () => {
    expect(mergeMessages([], [])).toEqual([]);
    
    const existing = [createMessage('1', '2024-01-01T10:00:00Z')];
    expect(mergeMessages(existing, [])).toEqual(existing);
    
    const newMessages = [createMessage('2', '2024-01-01T11:00:00Z')];
    expect(mergeMessages([], newMessages)).toEqual(newMessages);
  });

  it('should use message_id as tie-breaker for same timestamps', () => {
    const existing = [
      createMessage('b', '2024-01-01T10:00:00Z'),
    ];
    
    const newMessages = [
      createMessage('a', '2024-01-01T10:00:00Z'), // Same timestamp
      createMessage('c', '2024-01-01T10:00:00Z'), // Same timestamp
    ];
    
    const result = mergeMessages(existing, newMessages);
    
    expect(result.map(m => m.message_id)).toEqual(['a', 'b', 'c']); // Alphabetical tie-break
  });
});

describe('isRecentMessage', () => {
  it('should identify recent messages', () => {
    const now = new Date();
    const recent = createMessage('1', new Date(now.getTime() - 2000).toISOString()); // 2 seconds ago
    const old = createMessage('2', new Date(now.getTime() - 10000).toISOString()); // 10 seconds ago
    
    expect(isRecentMessage(recent, 5)).toBe(true);
    expect(isRecentMessage(old, 5)).toBe(false);
  });
});

describe('getMostRecentMessage', () => {
  it('should return the most recent message', () => {
    const messages = [
      createMessage('1', '2024-01-01T09:00:00Z'), // Oldest
      createMessage('2', '2024-01-01T10:00:00Z'), // Middle  
      createMessage('3', '2024-01-01T11:00:00Z'), // Latest
    ];
    
    const result = getMostRecentMessage(messages);
    expect(result?.message_id).toBe('3'); // Latest chronologically (last in sorted array)
  });

  it('should return null for empty array', () => {
    expect(getMostRecentMessage([])).toBeNull();
  });
});
