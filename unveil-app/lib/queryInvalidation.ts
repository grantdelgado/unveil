/**
 * Centralized Query Invalidation System
 * 
 * This module provides a unified interface for cache invalidation across
 * the Unveil application. It uses the canonical query key factory to ensure
 * consistent and predictable cache management.
 * 
 * Key Features:
 * - Type-safe invalidation helpers
 * - Smart partial invalidation patterns
 * - Performance-optimized batch operations
 * - Domain-specific invalidation strategies
 * 
 * @version 1.0.0
 */

import { QueryClient } from '@tanstack/react-query';
import { qk, keyMatchers } from './queryKeys';

/**
 * Centralized invalidation interface
 * Provides clean, chainable API for cache invalidation
 */
export const invalidate = (qc: QueryClient) => ({
  /**
   * Event Domain Invalidations
   */
  event: {
    // Invalidate single event
    byId: (eventId: string) => 
      qc.invalidateQueries({ queryKey: qk.events.byId(eventId) }),
    
    // Invalidate user's event list
    listMine: () => 
      qc.invalidateQueries({ queryKey: qk.events.listMine() }),
      
    // Invalidate host event list
    listHost: (userId: string) =>
      qc.invalidateQueries({ queryKey: qk.events.listHost(userId) }),
    
    // Invalidate all event-related data across domains
    allForEvent: (eventId: string) =>
      qc.invalidateQueries(keyMatchers.forEvent(eventId)),
  },

  /**
   * Guest Domain Invalidations  
   */
  guests: {
    // Invalidate guest list (with optional filters preserved)
    list: (eventId: string, opts?: Parameters<typeof qk.eventGuests.list>[1]) =>
      qc.invalidateQueries({ queryKey: qk.eventGuests.list(eventId, opts) }),
    
    // Invalidate all guest lists for event (regardless of filters)
    allLists: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'eventGuests' && 
                 query.queryKey[2] === 'list' &&
                 params?.eventId === eventId;
        }
      }),
    
    // Invalidate specific guest
    byId: (eventId: string, guestId: string) =>
      qc.invalidateQueries({ queryKey: qk.eventGuests.byId(eventId, guestId) }),
    
    // Invalidate guest counts
    counts: (eventId: string, opts?: Parameters<typeof qk.eventGuests.counts>[1]) =>
      qc.invalidateQueries({ queryKey: qk.eventGuests.counts(eventId, opts) }),
    
    // Invalidate unified counts
    unifiedCounts: (eventId: string) =>
      qc.invalidateQueries({ queryKey: qk.eventGuests.unifiedCounts(eventId) }),
    
    // Invalidate all guest-related data for event
    allForEvent: (eventId: string) => {
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'eventGuests' && params?.eventId === eventId;
        }
      });
    },
  },

  /**
   * Messages Domain Invalidations
   */
  messages: {
    // Invalidate message list (with optional filters preserved)
    list: (eventId: string, opts?: Parameters<typeof qk.messages.list>[1]) =>
      qc.invalidateQueries({ queryKey: qk.messages.list(eventId, opts) }),
    
    // Invalidate all message lists for event (regardless of filters)
    allLists: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'messages' && 
                 query.queryKey[2] === 'list' &&
                 params?.eventId === eventId;
        }
      }),
    
    // Invalidate specific message
    byId: (eventId: string, messageId: string) =>
      qc.invalidateQueries({ queryKey: qk.messages.byId(eventId, messageId) }),
    
    // Invalidate archived messages
    archived: (eventId: string, opts?: Parameters<typeof qk.messages.archived>[1]) =>
      qc.invalidateQueries({ queryKey: qk.messages.archived(eventId, opts) }),
    
    // Invalidate all message-related data for event
    allForEvent: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'messages' && params?.eventId === eventId;
        }
      }),
  },

  /**
   * Message Deliveries Domain Invalidations
   */
  messageDeliveries: {
    // Invalidate deliveries for specific message
    byMessage: (eventId: string, messageId: string, opts?: Parameters<typeof qk.messageDeliveries.byMessage>[2]) =>
      qc.invalidateQueries({ queryKey: qk.messageDeliveries.byMessage(eventId, messageId, opts) }),
    
    // Invalidate delivery stats
    stats: (eventId: string, messageId: string) =>
      qc.invalidateQueries({ queryKey: qk.messageDeliveries.stats(eventId, messageId) }),
    
    // Invalidate all deliveries for message
    allForMessage: (eventId: string, messageId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'messageDeliveries' && 
                 params?.eventId === eventId &&
                 params?.messageId === messageId;
        }
      }),
  },

  /**
   * Scheduled Messages Domain Invalidations
   */
  scheduledMessages: {
    // Invalidate scheduled message list
    list: (eventId: string, opts?: Parameters<typeof qk.scheduledMessages.list>[1]) =>
      qc.invalidateQueries({ queryKey: qk.scheduledMessages.list(eventId, opts) }),
    
    // Invalidate all scheduled message lists for event
    allLists: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'scheduledMessages' && 
                 query.queryKey[2] === 'list' &&
                 params?.eventId === eventId;
        }
      }),
    
    // Invalidate specific scheduled message
    byId: (eventId: string, scheduledMessageId: string) =>
      qc.invalidateQueries({ queryKey: qk.scheduledMessages.byId(eventId, scheduledMessageId) }),
    
    // Invalidate audience count
    audienceCount: (scheduledMessageId: string) =>
      qc.invalidateQueries({ queryKey: qk.scheduledMessages.audienceCount(scheduledMessageId) }),
    
    // Invalidate all scheduled messages for event
    allForEvent: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'scheduledMessages' && params?.eventId === eventId;
        }
      }),
  },

  /**
   * Media Domain Invalidations
   */
  media: {
    // Invalidate media feed
    feed: (eventId: string, opts?: Parameters<typeof qk.media.feed>[1]) =>
      qc.invalidateQueries({ queryKey: qk.media.feed(eventId, opts) }),
    
    // Invalidate all media feeds for event
    allFeeds: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'media' && 
                 query.queryKey[2] === 'feed' &&
                 params?.eventId === eventId;
        }
      }),
    
    // Invalidate specific media
    byId: (eventId: string, mediaId: string) =>
      qc.invalidateQueries({ queryKey: qk.media.byId(eventId, mediaId) }),
    
    // Invalidate media stats
    stats: (eventId: string) =>
      qc.invalidateQueries({ queryKey: qk.media.stats(eventId) }),
    
    // Invalidate all media for event
    allForEvent: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'media' && params?.eventId === eventId;
        }
      }),
  },

  /**
   * Users Domain Invalidations
   */
  users: {
    // Invalidate current user
    me: () =>
      qc.invalidateQueries({ queryKey: qk.users.me() }),
    
    // Invalidate specific user
    byId: (userId: string) =>
      qc.invalidateQueries({ queryKey: qk.users.byId(userId) }),
    
    // Invalidate user profile
    profile: (userId: string) =>
      qc.invalidateQueries({ queryKey: qk.users.profile(userId) }),
  },

  /**
   * Analytics Domain Invalidations
   */
  analytics: {
    // Invalidate event analytics
    event: (eventId: string, opts?: Parameters<typeof qk.analytics.event>[1]) =>
      qc.invalidateQueries({ queryKey: qk.analytics.event(eventId, opts) }),
    
    // Invalidate RSVP analytics
    rsvp: (eventId: string) =>
      qc.invalidateQueries({ queryKey: qk.analytics.rsvp(eventId) }),
    
    // Invalidate messaging analytics
    messaging: (eventId: string, opts?: Parameters<typeof qk.analytics.messaging>[1]) =>
      qc.invalidateQueries({ queryKey: qk.analytics.messaging(eventId, opts) }),
    
    // Invalidate all analytics for event
    allForEvent: (eventId: string) =>
      qc.invalidateQueries({
        predicate: (query) => {
          const params = query.queryKey[3] as Record<string, unknown> | undefined;
          return query.queryKey[0] === 'analytics' && params?.eventId === eventId;
        }
      }),
  },
});

