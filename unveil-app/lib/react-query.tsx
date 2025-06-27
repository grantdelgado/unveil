'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

import { logger } from './logger'

// Query client configuration with optimized defaults
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Cache for 5 minutes by default
        staleTime: 5 * 60 * 1000,
        // Keep in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed requests 2 times
        retry: 2,
        // Retry with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for real-time data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect by default (Supabase handles this)
        refetchOnReconnect: false,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        // Log mutation errors
        onError: (error) => {
          logger.error('Mutation error:', error)
        },
      },
    },
  })

// React Query Provider Component
export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new query client instance for each app instance
  // This ensures SSR compatibility
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  )
}

// Query keys for consistent cache management
export const queryKeys = {
  // User queries
  user: (userId?: string) => ['user', userId] as const,
  currentUser: () => ['user', 'current'] as const,
  
  // Event queries
  events: () => ['events'] as const,
  event: (eventId: string) => ['events', eventId] as const,
  eventGuests: (eventId: string) => ['events', eventId, 'guests'] as const,
  eventStats: (eventId: string) => ['events', eventId, 'stats'] as const,
  userEvents: (userId: string) => ['events', 'user', userId] as const,
  hostEvents: (userId: string) => ['events', 'host', userId] as const,
  guestEvents: (userId: string) => ['events', 'guest', userId] as const,
  
  // Media queries
  eventMedia: (eventId: string) => ['media', 'event', eventId] as const,
  mediaItem: (mediaId: string) => ['media', mediaId] as const,
  mediaStats: (eventId: string) => ['media', 'stats', eventId] as const,
  
  // Message queries
  eventMessages: (eventId: string) => ['messages', 'event', eventId] as const,
  messageStats: (eventId: string) => ['messages', 'stats', eventId] as const,
  
  // Guest queries
  eventGuestsList: (eventId: string) => ['guests', 'event', eventId] as const,
  guestStats: (eventId: string) => ['guests', 'stats', eventId] as const,
} as const

// Cache invalidation utilities
export const cacheUtils = {
  // Invalidate all event-related data
  invalidateEvent: (queryClient: QueryClient, eventId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.eventGuests(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.eventStats(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.eventMedia(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.eventMessages(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.eventGuestsList(eventId) })
  },
  
  // Invalidate all user events
  invalidateUserEvents: (queryClient: QueryClient, userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.userEvents(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.hostEvents(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.guestEvents(userId) })
  },
  
  // Invalidate media for an event
  invalidateEventMedia: (queryClient: QueryClient, eventId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.eventMedia(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.mediaStats(eventId) })
  },
  
  // Invalidate messages for an event
  invalidateEventMessages: (queryClient: QueryClient, eventId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.eventMessages(eventId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.messageStats(eventId) })
  },
  
  // Clear all cached data (useful for logout)
  clearAll: (queryClient: QueryClient) => {
    queryClient.clear()
  },
}

// Export the query client type for hooks
export type { QueryClient } from '@tanstack/react-query' 