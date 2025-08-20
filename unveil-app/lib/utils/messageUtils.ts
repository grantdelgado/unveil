/**
 * Message utility functions for deduplication and ordering
 * Used by guest messaging realtime updates
 */

export interface GuestMessage {
  message_id: string;
  content: string;
  created_at: string;
  delivery_status: string;
  sender_name: string;
  sender_avatar_url: string | null;
  message_type: string;
  is_own_message: boolean;
}

/**
 * Merge new messages into existing array with deduplication and stable ordering
 * Maintains pagination boundaries and prevents duplicates
 * 
 * @param existingMessages Current messages array (chronological order - oldest first)
 * @param newMessages New messages to merge in
 * @returns Merged and deduplicated array maintaining chronological order
 */
export function mergeMessages(
  existingMessages: GuestMessage[], 
  newMessages: GuestMessage[]
): GuestMessage[] {
  if (newMessages.length === 0) {
    return existingMessages;
  }

  // Create a Set for O(1) duplicate checking
  const existingIds = new Set(existingMessages.map(m => m.message_id));
  
  // Filter out duplicates from new messages
  const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.message_id));
  
  if (uniqueNewMessages.length === 0) {
    return existingMessages;
  }

  // Combine all messages and sort by created_at (stable sort)
  const allMessages = [...existingMessages, ...uniqueNewMessages];
  
  // Sort chronologically (oldest first) with tie-breaking by message_id for stability
  allMessages.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    
    if (timeA !== timeB) {
      return timeA - timeB; // Chronological order
    }
    
    // Tie-breaker: use message_id for consistent ordering
    return a.message_id.localeCompare(b.message_id);
  });

  return allMessages;
}

/**
 * Check if a message was created within the last N seconds
 * Used to determine if auto-scroll should trigger
 */
export function isRecentMessage(message: GuestMessage, withinSeconds: number = 5): boolean {
  const messageTime = new Date(message.created_at).getTime();
  const now = Date.now();
  return (now - messageTime) < (withinSeconds * 1000);
}

/**
 * Get the most recent message from an array
 */
export function getMostRecentMessage(messages: GuestMessage[]): GuestMessage | null {
  if (messages.length === 0) return null;
  
  // Since messages are in chronological order (oldest first), last one is most recent
  return messages[messages.length - 1];
}

/**
 * Count new messages since a given timestamp
 */
export function countNewMessagesSince(
  messages: GuestMessage[], 
  sinceTimestamp: string
): number {
  const sinceTime = new Date(sinceTimestamp).getTime();
  return messages.filter(msg => {
    const msgTime = new Date(msg.created_at).getTime();
    return msgTime > sinceTime;
  }).length;
}
