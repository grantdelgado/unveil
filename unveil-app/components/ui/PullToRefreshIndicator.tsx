'use client'

import React from 'react'
import type { PullToRefreshIndicatorProps } from '@/hooks/common/usePullToRefresh'

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  isPulling,
  isRefreshing,
  pullDistance,
  canRefresh,
  refreshProgress,
}) => {
  if (!isPulling && !isRefreshing) return null

  return (
    <div
      className="flex items-center justify-center py-4 transition-transform duration-200"
      style={{
        transform: `translateY(${Math.max(0, pullDistance - 60)}px)`,
      }}
    >
      <div className="flex items-center gap-3">
        {isRefreshing ? (
          <>
            <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-purple-600">Refreshing...</span>
          </>
        ) : (
          <>
            <div
              className={`w-5 h-5 border-2 rounded-full transition-all duration-200 ${
                canRefresh
                  ? 'border-green-600 bg-green-100'
                  : 'border-stone-400'
              }`}
              style={{
                transform: `rotate(${refreshProgress * 180}deg)`,
              }}
            >
              <div className="w-1 h-1 bg-current rounded-full" />
            </div>
            <span className={`text-sm font-medium transition-colors duration-200 ${
              canRefresh ? 'text-green-600' : 'text-stone-600'
            }`}>
              {canRefresh ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  )
} 