/**
 * Smart invalidation strategies for common mutation patterns
 * These combine multiple invalidations for typical use cases
 */
export const smartInvalidate = (qc: QueryClient) => ({
  /**
   * After guest RSVP change
   */
  guestRsvp: async (eventId: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.guests.counts(eventId),
      inv.guests.unifiedCounts(eventId),
      inv.analytics.rsvp(eventId),
      inv.analytics.event(eventId),
      // Don't invalidate full guest list unless necessary - just counts
    ]);
  },

  /**
   * After guest creation/update
   */
  guestMutation: async (eventId: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.guests.allLists(eventId),
      inv.guests.counts(eventId),
      inv.guests.unifiedCounts(eventId),
      inv.analytics.rsvp(eventId),
      inv.analytics.event(eventId),
    ]);
  },

  /**
   * After message sent
   */
  messageSent: async (eventId: string, messageId?: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.messages.allLists(eventId),
      inv.analytics.messaging(eventId),
      inv.analytics.event(eventId),
      // Include deliveries if messageId provided
      ...(messageId ? [inv.messageDeliveries.stats(eventId, messageId)] : []),
    ]);
  },

  /**
   * After scheduled message created/updated  
   */
  scheduledMessageMutation: async (eventId: string, scheduledMessageId?: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.scheduledMessages.allLists(eventId),
      inv.analytics.messaging(eventId),
      // Include audience count if ID provided
      ...(scheduledMessageId ? [inv.scheduledMessages.audienceCount(scheduledMessageId)] : []),
    ]);
  },

  /**
   * After media uploaded
   */
  mediaUploaded: async (eventId: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.media.allFeeds(eventId),
      inv.media.stats(eventId),
      inv.analytics.event(eventId),
    ]);
  },

  /**
   * After event updated
   */
  eventMutation: async (eventId: string, userId?: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.event.byId(eventId),
      inv.event.listMine(),
      ...(userId ? [inv.event.listHost(userId)] : []),
      inv.analytics.event(eventId),
    ]);
  },

  /**
   * Full event refresh - use sparingly for major operations
   */
  fullEventRefresh: async (eventId: string) => {
    const inv = invalidate(qc);
    await Promise.all([
      inv.event.allForEvent(eventId),
      inv.guests.allForEvent(eventId),  
      inv.messages.allForEvent(eventId),
      inv.scheduledMessages.allForEvent(eventId),
      inv.media.allForEvent(eventId),
      inv.analytics.allForEvent(eventId),
    ]);
  },
});

