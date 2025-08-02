'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface GuestListShimmerProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton component for guest list
 * Shows shimmer animation while guest data is loading
 */
export const GuestListShimmer = memo<GuestListShimmerProps>(({
  count = 5,
  className
}) => {
  return (
    <div className={cn('space-y-4 p-6', className)}>
      {/* Header shimmer */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
      </div>
      
      {/* Guest item shimmers */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, index) => (
          <GuestItemShimmer key={index} delay={index * 100} />
        ))}
      </div>
    </div>
  );
});

/**
 * Individual guest item shimmer with staggered animation
 */
const GuestItemShimmer = memo<{ delay?: number }>(({ delay = 0 }) => {
  return (
    <div 
      className="p-4 space-y-3"
      style={{
        animationDelay: `${delay}ms`
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox shimmer */}
        <div className="w-4 h-4 bg-gray-200 rounded mt-1 animate-pulse" />
        
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              {/* Name shimmer */}
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
              
              {/* Contact info shimmers */}
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
            </div>
            
            {/* Actions shimmer */}
            <div className="flex flex-col gap-2 ml-4">
              <div className="h-11 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-11 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

GuestItemShimmer.displayName = 'GuestItemShimmer';
GuestListShimmer.displayName = 'GuestListShimmer';