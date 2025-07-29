import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys, cacheConfig } from '@/lib/react-query-client'
import { useMessages } from '@/hooks/useMessages'
import type { Database } from '@/app/reference/supabase.types'
import { sendMessage } from '@/lib/services/media'

type Message = Database['public']['Tables']['messages']['Row']
type User = Database['public']['Tables']['users']['Row']

interface MessageWithUser extends Message {
  sender_user?: User | null
}

interface UseEventMessagesOptions {
  eventId: string
  enabled?: boolean
  limit?: number
  offset?: number
}

export function useEventMessages({ eventId, enabled = true, limit = 50, offset = 0 }: UseEventMessagesOptions) {
  return useQuery({
    queryKey: [...queryKeys.eventMessages(eventId), { limit, offset }],
    queryFn: async (): Promise<MessageWithUser[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_user:users!messages_sender_user_id_fkey(*)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`)
      }

      return data || []
    },
    enabled: enabled && !!eventId,
    ...cacheConfig.realtime, // Use shorter cache time for real-time data
    
    // Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  })
}

interface UseSendMessageOptions {
  onSuccess?: (messageId: string) => void
  onError?: (error: string) => void
}

export function useSendMessage({ onSuccess, onError }: UseSendMessageOptions = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      content, 
      userId 
    }: { 
      eventId: string
      content: string
      userId: string 
    }) => {
      const result = await sendMessage({
        eventId: eventId, // Fix: use eventId instead of event_id
        content,
        messageType: 'direct' // Fix: use messageType instead of message_type
      })
      
      if (!result) {
        throw new Error('Failed to send message')
      }
      
      if (result.error) {
        throw new Error(result.error instanceof Error ? result.error.message : 'Send message failed')
      }

      return result.data
    },
    
    onMutate: async ({ eventId, content, userId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.eventMessages(eventId)
      })

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithUser[]>(queryKeys.eventMessages(eventId))

      // Optimistically update
      const optimisticMessage: MessageWithUser = {
        id: `temp-${Date.now()}`,
        event_id: eventId,
        sender_user_id: userId,
        content,
        message_type: 'direct',
        created_at: new Date().toISOString(),
        sender_user: null // Will be populated on success
      }

      queryClient.setQueryData<MessageWithUser[]>(
        queryKeys.eventMessages(eventId),
        (old) => old ? [...old, optimisticMessage] : [optimisticMessage]
      )

      return { previousMessages, optimisticMessage }
    },
    
    onSuccess: (data, variables, context) => {
      if (!data) return
      
      // Replace optimistic message with real data
      queryClient.setQueryData<MessageWithUser[]>(
        queryKeys.eventMessages(data.event_id),
        (old) => {
          if (!old) return []
          return old.map(msg => 
            msg.id === context?.optimisticMessage.id ? data : msg
          )
        }
      )

      onSuccess?.(data.id)
    },
    
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.eventMessages(variables.eventId),
          context.previousMessages
        )
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      onError?.(errorMessage)
    },
    
    onSettled: (data, error, variables) => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: queryKeys.eventMessages(variables.eventId)
      })
    }
  })
}

// Hook for real-time message updates
export function useMessagesRealtime(eventId: string) {
  const queryClient = useQueryClient()

  // Subscribe to real-time changes
  const subscription = supabase
    .channel(`messages-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        // Add new message to cache
        const newMessage = payload.new as Message
        
        queryClient.setQueryData<MessageWithUser[]>(
          queryKeys.eventMessages(eventId),
          (old) => {
            if (!old) return []
            
            // Check if message already exists (prevent duplicates)
            const exists = old.some(msg => msg.id === newMessage.id)
            if (exists) return old
            
            return [...old, newMessage as MessageWithUser]
          }
        )
      }
    )
    .subscribe()

  return {
    cleanup: () => subscription.unsubscribe()
  }
}

export function useMessagesPagination(eventId: string, pageSize = 50) {
  const queryClient = useQueryClient()

  const loadMore = async (currentOffset: number) => {
    const nextOffset = currentOffset + pageSize
    
    // Prefetch next page
    await queryClient.prefetchQuery({
      queryKey: [...queryKeys.eventMessages(eventId), { limit: pageSize, offset: nextOffset }],
      queryFn: async (): Promise<MessageWithUser[]> => {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender_user:users!messages_sender_user_id_fkey(*)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .range(nextOffset, nextOffset + pageSize - 1)

        if (error) {
          throw new Error(`Failed to fetch messages: ${error.message}`)
        }

        return data || []
      },
      ...cacheConfig.realtime,
    })

    return nextOffset
  }

  return { loadMore }
} 