/**
 * Legacy invalidation bridge
 * Helps during migration by providing old-style invalidation
 * that internally uses new canonical keys
 */
export const legacyInvalidate = (qc: QueryClient) => ({
  // Legacy: queryClient.invalidateQueries({ queryKey: ['messages', eventId] })
  // New: invalidate(qc).messages.allLists(eventId)
  messages: (eventId: string) => invalidate(qc).messages.allLists(eventId),
  
  // Legacy: queryClient.invalidateQueries({ queryKey: ['guests', eventId] })
  // New: invalidate(qc).guests.allLists(eventId)  
  guests: (eventId: string) => invalidate(qc).guests.allLists(eventId),
  
  // Legacy: queryClient.invalidateQueries({ queryKey: ['scheduled-messages', eventId] })
  // New: invalidate(qc).scheduledMessages.allLists(eventId)
  scheduledMessages: (eventId: string) => invalidate(qc).scheduledMessages.allLists(eventId),
  
  // Legacy: queryClient.invalidateQueries({ queryKey: ['media', eventId] })
  // New: invalidate(qc).media.allFeeds(eventId)
  media: (eventId: string) => invalidate(qc).media.allFeeds(eventId),
  
  // Legacy: queryClient.invalidateQueries({ queryKey: ['events'] })
  // New: invalidate(qc).event.listMine()
  events: () => invalidate(qc).event.listMine(),
});

/**
 * Development utilities for cache debugging
 */
export const devInvalidationUtils = {
  // Log all active queries before invalidation
  logActiveQueries: (qc: QueryClient, domain?: string): void => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const cache = qc.getQueryCache();
    const queries = cache.getAll();
    
    console.group(`🔍 Active Queries${domain ? ` (${domain})` : ''}`);
    queries
      .filter(q => domain ? q.queryKey[0] === domain : true)
      .forEach(q => {
        console.log(`📋 ${JSON.stringify(q.queryKey)} - ${q.state.status}`);
      });
    console.groupEnd();
  },

  // Count queries by domain
  getQueryStats: (qc: QueryClient): Record<string, number> => {
    const cache = qc.getQueryCache();
    const queries = cache.getAll();
    
    return queries.reduce((stats, query) => {
      const domain = query.queryKey[0] as string;
      stats[domain] = (stats[domain] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  },
};
