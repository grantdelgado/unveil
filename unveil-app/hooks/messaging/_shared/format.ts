/**
 * Shared Message Formatting Utilities
 * 
 * Centralized formatting logic for messages, timestamps, and display content.
 * Reuses existing friendly timestamp utilities and ensures consistency.
 */

import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import type { MessageWithSender, GuestMessage } from '../_core/types';

/**
 * Format message timestamp in a user-friendly way
 * Reuses the existing friendly timestamp pattern from the app
 */
export function formatMessageTimestamp(
  timestamp: string,
  options: {
    showTime?: boolean;
    showSeconds?: boolean;
    relative?: boolean;
  } = {}
): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Invalid date handling
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  const {
    showTime = true,
    showSeconds = false,
    relative = true,
  } = options;
  
  // For very recent messages (< 1 minute), show relative time
  if (relative) {
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) { // Less than 1 minute
      return 'Just now';
    }
    
    if (diffMs < 3600000) { // Less than 1 hour
      return formatDistanceToNow(date, { addSuffix: true });
    }
  }
  
  // For today's messages
  if (isToday(date)) {
    const timeFormat = showSeconds ? 'h:mm:ss a' : 'h:mm a';
    return showTime ? format(date, timeFormat) : 'Today';
  }
  
  // For yesterday's messages
  if (isYesterday(date)) {
    const timeFormat = showSeconds ? 'h:mm:ss a' : 'h:mm a';
    return showTime ? `Yesterday ${format(date, timeFormat)}` : 'Yesterday';
  }
  
  // For older messages
  const dateFormat = showTime 
    ? (showSeconds ? 'MMM d, h:mm:ss a' : 'MMM d, h:mm a')
    : 'MMM d, yyyy';
    
  return format(date, dateFormat);
}

/**
 * Format message sender name with fallbacks
 */
export function formatSenderName(
  message: MessageWithSender | GuestMessage
): string {
  if ('sender' in message && message.sender?.full_name) {
    return message.sender.full_name;
  }
  
  if ('sender_name' in message && message.sender_name) {
    return message.sender_name;
  }
  
  // Check if it's own message
  const isOwn = 'is_own_message' in message ? message.is_own_message : false;
  if (isOwn) {
    return 'You';
  }
  
  // Default fallback
  return 'Host';
}

/**
 * Format message content preview (for lists, notifications, etc.)
 */
export function formatContentPreview(
  content: string,
  maxLength = 100
): string {
  if (!content) return '';
  
  // Remove excessive whitespace
  const cleaned = content.trim().replace(/\s+/g, ' ');
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary if possible
  const truncated = cleaned.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    // If we can find a space in the last 20% of the truncated string
    return truncated.substring(0, lastSpaceIndex) + '…';
  }
  
  // Otherwise, hard truncate
  return truncated + '…';
}

/**
 * Format message type for display
 */
export function formatMessageType(
  messageType: string
): string {
  switch (messageType.toLowerCase()) {
    case 'announcement':
      return 'Announcement';
    case 'channel':
      return 'Channel';
    case 'direct':
      return 'Direct';
    default:
      return 'Message';
  }
}

/**
 * Format delivery status for display
 */
export function formatDeliveryStatus(
  status: string
): string {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'Delivered';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'sent':
      return 'Sent';
    default:
      return status;
  }
}

/**
 * Get status color class for delivery status
 */
export function getDeliveryStatusColor(
  status: string
): string {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'sent':
      return 'text-green-600';
    case 'pending':
      return 'text-yellow-600';
    case 'failed':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Format message for logging (removes PII)
 */
export function formatForLogging(
  message: MessageWithSender | GuestMessage
): Record<string, unknown> {
  const messageId = 'id' in message ? message.id : message.message_id;
  const createdAt = message.created_at;
  const messageType = message.message_type;
  const contentLength = message.content?.length || 0;
  
  return {
    messageId: messageId?.substring(0, 8) + '...', // Truncate ID for privacy
    createdAt,
    messageType,
    contentLength,
    hasContent: contentLength > 0,
    // Never log actual content for privacy
  };
}

/**
 * Group messages by date for UI display
 */
export interface MessageGroup<T> {
  date: string;
  displayDate: string;
  messages: T[];
}

export function groupMessagesByDate<T extends { created_at: string }>(
  messages: T[]
): MessageGroup<T>[] {
  const groups: Record<string, T[]> = {};
  
  // Group by date
  messages.forEach(message => {
    const date = new Date(message.created_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });
  
  // Convert to array and add display dates
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // Sort by date desc
    .map(([dateKey, messages]) => {
      const date = new Date(dateKey);
      let displayDate: string;
      
      if (isToday(date)) {
        displayDate = 'Today';
      } else if (isYesterday(date)) {
        displayDate = 'Yesterday';
      } else {
        displayDate = format(date, 'MMMM d, yyyy');
      }
      
      return {
        date: dateKey,
        displayDate,
        messages: messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      };
    });
}

/**
 * Extract hashtags from message content
 */
export function extractHashtags(content: string): string[] {
  if (!content) return [];
  
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex);
  
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

/**
 * Extract mentions from message content
 */
export function extractMentions(content: string): string[] {
  if (!content) return [];
  
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  
  return matches ? matches.map(mention => mention.substring(1)) : [];
}

/**
 * Format message for accessibility screen readers
 */
export function formatForAccessibility(
  message: MessageWithSender | GuestMessage
): string {
  const sender = formatSenderName(message);
  const timestamp = formatMessageTimestamp(message.created_at || new Date().toISOString(), { relative: false });
  const messageType = formatMessageType(message.message_type || 'message');
  const content = message.content || '';
  
  return `${messageType} from ${sender} at ${timestamp}: ${content}`;
}
