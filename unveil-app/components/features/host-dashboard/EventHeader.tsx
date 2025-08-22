'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { formatEventDate } from '@/lib/utils';
import { CardContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface EventHeaderProps {
  event: Event;
  guestCount: number;
  children?: React.ReactNode; // For QuickActions or other action elements
  isCollapsed?: boolean;
  className?: string;
}

export function EventHeader({
  event,
  guestCount,
  children,
  isCollapsed = false,
  className,
}: EventHeaderProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Truncate description for collapsed view
  const shouldTruncateDescription =
    event.description && event.description.length > 120;
  const displayDescription =
    shouldTruncateDescription && !showFullDescription
      ? event.description?.substring(0, 120) + '...'
      : event.description;
  return (
    <CardContainer
      maxWidth="xl"
      className={cn(
        'bg-gradient-to-r from-purple-600 to-[#FF6B6B] text-white border-0 transition-all duration-300 ease-in-out',
        isCollapsed ? 'py-4' : 'py-6',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col lg:flex-row lg:items-start lg:justify-between transition-all duration-300',
          isCollapsed ? 'gap-3' : 'gap-6',
        )}
      >
        <div
          className={cn(
            'flex-1 transition-all duration-300',
            isCollapsed ? 'space-y-2' : 'space-y-4',
          )}
        >
          <div className="flex items-start gap-4">
            {/* Event Image - smaller when collapsed */}
            {event.header_image_url && (
              <div
                className={cn(
                  'rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/20 transition-all duration-300',
                  isCollapsed ? 'w-12 h-12' : 'w-16 h-16',
                )}
              >
                <Image
                  src={event.header_image_url}
                  alt={event.title}
                  width={isCollapsed ? 48 : 64}
                  height={isCollapsed ? 48 : 64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Host Badge & Event Details */}
            <div className="min-w-0 flex-1">
              {/* Host Badge - smaller when collapsed */}
              {!isCollapsed && (
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3 transition-all duration-300">
                  <span className="text-lg">👑</span>
                  <span className="text-sm font-medium">Host Dashboard</span>
                </div>
              )}

              {/* Event Title - smaller when collapsed */}
              <h1
                className={cn(
                  'font-bold text-white transition-all duration-300',
                  isCollapsed ? 'text-xl mb-2' : 'text-2xl mb-3',
                )}
              >
                {event.title}
              </h1>

              {/* Event Meta Information - more compact when collapsed */}
              <div
                className={cn(
                  'flex text-white/80 transition-all duration-300',
                  isCollapsed
                    ? 'flex-row items-center gap-4 text-sm'
                    : 'flex-col sm:flex-row sm:items-center gap-4',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'transition-all duration-300',
                      isCollapsed ? 'text-base' : 'text-xl',
                    )}
                  >
                    📅
                  </span>
                  <span className="font-medium">
                    {formatEventDate(event.event_date)}
                  </span>
                </div>

                {event.location && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'transition-all duration-300',
                        isCollapsed ? 'text-base' : 'text-xl',
                      )}
                    >
                      📍
                    </span>
                    <span className="font-medium">{event.location}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'transition-all duration-300',
                      isCollapsed ? 'text-base' : 'text-xl',
                    )}
                  >
                    👥
                  </span>
                  <span className="font-medium">
                    {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Description - hidden when collapsed, with read more functionality */}
          {event.description && !isCollapsed && (
            <div className="max-w-2xl">
              <p className="text-white/90 leading-relaxed">
                {displayDescription}
              </p>
              {shouldTruncateDescription && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-white/70 hover:text-white text-sm font-medium mt-2 transition-colors duration-200"
                >
                  {showFullDescription ? 'Read less' : 'Read more'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Area - for QuickActions or other components */}
        {children && (
          <div
            className={cn(
              'flex-shrink-0 transition-all duration-300',
              isCollapsed && 'scale-90',
            )}
          >
            {children}
          </div>
        )}
      </div>
    </CardContainer>
  );
}
