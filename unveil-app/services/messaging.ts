import { supabase } from '@/lib/supabase/client';
import type {
  MessageInsert,
  MessageUpdate,
  MessageType,
  MessageWithSender,
} from '@/lib/supabase/types';
import { handleMessagingDatabaseError } from '@/lib/error-handling/database';
import { UI_CONFIG } from '@/lib/constants';

// Message constraints
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

// Removed: handleDatabaseError function - now using unified DatabaseErrorHandler from lib/error-handling/database.ts

/**
 * Validates message content for length and format requirements
 * 
 * Ensures message content meets application constraints:
 * - Must not be empty or only whitespace
 * - Must be at least 1 character long
 * - Must not exceed 2000 characters
 * 
 * @param content - The message content to validate
 * @returns Object with validation result and error message if invalid
 * 
 * @example
 * ```typescript
 * const validation = validateMessage(userInput)
 * if (!validation.isValid) {
 *   console.error('Invalid message:', validation.error)
 * }
 * ```
 * 
 * @see {@link sendMessage} for message creation
 * @see {@link updateMessage} for message editing
 */
export const validateMessage = (
  content: string,
): { isValid: boolean; error?: string } => {
  if (!content || content.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (content.length < MIN_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message must be at least ${MIN_MESSAGE_LENGTH} character long`,
    };
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message must be less than ${MAX_MESSAGE_LENGTH} characters. Current length: ${content.length}`,
    };
  }

  return { isValid: true };
};

/**
 * Messaging service functions for event communication
 */

/**
 * Retrieves all messages for a specific event
 * 
 * Fetches messages with sender information, ordered chronologically.
 * Access is controlled by RLS policies - only event guests can view messages.
 * 
 * @param eventId - The event ID to get messages for
 * @returns Promise resolving to Supabase response with messages and sender data
 * 
 * @throws {Error} If event not found or access denied
 * 
 * @example
 * ```typescript
 * const { data: messages, error } = await getEventMessages('event-123')
 * messages?.forEach(msg => {
 *   console.log(`${msg.sender.display_name}: ${msg.content}`)
 * })
 * ```
 * 
 * @see {@link sendMessage} for creating messages
 * @see {@link getMessagesByType} for filtered messages
 */
