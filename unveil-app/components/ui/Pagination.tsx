'use client'

import { memo } from 'react'
// Simple arrow components to avoid external dependency
const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)
import { cn } from '@/lib/utils'
import { paginationUtils, type PaginationState, type PaginationControls } from '@/hooks/common/usePagination'

interface PaginationProps {
  pagination: PaginationState
  controls: PaginationControls
  className?: string
  showPageNumbers?: boolean
  showPageSizeSelector?: boolean
  showInfo?: boolean
  pageSizeOptions?: number[]
  maxVisiblePages?: number
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Comprehensive pagination component with multiple display options
 */
export const Pagination = memo<PaginationProps>(({
  pagination,
  controls,
  className,
  showPageNumbers = true,
  showPageSizeSelector = true,
  showInfo = true,
  pageSizeOptions = [10, 20, 50, 100],
  maxVisiblePages = 7,
  size = 'md',
}) => {
  const { page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage } = pagination
  const { nextPage, previousPage, goToPage, setPageSize } = controls

  if (totalCount === 0) {
    return null
  }

  const pageNumbers = paginationUtils.generatePageNumbers(page, totalPages, maxVisiblePages)
  const startItem = Math.min((page - 1) * pageSize + 1, totalCount)
  const endItem = Math.min(page * pageSize, totalCount)

  const sizeClasses = {
    sm: {
      button: 'px-2 py-1 text-xs',
      select: 'text-xs px-2 py-1',
      info: 'text-xs',
    },
    md: {
      button: 'px-3 py-2 text-sm',
      select: 'text-sm px-3 py-2',
      info: 'text-sm',
    },
    lg: {
      button: 'px-4 py-3 text-base',
      select: 'text-base px-4 py-3',
      info: 'text-base',
    },
  }

  const classes = sizeClasses[size]

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      {/* Page Info */}
      {showInfo && (
        <div className={cn('text-stone-600', classes.info)}>
          Showing {startItem} to {endItem} of {totalCount} entries
        </div>
      )}

      {/* Page Size Selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2">
          <span className={cn('text-stone-600', classes.info)}>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={cn(
              'border border-stone-300 rounded bg-white text-stone-900',
              'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent',
              classes.select
            )}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={previousPage}
          disabled={!hasPreviousPage}
          className={cn(
            'flex items-center gap-1 border border-stone-300 rounded bg-white text-stone-700',
            'hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent',
            classes.button
          )}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page Numbers */}
        {showPageNumbers && (
          <div className="flex items-center gap-1">
            {/* First page ellipsis */}
            {pageNumbers[0] > 1 && (
              <>
                <PageButton
                  page={1}
                  currentPage={page}
                  onClick={() => goToPage(1)}
                  size={size}
                />
                {pageNumbers[0] > 2 && (
                  <span className={cn('text-stone-400', classes.info)}>…</span>
                )}
              </>
            )}

            {/* Visible page numbers */}
            {pageNumbers.map((pageNum) => (
              <PageButton
                key={pageNum}
                page={pageNum}
                currentPage={page}
                onClick={() => goToPage(pageNum)}
                size={size}
              />
            ))}

            {/* Last page ellipsis */}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className={cn('text-stone-400', classes.info)}>…</span>
                )}
                <PageButton
                  page={totalPages}
                  currentPage={page}
                  onClick={() => goToPage(totalPages)}
                  size={size}
                />
              </>
            )}
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={nextPage}
          disabled={!hasNextPage}
          className={cn(
            'flex items-center gap-1 border border-stone-300 rounded bg-white text-stone-700',
            'hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent',
            classes.button
          )}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
})

Pagination.displayName = 'Pagination'

/**
 * Individual page button component
 */
const PageButton = memo<{
  page: number
  currentPage: number
  onClick: () => void
  size: 'sm' | 'md' | 'lg'
}>(({ page, currentPage, onClick, size }) => {
  const isActive = page === currentPage

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded border',
        'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent',
        sizeClasses[size],
        isActive
          ? 'bg-rose-600 text-white border-rose-600'
          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
      )}
      aria-label={`Go to page ${page}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {page}
    </button>
  )
})

PageButton.displayName = 'PageButton'

/**
 * Simple pagination component for basic use cases
 */
export const SimplePagination = memo<{
  pagination: PaginationState
  controls: PaginationControls
  className?: string
}>(({ pagination, controls, className }) => {
  const { hasNextPage, hasPreviousPage } = pagination
  const { nextPage, previousPage } = controls

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <button
        onClick={previousPage}
        disabled={!hasPreviousPage}
        className={cn(
          'flex items-center gap-1 px-3 py-2 text-sm border border-stone-300 rounded bg-white text-stone-700',
          'hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent'
        )}
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Previous
      </button>

      <button
        onClick={nextPage}
        disabled={!hasNextPage}
        className={cn(
          'flex items-center gap-1 px-3 py-2 text-sm border border-stone-300 rounded bg-white text-stone-700',
          'hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent'
        )}
      >
        Next
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  )
})

SimplePagination.displayName = 'SimplePagination'

/**
 * Load More button for infinite scroll pagination
 */
export const LoadMoreButton = memo<{
  hasMore: boolean
  isLoading?: boolean
  onLoadMore: () => void
  className?: string
  children?: React.ReactNode
}>(({ hasMore, isLoading = false, onLoadMore, className, children = 'Load More' }) => {
  if (!hasMore) {
    return null
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <button
        onClick={onLoadMore}
        disabled={isLoading}
        className={cn(
          'px-6 py-3 text-sm font-medium text-rose-600 bg-white border border-rose-600 rounded-lg',
          'hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent',
          'transition-colors duration-200'
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : (
          children
        )}
      </button>
    </div>
  )
})

LoadMoreButton.displayName = 'LoadMoreButton' 