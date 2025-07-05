import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useRealtimeSubscription } from '@/hooks/realtime'
import { useDebounce } from '@/hooks/common'
import type { Database } from '@/app/reference/supabase.types'

type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

// Query keys for guest-related data
const guestQueryKeys = {
  eventGuests: (eventId: string) => ['guests', 'event', eventId] as const,
  guestStats: (eventId: string) => ['guests', 'stats', eventId] as const,
}

// Cached hook for getting guests for an event
export function useEventGuestsCached(eventId: string) {
  return useQuery({
    queryKey: guestQueryKeys.eventGuests(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_guests')
        .select(`
          *,
          users:user_id(*)
        `)
        .eq('event_id', eventId)

      if (error) {
        logger.databaseError('Failed to fetch guests', error)
        throw new Error('Failed to fetch guests')
      }

      return data || []
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // Guests don't change as frequently, cache for 30 seconds
    refetchOnWindowFocus: false, // Avoid unnecessary refetches
  })
}

// Enhanced guest data hook with filtering and caching
export function useGuestDataCached({ 
  eventId, 
  searchTerm = '', 
  filterByRSVP = 'all' 
}: {
  eventId: string
  searchTerm?: string
  filterByRSVP?: string
}) {
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  
  const { 
    data: guests = [], 
    isLoading, 
    error, 
    refetch 
  } = useEventGuestsCached(eventId)

  // Memoized filtering
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const matchesSearch = !debouncedSearchTerm || 
        guest.users?.full_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        guest.guest_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        guest.users?.id?.includes(debouncedSearchTerm)

      const matchesRSVP = filterByRSVP === 'all' || guest.rsvp_status === filterByRSVP
      return matchesSearch && matchesRSVP
    })
  }, [guests, debouncedSearchTerm, filterByRSVP])

  // Memoized status counts
  const statusCounts = useMemo(() => ({
    total: guests.length,
    attending: guests.filter(guest => guest.rsvp_status === 'attending').length,
    pending: guests.filter(guest => guest.rsvp_status === 'pending').length,
    maybe: guests.filter(guest => guest.rsvp_status === 'maybe').length,
    declined: guests.filter(guest => guest.rsvp_status === 'declined').length,
  }), [guests])

  return {
    guests,
    filteredGuests,
    statusCounts,
    loading: isLoading,
    error,
    refetch
  }
}

// Mutation hook for updating guest RSVP status
export function useUpdateGuestRSVP() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guestId, newStatus, eventId }: { 
      guestId: string
      newStatus: string
      eventId: string 
    }) => {
      const { error } = await supabase
        .from('event_guests')
        .update({ rsvp_status: newStatus })
        .eq('id', guestId)

      if (error) {
        logger.databaseError('Failed to update guest RSVP', error)
        throw error
      }

      return { guestId, newStatus, eventId }
    },
    onMutate: async ({ guestId, newStatus, eventId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: guestQueryKeys.eventGuests(eventId) })

      // Snapshot previous value
      const previousGuests = queryClient.getQueryData(guestQueryKeys.eventGuests(eventId))

      // Optimistically update
      queryClient.setQueryData(guestQueryKeys.eventGuests(eventId), (old: Guest[]) =>
        old?.map(guest =>
          guest.id === guestId
            ? { ...guest, rsvp_status: newStatus as any }
            : guest
        ) || []
      )

      return { previousGuests }
    },
    onSuccess: ({ eventId }) => {
      logger.api('Guest RSVP updated successfully')
      // Invalidate to ensure we have latest data
      queryClient.invalidateQueries({ queryKey: guestQueryKeys.eventGuests(eventId) })
    },
    onError: (error, { eventId }, context) => {
      logger.error('Failed to update guest RSVP', error)
      
      // Rollback optimistic update
      if (context?.previousGuests) {
        queryClient.setQueryData(guestQueryKeys.eventGuests(eventId), context.previousGuests)
      }
    },
  })
}

// Mutation hook for removing a guest
export function useRemoveGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guestId, eventId }: { guestId: string, eventId: string }) => {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', guestId)

      if (error) {
        logger.databaseError('Failed to remove guest', error)
        throw error
      }

      return { guestId, eventId }
    },
    onSuccess: ({ eventId }) => {
      logger.api('Guest removed successfully')
      queryClient.invalidateQueries({ queryKey: guestQueryKeys.eventGuests(eventId) })
    },
    onError: (error) => {
      logger.error('Failed to remove guest', error)
    },
  })
}

// Mutation hook for bulk RSVP updates
export function useBulkUpdateGuestRSVP() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ guestIds, newStatus, eventId }: { 
      guestIds: string[]
      newStatus: string
      eventId: string 
    }) => {
      const operations = guestIds.map(guestId =>
        supabase
          .from('event_guests')
          .update({ rsvp_status: newStatus })
          .eq('id', guestId)
      )

      await Promise.all(operations)
      return { guestIds, newStatus, eventId }
    },
    onSuccess: ({ eventId }) => {
      logger.api('Bulk guest RSVP update successful')
      queryClient.invalidateQueries({ queryKey: guestQueryKeys.eventGuests(eventId) })
    },
    onError: (error) => {
      logger.error('Failed to bulk update guest RSVPs', error)
    },
  })
}

// Hook for real-time guest updates
export function useGuestRealtime(eventId: string) {
  const queryClient = useQueryClient()

  // Set up real-time subscription
  useRealtimeSubscription({
    subscriptionId: `guest-cache-${eventId}`,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      logger.realtime('Real-time guest update', { 
        eventType: payload.eventType, 
        guestId: payload.new && 'id' in payload.new ? payload.new.id : null 
      })
      
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: guestQueryKeys.eventGuests(eventId) })
    }, [queryClient, eventId]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest realtime subscription error', error)
    }, [])
  })

  return {
    invalidateGuests: () => queryClient.invalidateQueries({ queryKey: guestQueryKeys.eventGuests(eventId) }),
  }
} 