export const getEventMessages = async (eventId: string) => {
  try {
    return await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

/**
 * Sends a new message to an event
 * 
 * Creates a message in the event's message thread. Automatically validates
 * message content and triggers real-time notifications to other guests.
 * 
 * @param messageData - Message data including content, event_id, sender_user_id, and type
 * @returns Promise resolving to Supabase response with created message and sender info
 * 
 * @throws {Error} If validation fails, access denied, or database error
 * 
 * @example
 * ```typescript
 * const messageData = {
 *   content: 'Looking forward to the event!',
 *   event_id: 'event-123',
 *   sender_user_id: 'user-456',
 *   message_type: 'direct'
 * }
 * const { data: message, error } = await sendMessage(messageData)
 * ```
 * 
 * @see {@link validateMessage} for content validation rules
 * @see {@link sendBulkMessage} for announcements to all guests
 */
export const sendMessage = async (messageData: MessageInsert) => {
  try {
    // Validate message content
    if (messageData.content) {
      const validation = validateMessage(messageData.content);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    return await supabase
      .from('messages')
      .insert(messageData)
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleMessagingDatabaseError(error, 'INSERT', 'messages');
  }
};

export const deleteMessage = async (id: string) => {
  try {
    return await supabase.from('messages').delete().eq('id', id);
  } catch (error) {
    handleMessagingDatabaseError(error, 'DELETE', 'messages');
  }
};

export const getMessagesByType = async (
  eventId: string,
  messageType: MessageType,
) => {
  try {
    return await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('message_type', messageType)
      .order('created_at', { ascending: true });
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

export const updateMessage = async (id: string, updates: MessageUpdate) => {
  try {
    // Validate message content if being updated
    if (updates.content) {
      const validation = validateMessage(updates.content);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    return await supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleMessagingDatabaseError(error, 'UPDATE', 'messages');
  }
};

export const getMessageById = async (id: string) => {
  try {
    return await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .eq('id', id)
      .single();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PGRST116'
    ) {
      throw new Error('Message not found');
    }
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

export const getMessagesBySender = async (
  eventId: string,
  senderId: string,
) => {
  try {
    return await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('sender_user_id', senderId)
      .order('created_at', { ascending: true });
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

export const getRecentMessages = async (
  eventId: string,
  limit: number = 50,
) => {
  try {
    return await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

export const getMessageStats = async (eventId: string) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('message_type, sender_user_id')
      .eq('event_id', eventId);

    if (error) throw error;

    const stats = {
      total: data.length,
      direct: data.filter((m) => m.message_type === 'direct').length,
      announcements: data.filter((m) => m.message_type === 'announcement')
        .length,
      unique_senders: new Set(data.map((m) => m.sender_user_id).filter(Boolean))
        .size,
    };

    return { data: stats, error: null };
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages');
  }
};

// Real-time messaging subscription helper
export const subscribeToEventMessages = (
  eventId: string,
  callback: (payload: {
    eventType: string;
    new?: MessageWithSender;
    old?: MessageWithSender;
  }) => void,
) => {
  return supabase
    .channel(`messages:${eventId}`)
    .on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `event_id=eq.${eventId}`,
      },
      callback as any,
    )
    .subscribe();
};

// Export message constraints for use in components
export const MESSAGE_CONSTRAINTS = {
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
};

// Legacy functions removed - functionality not supported in simplified schema

export const sendBulkMessage = async (
  eventId: string,
  content: string,
  senderId: string,
  messageType: MessageType = 'announcement',
) => {
  try {
    // For bulk messages, we just send one announcement message
    return await sendMessage({
      event_id: eventId,
      sender_user_id: senderId,
      content: content,
      message_type: messageType,
    });
  } catch (error) {
    handleMessagingDatabaseError(error, 'INSERT', 'messages');
  }
};

/**
 * Get paginated event messages with optimized queries
 */
export const getEventMessagesPaginated = async (
  eventId: string,
  options: {
    page?: number
    pageSize?: number
    messageType?: MessageType
    sortOrder?: 'asc' | 'desc'
  } = {}
) => {
  try {
    const {
      page = 1,
      pageSize = UI_CONFIG.PAGINATION.MESSAGES_PAGE_SIZE,
      messageType,
      sortOrder = 'desc',
    } = options

    const offset = (page - 1) * pageSize

    // Build the query
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `, { count: 'exact' })
      .eq('event_id', eventId)

    // Apply message type filter if specified
    if (messageType) {
      query = query.eq('message_type', messageType)
    }

    // Apply sorting and pagination
    const result = await query
      .order('created_at', { ascending: sortOrder === 'asc' })
      .range(offset, offset + pageSize - 1)

    return {
      data: result.data || [],
      totalCount: result.count || 0,
      error: result.error ? new Error(result.error.message) : null,
    }
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages')
  }
}

/**
 * Get message thread with context (messages around a specific message)
 */
export const getMessageThread = async (
  messageId: string,
  contextSize: number = 10
) => {
  try {
    // First get the target message to find its timestamp
    const { data: targetMessage, error: messageError } = await supabase
      .from('messages')
      .select('created_at, event_id')
      .eq('id', messageId)
      .single()

    if (messageError) throw messageError
    if (!targetMessage) throw new Error('Message not found')

    // Get messages before and after the target message
    const [beforeResult, afterResult] = await Promise.all([
      // Messages before (older)
      supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('event_id', targetMessage.event_id)
        .lt('created_at', targetMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(contextSize),

      // Messages after (newer)
      supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `)
        .eq('event_id', targetMessage.event_id)
        .gte('created_at', targetMessage.created_at)
        .order('created_at', { ascending: true })
        .limit(contextSize + 1) // +1 to include the target message
    ])

    if (beforeResult.error) throw beforeResult.error
    if (afterResult.error) throw afterResult.error

    // Combine and sort all messages
    const allMessages = [
      ...(beforeResult.data || []).reverse(), // Reverse to get chronological order
      ...(afterResult.data || [])
    ].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateA - dateB
    })

    return {
      data: allMessages,
      targetIndex: allMessages.findIndex(msg => msg.id === messageId),
      error: null,
    }
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages')
  }
}

/**
 * Search messages with pagination
 */
export const searchMessages = async (
  eventId: string,
  searchQuery: string,
  options: {
    page?: number
    pageSize?: number
    messageType?: MessageType
  } = {}
) => {
  try {
    const {
      page = 1,
      pageSize = UI_CONFIG.PAGINATION.MESSAGES_PAGE_SIZE,
      messageType,
    } = options

    const offset = (page - 1) * pageSize

    // Build the query with text search
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_user_id_fkey(*)
      `, { count: 'exact' })
      .eq('event_id', eventId)
      .textSearch('content', searchQuery)

    // Apply message type filter if specified
    if (messageType) {
      query = query.eq('message_type', messageType)
    }

    // Apply sorting and pagination
    const result = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    return {
      data: result.data || [],
      totalCount: result.count || 0,
      error: result.error ? new Error(result.error.message) : null,
    }
  } catch (error) {
    handleMessagingDatabaseError(error, 'SELECT', 'messages')
  }
}
