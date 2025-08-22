import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { sendMessageToEvent } from '@/lib/services/messaging';
import type { MessageWithSender } from '@/lib/supabase/types';
import { smartInvalidation } from '@/lib/queryUtils';

// Query keys
export const queryKeys = {
  eventMessages: (eventId: string) => ['event-messages', eventId] as const,
  eventMessagesArchived: (eventId: string) =>
    ['event-messages-archived', eventId] as const,
};

// Get event messages
export function useEventMessages(eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.eventMessages(eventId ?? ''),
    queryFn: async (): Promise<MessageWithSender[]> => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          *,
          sender:users!sender_user_id(*)
        `,
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    },
    enabled: !!eventId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

// Send message mutation options
interface UseSendMessageOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useSendMessage({
  onSuccess,
  onError,
}: UseSendMessageOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
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
      // Use the centralized messaging service
      const result = await sendMessageToEvent({
        eventId,
        content,
        messageType,
        recipientFilter: { type: 'all' }, // Default to all recipients
        sendVia: {
          sms: false,
          email: false,
          push: true, // Default to push notifications
        },
      });

      if (!result.success) {
        throw new Error(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to send message',
        );
      }

      return result.data;
    },

    onMutate: async ({ eventId, content, userId, messageType = 'direct' }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.eventMessages(eventId),
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithSender[]>(
        queryKeys.eventMessages(eventId),
      );

      // Optimistically update
      const optimisticMessage: MessageWithSender = {
        id: `temp-${Date.now()}`,
        event_id: eventId,
        sender_user_id: userId,
        content,
        message_type: messageType,
        created_at: new Date().toISOString(),
        delivered_at: null,
        delivered_count: 0,
        failed_count: 0,
        scheduled_message_id: null, // Regular messages are not scheduled
        sender: null, // Will be populated on success
      };

      queryClient.setQueryData<MessageWithSender[]>(
        queryKeys.eventMessages(eventId),
        (old) => (old ? [...old, optimisticMessage] : [optimisticMessage]),
      );

      return { previousMessages, optimisticMessage };
    },

    onError: (err, variables, context) => {
      // Rollback optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.eventMessages(variables.eventId),
          context.previousMessages,
        );
      }
      onError?.(err as Error);
    },

    onSuccess: async (data, variables) => {
      // Use centralized smart invalidation for messaging
      await smartInvalidation({
        queryClient,
        mutationType: 'message',
        eventId: variables.eventId,
      });
      onSuccess?.(data);
    },
  });
}

// Hook for real-time message updates
export function useMessagesRealtime(eventId: string) {
  const queryClient = useQueryClient();

  // Subscribe to real-time changes
  const subscription = supabase
    .channel(`messages:${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `event_id=eq.${eventId}`,
      },
      (payload: any) => {
        // Add new message to cache
        const newMessage = payload.new as MessageWithSender;

        queryClient.setQueryData<MessageWithSender[]>(
          queryKeys.eventMessages(eventId),
          (old) => {
            if (!old) return [];

            // Check if message already exists (prevent duplicates)
            const exists = old.some((msg) => msg.id === newMessage.id);
            if (exists) return old;

            return [...old, newMessage];
          },
        );
      },
    )
    .subscribe();

  return {
    cleanup: () => subscription.unsubscribe(),
  };
}

export function useMessagesPagination(eventId: string, pageSize = 50) {
  const queryClient = useQueryClient();

  const loadMore = async (currentOffset: number) => {
    const nextOffset = currentOffset + pageSize;

    // Prefetch next page
    await queryClient.prefetchQuery({
      queryKey: [
        ...queryKeys.eventMessages(eventId),
        { limit: pageSize, offset: nextOffset },
      ],
      queryFn: async (): Promise<MessageWithSender[]> => {
        const { data, error } = await supabase
          .from('messages')
          .select(
            `
            *,
            sender:users!sender_user_id(*)
          `,
          )
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .range(nextOffset, nextOffset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to fetch messages: ${error.message}`);
        }

        return data || [];
      },
      // ...cacheConfig.realtime, // This line was removed as per the new_code, but the original file had it.
      // I will re-add it as it's a valid cacheConfig.realtime.
      // However, the new_code removed it, so I should follow the new_code.
      // The new_code removed it, so I should remove it.
    });

    return nextOffset;
  };

  return { loadMore };
}
