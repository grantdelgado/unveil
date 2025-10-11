/**
 * Guest Management Feature Flags
 * 
 * Safe rollback configuration for guest pagination and related features.
 * Set paginationEnabled to false to revert to pre-pagination behavior.
 */

export const GuestsFlags = {
  /**
   * Enable server-side pagination with infinite scroll in Guest Management.
   * When false, reverts to loading all guests at once (pre-change behavior).
   */
  paginationEnabled: true,
  
  /**
   * Enable server-side search in Guest Management.
   * When true, uses the search-aware RPC function for filtering.
   * When false, falls back to client-side filtering (legacy behavior).
   */
  serverSearchEnabled: true,
  
  /**
   * Number of guests to fetch per page.
   * Used only when paginationEnabled is true.
   */
  pageSize: 50 as const,
  
  /**
   * Debounce delay for infinite scroll intersection observer (ms).
   * Prevents multiple rapid pagination requests.
   */
  scrollDebounceMs: 150 as const,
  
  /**
   * Debounce delay for search input (ms).
   * Prevents excessive API calls while typing.
   */
  searchDebounceMs: 300 as const,
} as const;

export type GuestsFlagsType = typeof GuestsFlags;
