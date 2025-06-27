'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: How long data is considered fresh
            staleTime: 5 * 60 * 1000, // 5 minutes for most data
            
            // Cache time: How long data stays in cache when not being used
            gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
            
            // Retry configuration
            retry: (failureCount, error: unknown) => {
              // Don't retry on 4xx errors (client errors)
              const errorWithStatus = error as { status?: number }
              if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
                return false
              }
              // Retry up to 3 times for other errors
              return failureCount < 3
            },
            
            // Retry delay with exponential backoff
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            
            // Refetch on window focus for real-time data
            refetchOnWindowFocus: true,
            
            // Don't refetch on reconnect for cached data
            refetchOnReconnect: 'always',
          },
          mutations: {
            // Retry mutations once on network error
            retry: (failureCount, error: unknown) => {
              const errorWithStatus = error as { status?: number }
              if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
                return false
              }
              return failureCount < 1
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom"
        />
      )}
    </QueryClientProvider>
  )
}

// Predefined query keys for consistency
export const queryKeys = {
  // Events
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
  userEvents: (userId: string) => ['events', 'user', userId] as const,
  
  // Media
  media: ['media'] as const,
  eventMedia: (eventId: string) => ['media', 'event', eventId] as const,
  userMedia: (userId: string) => ['media', 'user', userId] as const,
  
  // Messages
  messages: ['messages'] as const,
  eventMessages: (eventId: string) => ['messages', 'event', eventId] as const,
  
  // Guests
  guests: ['guests'] as const,
  eventGuests: (eventId: string) => ['guests', 'event', eventId] as const,
  userGuests: (userId: string) => ['guests', 'user', userId] as const,
  
  // User profiles
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userProfile: (id: string) => ['users', 'profile', id] as const,
} as const

// Cache configuration for different data types
export const cacheConfig = {
  // Real-time data (messages, RSVP status) - shorter cache time
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },
  
  // Static data (user profiles, event details) - longer cache time
  static: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Media data - medium cache time
  media: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  },
  
  // Authentication data - very long cache time
  auth: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },
} as const

export { QueryClient } from '@tanstack/react-query' 