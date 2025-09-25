/**
 * Compatibility Wrapper: useMessages
 * 
 * Thin compatibility layer that maps the legacy useMessages interface
 * to the new core hooks system. Maintains backward compatibility while
 * gradually migrating to the consolidated architecture.
 * 
 * @deprecated Use core hooks directly: useEventMessagesList, useMessageMutations
 */

import { useMemo } from 'react';
import {
  useEventMessagesList,
  useMessageMutations,
  type MessageWithSender,
} from '../_core';

// Legacy interface (matches original useMessages)
export interface UseMessagesReturn {
  // Legacy data format
  messages: MessageWithSender[] | null;
  loading: boolean;
  error: Error | null;
  
  // Legacy methods
  sendMessage: (request: {
    eventId: string;
    content: string;
    messageType?: 'direct' | 'announcement' | 'channel';
    recipientFilter?: any;
  }) => Promise<any>;
  refetch: () => Promise<void>;
}

/**
 * @deprecated Use useEventMessagesList + useMessageMutations instead
 * 
 * Migration path:
 * ```ts
 * // OLD:
 * const { messages, sendMessage, loading, error } = useMessages(eventId);
 * 
 * // NEW:
 * const { data: messages, isLoading: loading, error } = useEventMessagesList(eventId);
 * const { sendAnnouncement, sendChannel, sendDirect } = useMessageMutations();
 * ```
 */
export function useMessages(eventId: string | null): UseMessagesReturn {
  // Use core hooks internally
  const {
    data: messages,
    isLoading: loading,
    error: listError,
    invalidate,
  } = useEventMessagesList(eventId || '', {
    // Default to all message types for backward compatibility
    limit: 50,
  });
  
  const {
    sendAnnouncement,
    sendChannel,
    sendDirect,
    error: mutationError,
  } = useMessageMutations();
  
  // Combined error handling
  const error = listError || mutationError;
  
  // Legacy sendMessage wrapper
  const sendMessage = useMemo(() => {
    return async (request: {
      eventId: string;
      content: string;
      messageType?: 'direct' | 'announcement' | 'channel';
      recipientFilter?: any;
    }) => {
      const { messageType = 'direct', recipientFilter, ...rest } = request;
      
      // Default send via options for backward compatibility
      const sendVia = {
        sms: true,
        email: false,
        push: true,
      };
      
      const fullRequest = {
        ...rest,
        recipientFilter: recipientFilter || { type: 'all' as const },
        sendVia,
      };
      
      // Route to appropriate core mutation
      switch (messageType) {
        case 'announcement':
          return await sendAnnouncement(fullRequest);
        case 'channel':
          return await sendChannel(fullRequest);
        case 'direct':
        default:
          return await sendDirect(fullRequest);
      }
    };
  }, [sendAnnouncement, sendChannel, sendDirect]);
  
  // Development warning about deprecated usage
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useMessages is deprecated. Use useEventMessagesList + useMessageMutations instead.',
      {
        eventId,
        migrationGuide: 'See hooks/messaging/_core/README.md for migration instructions',
      }
    );
  }
  
  return {
    messages: messages || null,
    loading,
    error,
    sendMessage,
    refetch: invalidate,
  };
}
