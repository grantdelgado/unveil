'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type {
  RecipientPreviewData,
  FilteredGuest,
} from '@/lib/types/messaging';

interface RecipientPreviewProps {
  previewData: RecipientPreviewData | null;
  loading: boolean;
  error: string | null;
  className?: string;
}

// Constants for virtualization
const ITEM_HEIGHT = 44; // Height of each guest item in pixels
const CONTAINER_MAX_HEIGHT = 320; // Max height of scrollable area
const VISIBLE_BUFFER = 3; // Extra items to render outside viewport

/**
 * Real-time recipient preview panel showing filtered guests
 * Displays guest names with tag indicators and summary statistics
 */
export function RecipientPreview({
  previewData,
  loading,
  error,
  className,
}: RecipientPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Virtualization calculations
  const guests = previewData?.guests || [];
  const totalHeight = guests.length * ITEM_HEIGHT;
  const containerHeight = Math.min(totalHeight, CONTAINER_MAX_HEIGHT);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ITEM_HEIGHT) - VISIBLE_BUFFER,
  );
  const endIndex = Math.min(
    guests.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + VISIBLE_BUFFER,
  );
  const visibleGuests = guests.slice(startIndex, endIndex);

  // Handle scroll for virtualization
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Reset scroll when guests change
  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [guests.length]);

  /**
   * Get emoji for tag display
   */
  const getTagEmoji = (tag: string): string => {
    const emojiMap: Record<string, string> = {
      family: '👨‍👩‍👧‍👦',
      'college friends': '🎓',
      'work colleagues': '💼',
      neighbors: '🏠',
      'school friends': '📚',
      'sports team': '⚽',
      church: '⛪',
      'close friends': '❤️',
      relatives: '👪',
      coworkers: '💼',
    };

    return emojiMap[tag.toLowerCase()] || '🏷️';
  };

  /**
   * Get attendance status emoji and color (RSVP-Lite)
   * In RSVP-Lite: attending by default unless explicitly declined
   */
  const getAttendanceDisplay = (guest: FilteredGuest) => {
    // Check if guest has declined (RSVP-Lite)
    const isDeclined = !!(
      guest as FilteredGuest & { declined_at?: string | null }
    ).declined_at;

    if (isDeclined) {
      return { emoji: '❌', color: 'text-red-600', label: 'Declined' };
    }

    // Default: attending
    return { emoji: '✅', color: 'text-green-600', label: 'Attending' };
  };

  /**
   * Render individual guest item with enhanced layout
   */
  const GuestItem = ({ guest }: { guest: FilteredGuest }) => {
    const attendanceDisplay = getAttendanceDisplay(guest);

    return (
      <div
        className={cn(
          'flex items-center justify-between px-3 transition-colors',
          'hover:bg-purple-50 border-b border-gray-100 last:border-b-0',
        )}
        style={{
          height: ITEM_HEIGHT,
          minHeight: ITEM_HEIGHT,
        }}
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Attendance Status (RSVP-Lite) */}
          <span
            className={cn('text-sm flex-shrink-0', attendanceDisplay.color)}
            title={`Status: ${attendanceDisplay.label}`}
          >
            {attendanceDisplay.emoji}
          </span>

          {/* Guest Name */}
          <span className="text-sm font-medium text-gray-900 truncate flex-1">
            {guest.displayName}
          </span>

          {/* Phone status indicator */}
          {!guest.hasPhone && (
            <span
              className="text-xs text-red-500 flex-shrink-0"
              title="No phone number - will be skipped"
            >
              📵
            </span>
          )}
        </div>

        {/* Tag indicators */}
        {guest.tags.length > 0 && (
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            {guest.tags.slice(0, 2).map((tag, tagIndex) => (
              <span key={tagIndex} className="text-sm" title={tag}>
                {getTagEmoji(tag)}
              </span>
            ))}
            {guest.tags.length > 2 && (
              <span
                className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full"
                title={`+${guest.tags.length - 2} more: ${guest.tags.slice(2).join(', ')}`}
              >
                +{guest.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Enhanced summary statistics with better mobile layout
   */
  const SummaryStats = ({ data }: { data: RecipientPreviewData }) => {
    const invalidPhoneCount = data.totalCount - data.validRecipientsCount;
    const percentageValid =
      data.totalCount > 0
        ? Math.round((data.validRecipientsCount / data.totalCount) * 100)
        : 0;

    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="text-center sm:text-left">
            <div className="font-medium text-purple-900">Total Selected</div>
            <div className="text-lg font-bold text-purple-700">
              {data.totalCount}
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="font-medium text-purple-900">
              Will Receive Message
            </div>
            <div className="text-lg font-bold text-green-700">
              {data.validRecipientsCount}
            </div>
          </div>
          <div className="text-center sm:text-left">
            <div className="font-medium text-purple-900">Success Rate</div>
            <div className="text-lg font-bold text-blue-700">
              {percentageValid}%
            </div>
          </div>
        </div>

        {invalidPhoneCount > 0 && (
          <div className="mt-3 text-xs text-amber-800 bg-amber-100 border border-amber-200 rounded px-3 py-2">
            <span className="font-medium">⚠️ Notice:</span> {invalidPhoneCount}{' '}
            guest{invalidPhoneCount !== 1 ? 's' : ''} will be skipped (missing
            phone number)
          </div>
        )}

        {data.totalCount > 100 && (
          <div className="mt-2 text-xs text-blue-700 bg-blue-100 rounded px-2 py-1">
            ⚡ Large list detected - using optimized rendering for best
            performance
          </div>
        )}
      </div>
    );
  };

  /**
   * Empty state component
   */
  const EmptyState = ({ message, icon }: { message: string; icon: string }) => (
    <div className="text-center py-8">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className={cn('border rounded-lg bg-white', className)}>
        <div className="p-4">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('border rounded-lg bg-white', className)}>
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">❌ {error}</div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!previewData) {
    return (
      <div className={cn('border rounded-lg bg-white', className)}>
        <div className="p-4">
          <EmptyState message="Loading recipient preview..." icon="⏳" />
        </div>
      </div>
    );
  }

  const { totalCount, validRecipientsCount } = previewData;

  return (
    <div className={cn('border rounded-lg bg-white', className)}>
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Recipient Preview
        </h3>

        {/* Summary Statistics */}
        <SummaryStats data={previewData} />

        {/* Guest List with Virtualization */}
        {totalCount === 0 ? (
          <EmptyState
            message="No guests match your filter criteria"
            icon="🤷‍♂️"
          />
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header for desktop */}
            <div className="hidden sm:block bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between py-2 px-3 text-xs font-medium text-gray-600">
                <span>Guest (RSVP Status)</span>
                <span>Tags</span>
              </div>
            </div>

            {/* Virtualized guest list */}
            <div
              ref={scrollRef}
              className="overflow-y-auto"
              style={{ height: containerHeight }}
              onScroll={handleScroll}
            >
              {/* Virtual spacer for items before visible range */}
              {startIndex > 0 && (
                <div style={{ height: startIndex * ITEM_HEIGHT }} />
              )}

              {/* Visible items */}
              {visibleGuests.map((guest) => (
                <GuestItem key={guest.id} guest={guest} />
              ))}

              {/* Virtual spacer for items after visible range */}
              {endIndex < guests.length && (
                <div
                  style={{ height: (guests.length - endIndex) * ITEM_HEIGHT }}
                />
              )}
            </div>

            {/* Scroll indicator and stats */}
            {totalCount > 8 && (
              <div className="bg-gray-50 border-t border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Showing{' '}
                    {Math.min(endIndex - startIndex, visibleGuests.length)} of{' '}
                    {totalCount} guests
                  </span>
                  {totalCount > 8 && (
                    <span className="flex items-center gap-1">
                      <span>📜</span>
                      Scroll for more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delivery method indicator */}
        {validRecipientsCount > 0 && (
          <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            💬 Messages will be sent via push notification to{' '}
            {validRecipientsCount} recipient
            {validRecipientsCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
