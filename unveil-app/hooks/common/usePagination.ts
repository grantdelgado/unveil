import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import { UI_CONFIG } from '@/lib/constants'

export interface PaginationState {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  offset: number
}

export interface PaginationControls {
  nextPage: () => void
  previousPage: () => void
  goToPage: (page: number) => void
  setPageSize: (size: number) => void
  reset: () => void
}

export interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
  maxPageSize?: number
}

export interface PaginatedQuery<T> {
  queryKey: unknown[]
  queryFn: (params: { page: number; pageSize: number; offset: number }) => Promise<{
    data: T[]
    totalCount: number
    error?: Error
  }>
  enabled?: boolean
  staleTime?: number
}

/**
 * Hook for client-side pagination of data arrays
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
) {
  const {
    initialPage = 1,
    initialPageSize = UI_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
    maxPageSize = 100,
  } = options

  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(Math.min(initialPageSize, maxPageSize))

  const paginationState = useMemo((): PaginationState => {
    const totalCount = data.length
    const totalPages = Math.ceil(totalCount / pageSize)
    const offset = (page - 1) * pageSize
    
    return {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      offset,
    }
  }, [data.length, page, pageSize])

  const paginatedData = useMemo(() => {
    const startIndex = paginationState.offset
    const endIndex = startIndex + pageSize
    return data.slice(startIndex, endIndex)
  }, [data, paginationState.offset, pageSize])

  const controls: PaginationControls = useMemo(() => ({
    nextPage: () => {
      if (paginationState.hasNextPage) {
        setPage(prev => prev + 1)
        logger.debug(`Pagination: Next page -> ${page + 1}`)
      }
    },
    previousPage: () => {
      if (paginationState.hasPreviousPage) {
        setPage(prev => prev - 1)
        logger.debug(`Pagination: Previous page -> ${page - 1}`)
      }
    },
    goToPage: (targetPage: number) => {
      const clampedPage = Math.max(1, Math.min(targetPage, paginationState.totalPages))
      setPage(clampedPage)
      logger.debug(`Pagination: Go to page ${clampedPage}`)
    },
    setPageSize: (newSize: number) => {
      const clampedSize = Math.max(1, Math.min(newSize, maxPageSize))
      setPageSizeState(clampedSize)
      setPage(1) // Reset to first page when changing page size
      logger.debug(`Pagination: Page size changed to ${clampedSize}`)
    },
    reset: () => {
      setPage(initialPage)
      setPageSizeState(initialPageSize)
      logger.debug('Pagination: Reset to initial state')
    },
  }), [
    paginationState.hasNextPage,
    paginationState.hasPreviousPage,
    paginationState.totalPages,
    page,
    maxPageSize,
    initialPage,
    initialPageSize,
  ])

  return {
    data: paginatedData,
    pagination: paginationState,
    controls,
  }
}

/**
 * Hook for server-side pagination with React Query
 */
