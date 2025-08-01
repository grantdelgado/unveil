import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query-client';

/**
 * Centralized query invalidation utilities for consistent cache management
 * Follows the performance optimization strategy from PERFORMANCE_AUDIT_REPORT.md
 */

export interface InvalidationOptions {
  queryClient: QueryClient;
  eventId?: string;
  userId?: string;
  guestId?: string;
}

/**
 * Invalidate event-related queries after mutations
 * Use this when event data changes (RSVP, guest updates, etc.)
 */
export async function invalidateEventQueries({ 
  queryClient, 
  eventId, 
  userId 
}: InvalidationOptions) {
  const invalidations: Promise<void>[] = [];

  if (eventId) {
    // Invalidate event analytics - critical for dashboard accuracy
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: ['analytics', eventId] 
      })
    );
    
    // Invalidate event guests data
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventGuests(eventId) 
      })
    );
    
    // Invalidate event messages
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventMessages(eventId) 
      })
    );
    
    // Invalidate event media
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventMedia(eventId) 
      })
    );
  }

  if (userId) {
    // Invalidate user events list
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.userEvents(userId) 
      })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate guest-specific queries after RSVP or profile changes
 */
export async function invalidateGuestQueries({ 
  queryClient, 
  eventId, 
  // guestId: Future enhancement for guest-specific invalidation
}: InvalidationOptions) {
  const invalidations: Promise<void>[] = [];

  if (eventId) {
    // Invalidate event guests
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventGuests(eventId) 
      })
    );
    
    // Invalidate analytics due to RSVP changes
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: ['analytics', eventId] 
      })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate messaging-related queries after message operations
 */
export async function invalidateMessagingQueries({ 
  queryClient, 
  eventId 
}: InvalidationOptions) {
  const invalidations: Promise<void>[] = [];

  if (eventId) {
    // Invalidate event messages
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.eventMessages(eventId) 
      })
    );
    
    // Invalidate scheduled messages
    invalidations.push(
      queryClient.invalidateQueries({ 
        queryKey: ['scheduledMessages', eventId] 
      })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Smart invalidation - only invalidate specific queries based on mutation type
 * More efficient than bulk invalidation
 */
export async function smartInvalidation({
  queryClient,
  mutationType,
  eventId,
  userId,
  guestId
}: InvalidationOptions & {
  mutationType: 'rsvp' | 'guest' | 'message' | 'event' | 'media';
}) {
  switch (mutationType) {
    case 'rsvp':
      await invalidateGuestQueries({ queryClient, eventId, guestId });
      break;
      
    case 'guest':
      await invalidateGuestQueries({ queryClient, eventId, guestId });
      break;
      
    case 'message':
      await invalidateMessagingQueries({ queryClient, eventId });
      break;
      
    case 'event':
      await invalidateEventQueries({ queryClient, eventId, userId });
      break;
      
    case 'media':
      if (eventId) {
        await queryClient.invalidateQueries({ 
          queryKey: queryKeys.eventMedia(eventId) 
        });
      }
      break;
      
    default:
      // Fallback to full event invalidation
      await invalidateEventQueries({ queryClient, eventId, userId });
  }
}

/**
 * Bulk invalidation for major operations (use sparingly)
 * Only use when multiple systems are affected
 */
export async function bulkInvalidation({ 
  queryClient, 
  eventId, 
  // userId: Future enhancement for user-specific bulk invalidation
}: InvalidationOptions) {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: ['events'] }),
    queryClient.invalidateQueries({ queryKey: ['guests'] }),
    queryClient.invalidateQueries({ queryKey: ['messages'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  ];

  if (eventId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ['media', 'event', eventId] })
    );
  }

  await Promise.all(invalidations);
}