/**
 * Compatibility Wrapper: useEventMessages
 * 
 * Maps the legacy useEventMessages interface (from hooks/queries)
 * to the new core hooks system. Preserves pagination and mutation patterns.
 * 
 * @deprecated Use core hooks directly: useEventMessagesList, useMessageMutations
 */

import { useMemo } from 'react';
import {
  useEventMessagesList,
  useMessageMutations,
  type MessageWithSender,
} from '../_core';

// Legacy query keys (matches original)
export const queryKeys = {
  eventMessages: (eventId: string) => ['event-messages', eventId] as const,
  eventMessagesArchived: (eventId: string) =>
    ['event-messages-archived', eventId] as const,
};

/**
 * @deprecated Use useEventMessagesList instead
 * 
 * Migration path:
 * ```ts
 * // OLD:
 * const { data, isLoading, error } = useEventMessages(eventId);
 * 
 * // NEW:
 * const { data, isLoading, error } = useEventMessagesList(eventId);
 * ```
 */
export function useEventMessages(eventId: string | null) {
  const result = useEventMessagesList(eventId || '', {
    // Match legacy behavior - ascending chronological order
    limit: 50,
  });
  
  // Transform data to match legacy format (ascending order)
  const transformedData = useMemo(() => {
    if (!result.data) return [];
    
    // Legacy hook returned messages in ascending order (oldest first)
    // Core hook returns descending order (newest first) by default
    return [...result.data].reverse();
  }, [result.data]);
  
  // Development warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useEventMessages is deprecated. Use useEventMessagesList instead.',
      {
        eventId,
        migrationGuide: 'The new hook returns descending order by default. Use reverse() if you need ascending.',
      }
    );
  }
  
  return {
    ...result,
    data: transformedData,
  };
}

// Legacy mutation options interface
interface UseSendMessageOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * @deprecated Use useMessageMutations instead
 */
export function useSendMessage({
  onSuccess,
  onError,
}: UseSendMessageOptions = {}) {
  const { sendDirect, sendAnnouncement, sendChannel } = useMessageMutations();
  
  // Development warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useSendMessage is deprecated. Use useMessageMutations instead.',
    );
  }
  
  return {
    mutateAsync: async ({
      eventId,
      content,
      userId,
      messageType = 'direct',
    }: {
      eventId: string;
      content: string;
      userId: string;
      messageType?: 'direct' | 'announcement' | 'channel';
    }) => {
      try {
        const sendVia = {
          sms: false,
          email: false,
          push: true, // Default to push notifications like original
        };
        
        const request = {
          eventId,
          content,
          recipientFilter: { type: 'all' as const },
          sendVia,
        };
        
        let result;
        switch (messageType) {
          case 'announcement':
            result = await sendAnnouncement(request);
            break;
          case 'channel':
            result = await sendChannel(request);
            break;
          case 'direct':
          default:
            result = await sendDirect(request);
            break;
        }
        
        onSuccess?.(result);
        return result;
      } catch (error) {
        onError?.(error as Error);
        throw error;
      }
    },
    isPending: false, // Simplified for compatibility
    error: null,
  };
}

/**
 * @deprecated Real-time functionality is built into core hooks
 */
export function useMessagesRealtime(eventId: string) {
  // Development warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useMessagesRealtime is deprecated. Use useMessageRealtime instead.',
      {
        eventId,
        migrationNote: 'Realtime is now integrated into core hooks automatically',
      }
    );
  }
  
  return {
    cleanup: () => {
      // No-op for compatibility
    },
  };
}

/**
 * @deprecated Pagination is built into core hooks
 */
export function useMessagesPagination(eventId: string, pageSize = 50) {
  // Development warning
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] useMessagesPagination is deprecated. Use useEventMessagesList with fetchNextPage instead.',
      {
        eventId,
        pageSize,
      }
    );
  }
  
  return {
    loadMore: async (currentOffset: number) => {
      console.warn('loadMore called on deprecated pagination hook');
      return currentOffset + pageSize;
    },
  };
}