export function usePaginatedQuery<T>(
  query: PaginatedQuery<T>,
  options: UsePaginationOptions = {}
) {
  const {
    initialPage = 1,
    initialPageSize = UI_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
    maxPageSize = 100,
  } = options

  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(Math.min(initialPageSize, maxPageSize))

  const offset = (page - 1) * pageSize

  const queryResult = useQuery({
    queryKey: [...query.queryKey, 'paginated', page, pageSize],
    queryFn: () => query.queryFn({ page, pageSize, offset }),
    enabled: query.enabled,
    staleTime: query.staleTime,
    placeholderData: (previousData) => previousData, // Important for smooth pagination
  })

  const paginationState = useMemo((): PaginationState => {
    const totalCount = queryResult.data?.totalCount || 0
    const totalPages = Math.ceil(totalCount / pageSize)
    
    return {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      offset,
    }
  }, [queryResult.data?.totalCount, page, pageSize, offset])

  const controls: PaginationControls = useMemo(() => ({
    nextPage: () => {
      if (paginationState.hasNextPage) {
        setPage(prev => prev + 1)
        logger.debug(`Server pagination: Next page -> ${page + 1}`)
      }
    },
    previousPage: () => {
      if (paginationState.hasPreviousPage) {
        setPage(prev => prev - 1)
        logger.debug(`Server pagination: Previous page -> ${page - 1}`)
      }
    },
    goToPage: (targetPage: number) => {
      const clampedPage = Math.max(1, Math.min(targetPage, paginationState.totalPages))
      setPage(clampedPage)
      logger.debug(`Server pagination: Go to page ${clampedPage}`)
    },
    setPageSize: (newSize: number) => {
      const clampedSize = Math.max(1, Math.min(newSize, maxPageSize))
      setPageSizeState(clampedSize)
      setPage(1) // Reset to first page when changing page size
      logger.debug(`Server pagination: Page size changed to ${clampedSize}`)
    },
    reset: () => {
      setPage(initialPage)
      setPageSizeState(initialPageSize)
      logger.debug('Server pagination: Reset to initial state')
    },
  }), [
    paginationState.hasNextPage,
    paginationState.hasPreviousPage,
    paginationState.totalPages,
    page,
    maxPageSize,
    initialPage,
    initialPageSize,
  ])

  return {
    data: queryResult.data?.data || [],
    pagination: paginationState,
    controls,
    isLoading: queryResult.isLoading,
    error: queryResult.error || queryResult.data?.error,
    isRefetching: queryResult.isRefetching,
    refetch: queryResult.refetch,
  }
}

/**
 * Hook for infinite scroll pagination
 */
export function useInfiniteScroll<T>(
  data: T[],
  options: {
    pageSize?: number
    threshold?: number
    onLoadMore?: () => void
  } = {}
) {
  const {
    pageSize = UI_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
    threshold = 0.8,
    onLoadMore,
  } = options

  const [loadedCount, setLoadedCount] = useState(pageSize)

  const visibleData = useMemo(() => {
    return data.slice(0, loadedCount)
  }, [data, loadedCount])

  const hasMore = loadedCount < data.length
  const progress = data.length > 0 ? loadedCount / data.length : 1

  const loadMore = useCallback(() => {
    if (hasMore) {
      setLoadedCount(prev => Math.min(prev + pageSize, data.length))
      onLoadMore?.()
      logger.debug(`Infinite scroll: Loaded ${Math.min(loadedCount + pageSize, data.length)} of ${data.length} items`)
    }
  }, [hasMore, pageSize, data.length, loadedCount, onLoadMore])

  const reset = useCallback(() => {
    setLoadedCount(pageSize)
    logger.debug('Infinite scroll: Reset to initial load')
  }, [pageSize])

  // Auto-load when approaching threshold
  const shouldAutoLoad = progress >= threshold && hasMore

  return {
    data: visibleData,
    hasMore,
    progress,
    shouldAutoLoad,
    loadMore,
    reset,
    stats: {
      loaded: loadedCount,
      total: data.length,
      remaining: data.length - loadedCount,
    },
  }
}

/**
 * Utility functions for pagination
 */
export const paginationUtils = {
  /**
   * Generate page numbers for pagination UI
   */
  generatePageNumbers: (currentPage: number, totalPages: number, maxVisible: number = 7) => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const half = Math.floor(maxVisible / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  },

  /**
   * Calculate offset for database queries
   */
  calculateOffset: (page: number, pageSize: number) => (page - 1) * pageSize,

  /**
   * Calculate page from offset
   */
  calculatePageFromOffset: (offset: number, pageSize: number) => 
    Math.floor(offset / pageSize) + 1,

  /**
   * Validate pagination parameters
   */
  validatePaginationParams: (page: number, pageSize: number, maxPageSize: number = 100) => ({
    page: Math.max(1, page),
    pageSize: Math.max(1, Math.min(pageSize, maxPageSize)),
  }),
} 