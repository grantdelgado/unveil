/**
 * Canonical Query Key Factory System
 * 
 * This module provides a single source of truth for all React Query keys
 * in the Unveil application. It ensures consistency, type safety, and
 * predictable cache invalidation patterns.
 * 
 * Key Design Principles:
 * - All keys are arrays: [domain, version, subdomain?, paramsObj?]
 * - Version is always 'v1' for stability
 * - Parameters are normalized objects for consistent cache keys
 * - EventId is always included when relevant for scoping
 * 
 * @version 1.0.0
 */

export type KeyPart = readonly [string, 'v1', string?, Record<string, unknown>?];
type Params = Record<string, unknown>;

/**
 * Stable parameter normalizer
 * Sorts object keys and creates deterministic serialization
 * This ensures that { limit: 10, page: 2 } and { page: 2, limit: 10 } 
 * produce identical cache keys
 */
export const normalize = <T extends Params>(obj: T | undefined): T | undefined => {
  if (!obj) return obj;
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries) as T;
};

/**
 * Canonical Query Key Factory
 * 
 * Each domain follows the pattern:
 * - Simple queries: [domain, 'v1', action, { required params }]
 * - Scoped queries: [domain, 'v1', action, { eventId, ...optional params }]
 * - List queries: [domain, 'v1', 'list', { eventId?, ...filters }]
 */
export const qk = {
  /**
   * Events Domain
   */
  events: {
    byId: (eventId: string) =>
      ['events', 'v1', 'byId', { eventId }] as const,
    listMine: () =>
      ['events', 'v1', 'listMine'] as const,
    listHost: (userId: string) =>
      ['events', 'v1', 'listHost', { userId }] as const,
  },

  /**
   * Event Guests Domain
   */
  eventGuests: {
    list: (eventId: string, opts?: { search?: string; tag?: string; page?: number; pageSize?: number; includeDeleted?: boolean }) =>
      ['eventGuests', 'v1', 'list', normalize({ eventId, ...opts })] as const,
    byId: (eventId: string, guestId: string) =>
      ['eventGuests', 'v1', 'byId', { eventId, guestId }] as const,
    byPhone: (eventId: string, phone: string) =>
      ['eventGuests', 'v1', 'byPhone', { eventId, phone }] as const,
    counts: (eventId: string, opts?: { includeDeleted?: boolean }) =>
      ['eventGuests', 'v1', 'counts', normalize({ eventId, ...opts })] as const,
    unifiedCounts: (eventId: string) =>
      ['eventGuests', 'v1', 'unifiedCounts', { eventId }] as const,
  },

  /**
   * Messages Domain
   */
  messages: {
    list: (eventId: string, opts?: { type?: 'announcement' | 'channel' | 'direct'; cursor?: string; limit?: number; includeArchived?: boolean }) =>
      ['messages', 'v1', 'list', normalize({ eventId, ...opts })] as const,
    byId: (eventId: string, messageId: string) =>
      ['messages', 'v1', 'byId', { eventId, messageId }] as const,
    archived: (eventId: string, opts?: { cursor?: string; limit?: number }) =>
      ['messages', 'v1', 'archived', normalize({ eventId, ...opts })] as const,
  },

  /**
   * Message Deliveries Domain  
   */
  messageDeliveries: {
    byMessage: (eventId: string, messageId: string, opts?: { status?: 'pending' | 'delivered' | 'failed'; page?: number; pageSize?: number }) =>
      ['messageDeliveries', 'v1', 'byMessage', normalize({ eventId, messageId, ...opts })] as const,
    stats: (eventId: string, messageId: string) =>
      ['messageDeliveries', 'v1', 'stats', { eventId, messageId }] as const,
  },

  /**
   * Scheduled Messages Domain
   */
  scheduledMessages: {
    list: (eventId: string, opts?: { status?: 'pending' | 'sent' | 'failed'; cursor?: string; limit?: number }) =>
      ['scheduledMessages', 'v1', 'list', normalize({ eventId, ...opts })] as const,
    byId: (eventId: string, scheduledMessageId: string) =>
      ['scheduledMessages', 'v1', 'byId', { eventId, scheduledMessageId }] as const,
    audienceCount: (scheduledMessageId: string) =>
      ['scheduledMessages', 'v1', 'audienceCount', { scheduledMessageId }] as const,
  },

  /**
   * Media Domain
   */
  media: {
    feed: (eventId: string, opts?: { cursor?: string; limit?: number; kind?: 'photo' | 'video'; uploaderUserId?: string }) =>
      ['media', 'v1', 'feed', normalize({ eventId, ...opts })] as const,
    byId: (eventId: string, mediaId: string) =>
      ['media', 'v1', 'byId', { eventId, mediaId }] as const,
    stats: (eventId: string) =>
      ['media', 'v1', 'stats', { eventId }] as const,
  },

  /**
   * Users Domain
   */
  users: {
    me: () => 
      ['users', 'v1', 'me'] as const,
    byId: (userId: string) =>
      ['users', 'v1', 'byId', { userId }] as const,
    profile: (userId: string) =>
      ['users', 'v1', 'profile', { userId }] as const,
  },

  /**
   * Analytics Domain
   */
  analytics: {
    event: (eventId: string, opts?: { timeRange?: '7d' | '30d' | '90d'; includeDeleted?: boolean }) =>
      ['analytics', 'v1', 'event', normalize({ eventId, ...opts })] as const,
    rsvp: (eventId: string) =>
      ['analytics', 'v1', 'rsvp', { eventId }] as const,
    messaging: (eventId: string, opts?: { timeRange?: '7d' | '30d' | '90d' }) =>
      ['analytics', 'v1', 'messaging', normalize({ eventId, ...opts })] as const,
  },
} as const;

