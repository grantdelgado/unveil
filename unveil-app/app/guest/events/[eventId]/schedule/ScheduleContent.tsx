'use client';

import { fromUTCToEventZone, getTimezoneLabel } from '@/lib/utils/timezone';
import { ScheduleItemCard } from '@/components/features/scheduling/ScheduleItemCard';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];
type ScheduleItem = Database['public']['Tables']['event_schedule_items']['Row'];

interface ScheduleContentProps {
  event: Event;
  scheduleItems: ScheduleItem[];
  eventId: string;
}

/**
 * Client component for schedule content rendering with progressive enhancement
 * Receives server-rendered data and adds client-side interactivity
 */
export function ScheduleContent({ event, scheduleItems }: ScheduleContentProps) {
  // Get timezone info for display
  const effectiveTimeZone = event.time_zone || 'UTC';
  const timeZoneLabel = getTimezoneLabel(event.time_zone);
  const isUsingFallbackTimezone = !event.time_zone;

  // Group items by date (in event timezone)
  const groupedItems = scheduleItems.reduce(
    (groups, item) => {
      const eventTimeData = fromUTCToEventZone(
        item.start_at,
        effectiveTimeZone,
      );
      const dateKey = eventTimeData?.date || item.start_at.split('T')[0];

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
      return groups;
    },
    {} as Record<string, ScheduleItem[]>,
  );

  const sortedDates = Object.keys(groupedItems).sort();

  if (scheduleItems.length === 0) {
    return (
      <div className="space-y-6">
        {/* Event Info Header - Only show if location or timezone info available */}
        {(event.location || event.time_zone) && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="text-2xl">📍</div>
              <div>
                {event.location && (
                  <p className="font-medium text-gray-900 mb-1">{event.location}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                    <p className="text-blue-800 text-xs font-medium">
                      {timeZoneLabel}
                    </p>
                  </div>
                  {isUsingFallbackTimezone && (
                    <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg inline-block">
                      <p className="text-amber-800 text-xs font-medium">
                        Times in your local timezone
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Schedule Items Yet
            </h3>
            <p className="text-gray-600">
              The host hasn&apos;t added any timeline details yet, but check back
              soon for updates!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Info Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="text-2xl">📍</div>
          <div>
            {event.location && (
              <p className="font-medium text-gray-900 mb-1">{event.location}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                <p className="text-blue-800 text-xs font-medium">
                  {timeZoneLabel}
                </p>
              </div>
              {isUsingFallbackTimezone && (
                <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg inline-block">
                  <p className="text-amber-800 text-xs font-medium">
                    Times in your local timezone
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Items by Date */}
      {sortedDates.map((date) => {
        const items = groupedItems[date];
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', {
          weekday: 'long',
        });
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return (
          <div key={date} className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Date Header */}
            <div className="bg-gradient-to-r from-purple-50 to-rose-50 p-6 border-b">
              <h3 className="font-semibold text-[15px] tracking-tight text-foreground">{dayOfWeek}</h3>
              <p className="text-gray-700 text-sm">{formattedDate}</p>
            </div>

            {/* Schedule Items */}
            <div className="p-6 space-y-6">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-slide-up"
                  style={{
                    animationDelay: `${index * 0.04}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <ScheduleItemCard
                    item={item}
                    eventId={event.id}
                    eventTimeZone={effectiveTimeZone}
                    isHost={false}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
