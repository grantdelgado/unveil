/**
 * Shared Pagination Utilities
 * 
 * Centralized cursor-based pagination logic with stable ordering support.
 * Handles the canonical ordering pattern: created_at DESC, id DESC.
 */

import type { PaginationOptions } from '../_core/types';

// Cursor-based pagination configuration
export interface PaginationConfig extends PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export const PAGINATION_DEFAULTS = {
  defaultLimit: 30,
  maxLimit: 100,
  olderBatchSize: 20,
} as const;

/**
 * Normalize pagination options with defaults and limits
 */
export function normalizePaginationOptions(
  options?: PaginationOptions
): { cursor?: string; limit: number } {
  const limit = Math.min(
    options?.limit ?? PAGINATION_DEFAULTS.defaultLimit,
    PAGINATION_DEFAULTS.maxLimit
  );
  
  return {
    cursor: options?.cursor,
    limit,
  };
}

/**
 * Extract cursor from a record with created_at timestamp
 * Uses created_at as the cursor value for stable pagination
 */
export function extractCursor<T extends { created_at: string }>(
  item: T
): string {
  return item.created_at;
}

/**
 * Deduplicate items by id, preserving stable order
 * Handles cases where the same item appears in multiple pages
 */
export function deduplicateById<T extends { id: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const deduplicated: T[] = [];
  
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      deduplicated.push(item);
    }
  }
  
  return deduplicated;
}

/**
 * Deduplicate guest messages by message_id (for guest read-model V2)
 */
export function deduplicateGuestMessagesById<T extends { message_id: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const deduplicated: T[] = [];
  
  for (const item of items) {
    if (!seen.has(item.message_id)) {
      seen.add(item.message_id);
      deduplicated.push(item);
    }
  }
  
  return deduplicated;
}

/**
 * Merge new page data with existing pages
 * Handles both append (pagination) and prepend (realtime) scenarios
 */
export function mergePage<T extends { id: string; created_at: string }>(
  existingItems: T[],
  newItems: T[],
  options: {
    mode: 'append' | 'prepend' | 'replace';
    deduplicateBy?: 'id' | 'created_at';
    maxItems?: number;
  } = { mode: 'append' }
): T[] {
  let merged: T[] = [];
  
  switch (options.mode) {
    case 'append':
      // Add new items to the end (older messages)
      merged = [...existingItems, ...newItems];
      break;
      
    case 'prepend':
      // Add new items to the beginning (newer messages from realtime)
      merged = [...newItems, ...existingItems];
      break;
      
    case 'replace':
      // Replace entirely
      merged = newItems;
      break;
  }
  
  // Deduplicate based on specified field
  if (options.deduplicateBy === 'created_at') {
    const seen = new Set<string>();
    merged = merged.filter(item => {
      const key = item.created_at;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    // Default to id-based deduplication
    merged = deduplicateById(merged);
  }
  
  // Apply max items limit if specified
  if (options.maxItems && merged.length > options.maxItems) {
    merged = merged.slice(0, options.maxItems);
  }
  
  return merged;
}

/**
 * Merge guest message pages (special handling for read-model V2)
 */
export function mergeGuestMessagePage<T extends { message_id: string; created_at: string }>(
  existingItems: T[],
  newItems: T[],
  options: {
    mode: 'append' | 'prepend' | 'replace';
    maxItems?: number;
  } = { mode: 'append' }
): T[] {
  let merged: T[] = [];
  
  switch (options.mode) {
    case 'append':
      merged = [...existingItems, ...newItems];
      break;
      
    case 'prepend':
      merged = [...newItems, ...existingItems];
      break;
      
    case 'replace':
      merged = newItems;
      break;
  }
  
  // Deduplicate by message_id
  merged = deduplicateGuestMessagesById(merged);
  
  // Apply max items limit
  if (options.maxItems && merged.length > options.maxItems) {
    merged = merged.slice(0, options.maxItems);
  }
  
  return merged;
}

/**
 * Check if we have reached the end of pagination
 * Based on returned item count vs requested limit
 */
export function hasMorePages(
  returnedCount: number,
  requestedLimit: number
): boolean {
  return returnedCount >= requestedLimit;
}

/**
 * Generate pagination state for infinite queries
 */
export interface PaginationState {
  hasNextPage: boolean;
  nextCursor?: string;
  isLoadingMore: boolean;
  totalLoaded: number;
}

export function createPaginationState<T extends { created_at: string }>(
  pages: T[][],
  lastPageCount: number,
  requestedLimit: number,
  isLoadingMore = false
): PaginationState {
  const totalLoaded = pages.flat().length;
  const hasNextPage = hasMorePages(lastPageCount, requestedLimit);
  
  // Get cursor from last item of last page
  let nextCursor: string | undefined;
  if (hasNextPage && pages.length > 0) {
    const lastPage = pages[pages.length - 1];
    if (lastPage.length > 0) {
      nextCursor = extractCursor(lastPage[lastPage.length - 1]);
    }
  }
  
  return {
    hasNextPage,
    nextCursor,
    isLoadingMore,
    totalLoaded,
  };
}

/**
 * Development utility: Log pagination metrics
 */
export function logPaginationMetrics(
  operation: string,
  metrics: {
    requestedLimit: number;
    returnedCount: number;
    cursor?: string;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  }
) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Pagination] ${operation}:`, {
      requested: metrics.requestedLimit,
      returned: metrics.returnedCount,
      cursor: metrics.cursor ? 'present' : 'none',
      pages: metrics.totalPages,
      totalItems: metrics.totalItems,
      hasMore: metrics.hasMore,
      efficiency: `${Math.round((metrics.returnedCount / metrics.requestedLimit) * 100)}%`,
    });
  }
}
