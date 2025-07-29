/**
 * AuthCache - Persistent caching system for auth-related data
 *
 * Provides efficient storage and retrieval of user profiles, events,
 * roles, and session data with automatic invalidation and cleanup.
 */

'use client';

import { logger } from '@/lib/logger';

// Cache entry structure
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  tags: string[];
}

// Cache configuration
export interface CacheConfig {
  /**
   * Default TTL in milliseconds (default: 5 minutes)
   */
  defaultTTL?: number;
  /**
   * Maximum cache size in entries
   */
  maxSize?: number;
  /**
   * Whether to persist to localStorage
   */
  persistent?: boolean;
  /**
   * Cache version for invalidation
   */
  version?: string;
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

// Supported cache keys for type safety
export type AuthCacheKey =
  | 'user_profile'
  | 'user_events'
  | 'event_roles'
  | 'session_data'
  | `event_${string}`
  | `guest_list_${string}`
  | `messages_${string}`;

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastCleanup: number;
}

/**
 * Main AuthCache class
 */
export class AuthCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: Required<CacheConfig>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    lastCleanup: Date.now(),
  };

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      persistent: true,
      version: '1.0.0',
      debug: false,
      ...config,
    };

    // Load persisted cache on initialization
    if (this.config.persistent && typeof window !== 'undefined') {
      this.loadFromStorage();
    }

    // Setup periodic cleanup
    this.setupCleanup();
  }

  /**
   * Set a cache entry
   */
  set<T>(
    key: AuthCacheKey,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      persist?: boolean;
    } = {},
  ): void {
    const {
      ttl = this.config.defaultTTL,
      tags = [],
      persist = this.config.persistent,
    } = options;

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      version: this.config.version,
      tags,
    };

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;

    if (this.config.debug) {
      logger.debug(`[AuthCache] Set key: ${key}, TTL: ${ttl}ms`, { tags });
    }

    // Persist to localStorage if enabled
    if (persist && typeof window !== 'undefined') {
      this.persistToStorage();
    }
  }

  /**
   * Get a cache entry
   */
  get<T>(key: AuthCacheKey): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      if (this.config.debug) {
        logger.debug(`[AuthCache] Miss: ${key}`);
      }
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      if (this.config.debug) {
        logger.debug(`[AuthCache] Expired: ${key}`);
      }
      return null;
    }

    // Check version compatibility
    if (entry.version !== this.config.version) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      if (this.config.debug) {
        logger.debug(`[AuthCache] Version mismatch: ${key}`);
      }
      return null;
    }

    this.stats.hits++;
    if (this.config.debug) {
      logger.debug(`[AuthCache] Hit: ${key}`);
    }

    return entry.data;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: AuthCacheKey): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: AuthCacheKey): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      if (this.config.debug) {
        logger.debug(`[AuthCache] Deleted: ${key}`);
      }
    }
    return deleted;
  }

  /**
   * Clear cache entries by tag
   */
  invalidateByTag(tag: string): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      if (this.cache.delete(key)) {
        deletedCount++;
      }
    });

    this.stats.size = this.cache.size;

    if (this.config.debug) {
      logger.debug(
        `[AuthCache] Invalidated ${deletedCount} entries with tag: ${tag}`,
      );
    }

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;

    if (this.config.debug) {
      logger.debug('[AuthCache] Cleared all entries');
    }

    // Clear localStorage
    if (this.config.persistent && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_cache');
      } catch (error) {
        logger.error('Failed to clear cache from storage:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      ...this.stats,
      hitRate,
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check cache health and cleanup if needed
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt || entry.version !== this.config.version) {
        keysToDelete.push(key);
      }
    }

    // Delete expired entries
    keysToDelete.forEach((key) => this.cache.delete(key));

    this.stats.size = this.cache.size;
    this.stats.lastCleanup = now;

    if (this.config.debug && keysToDelete.length > 0) {
      logger.debug(
        `[AuthCache] Cleaned up ${keysToDelete.length} expired entries`,
      );
    }
  }

  /**
   * Export cache data for backup/debugging
   */
  export(): Record<string, CacheEntry<unknown>> {
    const exported: Record<string, CacheEntry<unknown>> = {};
    for (const [key, entry] of this.cache.entries()) {
      exported[key] = entry;
    }
    return exported;
  }

  /**
   * Import cache data from backup
   */
  import(data: Record<string, CacheEntry<unknown>>): number {
    let importedCount = 0;
    const now = Date.now();

    for (const [key, entry] of Object.entries(data)) {
      // Only import non-expired entries with matching version
      if (now <= entry.expiresAt && entry.version === this.config.version) {
        this.cache.set(key, entry);
        importedCount++;
      }
    }

    this.stats.size = this.cache.size;

    if (this.config.debug) {
      logger.debug(`[AuthCache] Imported ${importedCount} entries`);
    }

    return importedCount;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.config.debug) {
        logger.debug(`[AuthCache] Evicted oldest entry: ${oldestKey}`);
      }
    }
  }

  /**
   * Setup periodic cleanup
   */
  private setupCleanup(): void {
    if (typeof window !== 'undefined') {
      // Cleanup every 5 minutes
      setInterval(
        () => {
          this.cleanup();
        },
        5 * 60 * 1000,
      );

      // Cleanup on page visibility change
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.cleanup();
        }
      });
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('auth_cache');
      if (stored) {
        const data = JSON.parse(stored);
        this.import(data);
      }
    } catch (error) {
      logger.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Persist cache to localStorage
   */
  private persistToStorage(): void {
    try {
      const data = this.export();
      localStorage.setItem('auth_cache', JSON.stringify(data));
    } catch (error) {
      logger.error('Failed to persist cache to storage:', error);
    }
  }
}

