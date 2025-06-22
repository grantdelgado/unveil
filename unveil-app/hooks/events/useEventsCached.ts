import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, cacheUtils } from '@/lib/react-query'
import {
  getEventById,
  getHostEvents,
  getParticipantEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventStats,
} from '@/services/events'
import type { EventInsert, EventUpdate } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

// Cached hook for getting a single event by ID
export function useEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: async () => {
      const result = await getEventById(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch event')
      }
      return result?.data
    },
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000, // Events don't change often, cache for 2 minutes
  })
}

// Cached hook for getting events hosted by a user
export function useHostEventsCached(userId: string) {
  return useQuery({
    queryKey: queryKeys.hostEvents(userId),
    queryFn: async () => {
      const result = await getHostEvents(userId)
      if (result?.error) {
        throw new Error('Failed to fetch host events')
      }
      return result?.data || []
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // User events can change, cache for 1 minute
  })
}

// Cached hook for getting events where user is a participant
export function useParticipantEventsCached(userId: string) {
  return useQuery({
    queryKey: queryKeys.participantEvents(userId),
    queryFn: async () => {
      const result = await getParticipantEvents(userId)
      if (result?.error) {
        throw new Error('Failed to fetch participant events')
      }
      return result?.data || []
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // User events can change, cache for 1 minute
  })
}

// Cached hook for event statistics
export function useEventStats(eventId: string) {
  return useQuery({
    queryKey: queryKeys.eventStats(eventId),
    queryFn: async () => {
      const result = await getEventStats(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch event stats')
      }
      return result?.data
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // Stats change frequently, cache for 30 seconds
  })
}

// Mutation hook for creating events with cache invalidation
export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventData: EventInsert) => {
      const result = await createEvent(eventData)
      if (result?.error) {
        throw new Error('Failed to create event')
      }
      return result?.data
    },
    onSuccess: (newEvent, variables) => {
      logger.api('Event created successfully', { eventId: newEvent?.id })
      
      // Invalidate user events cache
      if (variables.host_user_id) {
        cacheUtils.invalidateUserEvents(queryClient, variables.host_user_id)
      }
    },
    onError: (error) => {
      logger.error('Failed to create event', error)
    },
  })
}

// Mutation hook for updating events with cache invalidation
export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EventUpdate }) => {
      const result = await updateEvent(id, updates)
      if (result?.error) {
        throw new Error('Failed to update event')
      }
      return result?.data
    },
    onSuccess: (updatedEvent, { id }) => {
      logger.api('Event updated successfully', { eventId: id })
      
      // Update the event in cache
      if (updatedEvent) {
        queryClient.setQueryData(queryKeys.event(id), updatedEvent)
      }
      
      // Invalidate related caches
      cacheUtils.invalidateEvent(queryClient, id)
      
      // Invalidate user events if host changed
      if (updatedEvent?.host_user_id) {
        cacheUtils.invalidateUserEvents(queryClient, updatedEvent.host_user_id)
      }
    },
    onError: (error) => {
      logger.error('Failed to update event', error)
    },
  })
}

// Mutation hook for deleting events with cache invalidation
export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const result = await deleteEvent(eventId)
      if (result?.error) {
        throw new Error('Failed to delete event')
      }
      return result?.data
    },
    onSuccess: (_, eventId) => {
      logger.api('Event deleted successfully', { eventId })
      
      // Remove the event from cache
      queryClient.removeQueries({ queryKey: queryKeys.event(eventId) })
      
      // Invalidate all related caches
      cacheUtils.invalidateEvent(queryClient, eventId)
      
      // Invalidate all user events (we don't know which user was the host)
      queryClient.invalidateQueries({ queryKey: queryKeys.events() })
    },
    onError: (error) => {
      logger.error('Failed to delete event', error)
    },
  })
} 