/**
 * Type-safe query key union
 * This ensures TypeScript knows about all possible query keys
 */
export type QueryKey = ReturnType<
  | typeof qk.events.byId
  | typeof qk.events.listMine  
  | typeof qk.events.listHost
  | typeof qk.eventGuests.list
  | typeof qk.eventGuests.byId
  | typeof qk.eventGuests.byPhone
  | typeof qk.eventGuests.counts
  | typeof qk.eventGuests.unifiedCounts
  | typeof qk.messages.list
  | typeof qk.messages.byId
  | typeof qk.messages.archived
  | typeof qk.messageDeliveries.byMessage
  | typeof qk.messageDeliveries.stats
  | typeof qk.scheduledMessages.list
  | typeof qk.scheduledMessages.byId
  | typeof qk.scheduledMessages.audienceCount
  | typeof qk.media.feed
  | typeof qk.media.byId
  | typeof qk.media.stats
  | typeof qk.users.me
  | typeof qk.users.byId
  | typeof qk.users.profile
  | typeof qk.analytics.event
  | typeof qk.analytics.rsvp
  | typeof qk.analytics.messaging
>;

/**
 * Domain-specific key matchers for invalidation
 * These help with partial matching during cache invalidation
 */
export const keyMatchers = {
  // Match all keys for a specific event across all domains
  forEvent: (eventId: string) => ({
    predicate: (query: { queryKey: readonly unknown[] }) => {
      const params = query.queryKey[3] as Record<string, unknown> | undefined;
      return params?.eventId === eventId;
    }
  }),

  // Match all keys for a specific domain
  forDomain: (domain: string) => ({
    predicate: (query: { queryKey: readonly unknown[] }) => {
      return query.queryKey[0] === domain;
    }
  }),

  // Match all keys for a specific domain action
  forDomainAction: (domain: string, action: string) => ({
    predicate: (query: { queryKey: readonly unknown[] }) => {
      return query.queryKey[0] === domain && query.queryKey[2] === action;
    }
  }),
} as const;

/**
 * Legacy key migration helpers
 * These help map old keys to new canonical keys during migration
 */
export const legacyKeyMigration = {
  // Map legacy ['messages', eventId] to new canonical key
  messages: (eventId: string) => qk.messages.list(eventId),
  
  // Map legacy ['guests', eventId] to new canonical key  
  guests: (eventId: string) => qk.eventGuests.list(eventId),
  
  // Map legacy ['scheduled-messages', eventId] to new canonical key
  scheduledMessages: (eventId: string) => qk.scheduledMessages.list(eventId),
  
  // Map legacy ['media', eventId] to new canonical key
  media: (eventId: string) => qk.media.feed(eventId),
  
  // Map legacy ['events'] to new canonical key
  events: () => qk.events.listMine(),
} as const;

/**
 * Development utilities for debugging keys
 */
export const devUtils = {
  // Pretty print a query key for debugging
  prettyPrint: (key: readonly unknown[]): string => {
    const [domain, version, action, params] = key;
    if (params) {
      return `${domain}:${version}:${action}(${JSON.stringify(params)})`;
    }
    return `${domain}:${version}:${action || 'base'}()`;
  },

  // Check if a key follows canonical format
  isCanonical: (key: readonly unknown[]): boolean => {
    return (
      Array.isArray(key) &&
      key.length >= 2 &&
      typeof key[0] === 'string' &&
      key[1] === 'v1'
    );
  },

  // Extract domain from any key
  getDomain: (key: readonly unknown[]): string | null => {
    return typeof key[0] === 'string' ? key[0] : null;
  },

  // Extract event ID from any key if present
  getEventId: (key: readonly unknown[]): string | null => {
    const params = key[3] as Record<string, unknown> | undefined;
    return typeof params?.eventId === 'string' ? params.eventId : null;
  },
} as const;