// Global cache instance
let globalAuthCache: AuthCache | null = null;

/**
 * Get the global auth cache instance
 */
export function getAuthCache(): AuthCache {
  if (!globalAuthCache) {
    globalAuthCache = new AuthCache({
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      persistent: true,
      version: '1.0.0',
      debug: process.env.NODE_ENV === 'development',
    });
  }
  return globalAuthCache;
}

/**
 * Utility functions for common cache operations
 */
export const authCacheUtils = {
  /**
   * Cache user profile data
   */
  setUserProfile(userId: string, profile: unknown): void {
    const cache = getAuthCache();
    cache.set('user_profile', profile, {
      ttl: 10 * 60 * 1000, // 10 minutes for profile data
      tags: [`user:${userId}`],
    });
  },

  /**
   * Get cached user profile
   */
  getUserProfile(): unknown | null {
    const cache = getAuthCache();
    return cache.get('user_profile');
  },

  /**
   * Cache user events
   */
  setUserEvents(userId: string, events: unknown[]): void {
    const cache = getAuthCache();
    cache.set('user_events', events, {
      ttl: 5 * 60 * 1000, // 5 minutes for events list
      tags: [`user:${userId}`, 'events'],
    });
  },

  /**
   * Get cached user events
   */
  getUserEvents(): unknown[] | null {
    const cache = getAuthCache();
    return cache.get('user_events');
  },

  /**
   * Cache event roles
   */
  setEventRoles(userId: string, roles: Record<string, string>): void {
    const cache = getAuthCache();
    cache.set('event_roles', roles, {
      ttl: 10 * 60 * 1000, // 10 minutes for roles
      tags: [`user:${userId}`, 'roles'],
    });
  },

  /**
   * Get cached event roles
   */
  getEventRoles(): Record<string, string> | null {
    const cache = getAuthCache();
    return cache.get('event_roles');
  },

  /**
   * Cache specific event data
   */
  setEventData(eventId: string, data: unknown): void {
    const cache = getAuthCache();
    cache.set(`event_${eventId}` as AuthCacheKey, data, {
      ttl: 3 * 60 * 1000, // 3 minutes for event data
      tags: [`event:${eventId}`],
    });
  },

  /**
   * Get cached event data
   */
  getEventData(eventId: string): unknown | null {
    const cache = getAuthCache();
    return cache.get(`event_${eventId}` as AuthCacheKey);
  },

  /**
   * Invalidate all user-related cache
   */
  invalidateUser(userId: string): void {
    const cache = getAuthCache();
    cache.invalidateByTag(`user:${userId}`);
  },

  /**
   * Invalidate event-related cache
   */
  invalidateEvent(eventId: string): void {
    const cache = getAuthCache();
    cache.invalidateByTag(`event:${eventId}`);
  },

  /**
   * Clear all auth cache on logout
   */
  clearOnLogout(): void {
    const cache = getAuthCache();
    cache.clear();
  },
};

export default AuthCache;
