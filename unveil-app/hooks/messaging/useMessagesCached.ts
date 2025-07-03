import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, cacheUtils } from '@/lib/react-query'
import {
  getEventMessages,
  sendMessage,
  getMessageStats,
} from '@/services/messaging'
import type { MessageInsert, Message, MessageWithSender } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'
import { useCallback } from 'react'

// Cached hook for getting messages for an event
export function useEventMessagesCached(eventId: string) {
  return useQuery({
    queryKey: queryKeys.eventMessages(eventId),
    queryFn: async () => {
      const result = await getEventMessages(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch event messages')
      }
      return result?.data || []
    },
    enabled: !!eventId,
    staleTime: 10 * 1000, // Messages change frequently, cache for 10 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds for real-time feel
  })
}

// Cached hook for message statistics
export function useMessageStatsCached(eventId: string) {
  return useQuery({
    queryKey: queryKeys.messageStats(eventId),
    queryFn: async () => {
      const result = await getMessageStats(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch message stats')
      }
      return result?.data
    },
    enabled: !!eventId,
    staleTime: 1 * 60 * 1000, // Stats don't change as often, cache for 1 minute
  })
}

// Mutation hook for sending messages with optimistic updates
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageData: MessageInsert) => {
      const result = await sendMessage(messageData)
      if (result?.error) {
        throw new Error('Failed to send message')
      }
      return result?.data
    },
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.eventMessages(newMessage.event_id) })

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(queryKeys.eventMessages(newMessage.event_id))

      // Optimistically update with a temporary message
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        ...newMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: null, // Will be filled in on success
      }

      queryClient.setQueryData(queryKeys.eventMessages(newMessage.event_id), (old: any) => [
        ...(old || []),
        optimisticMessage,
      ])

      return { previousMessages }
    },
    onSuccess: (newMessage, variables) => {
      logger.api('Message sent successfully', { messageId: newMessage?.id })
      
      // Invalidate and refetch to get the real data with sender info
      cacheUtils.invalidateEventMessages(queryClient, variables.event_id)
    },
    onError: (error, variables, context) => {
      logger.error('Failed to send message', error)
      
      // Rollback optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKeys.eventMessages(variables.event_id), context.previousMessages)
      }
    },
  })
}

// Hook for real-time message updates (can be used with Supabase subscriptions)
export function useMessageRealtime(eventId: string) {
  const queryClient = useQueryClient()

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.eventMessages(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.messageStats(eventId) })
  }

  const handleMessageInsert = useCallback(
    (newMessage: Message) => {
      queryClient.setQueryData(queryKeys.eventMessages(newMessage.event_id), (old: Message[]) => [
        ...(old || []),
        newMessage,
      ])
    },
    [queryClient]
  )

  const handleMessageUpdate = useCallback(
    (updatedMessage: Message) => {
      queryClient.setQueryData(queryKeys.eventMessages(updatedMessage.event_id), (old: Message[]) =>
        old?.map((msg: Message) => (msg.id === updatedMessage.id ? updatedMessage : msg)) || []
      )
    },
    [queryClient]
  )

  const handleMessageDelete = useCallback(
    (messageId: string) => {
      queryClient.setQueryData(queryKeys.eventMessages(eventId), (old: Message[]) =>
        old?.filter((msg: Message) => msg.id !== messageId) || []
      )
    },
    [queryClient, eventId]
  )

  // Cache mutation functions
  const addMessage = (message: Message) => {
    queryClient.setQueryData(queryKeys.eventMessages(eventId), (old: Message[]) => [
      ...(old || []),
      message,
    ])
  }

  const updateMessage = (updatedMessage: Message) => {
    queryClient.setQueryData(queryKeys.eventMessages(eventId), (old: Message[]) =>
      old?.map((msg: Message) => (msg.id === updatedMessage.id ? updatedMessage : msg)) || []
    )
  }

  const removeMessage = (messageId: string) => {
    queryClient.setQueryData(queryKeys.eventMessages(eventId), (old: Message[]) =>
      old?.filter((msg: Message) => msg.id !== messageId) || []
    )
  }

  return {
    invalidateMessages,
    handleMessageInsert,
    handleMessageUpdate,
    handleMessageDelete,
    addMessage,
    updateMessage,
    removeMessage,
  }
} 