'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getTimezoneLabel, fromUTCToEventZone } from '@/lib/utils/timezone';
import { LoadingSpinner } from '@/components/ui';
import type { Database } from '@/app/reference/supabase.types';

interface EventScheduleProps {
  eventId: string;
  eventDate: string; // Keep for potential future use, but not currently used
  location?: string | null;
  timeZone?: string | null;
}

type ScheduleItem = Database['public']['Tables']['event_schedule_items']['Row'];

export default function EventSchedule({
  eventId,
  eventDate: _eventDate, // eslint-disable-line @typescript-eslint/no-unused-vars
  location,
  timeZone,
}: EventScheduleProps) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get timezone info for display
  const effectiveTimeZone = timeZone || 'UTC';
  const timeZoneLabel = getTimezoneLabel(timeZone || null);
  const isUsingFallbackTimezone = !timeZone;

  // Load schedule items from database
  useEffect(() => {
    const loadScheduleItems = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('event_schedule_items')
          .select('*')
          .eq('event_id', eventId)
          .order('start_at', { ascending: true });

        if (fetchError) {
          console.error('Error loading schedule items:', fetchError);
          setError('Failed to load schedule');
          return;
        }

        setScheduleItems(data || []);
      } catch (error) {
        console.error('Unexpected error loading schedule:', error);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadScheduleItems();
    }
  }, [eventId]);

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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
          <span className="ml-3 text-gray-600">Loading schedule...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Schedule
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (scheduleItems.length === 0) {
    return (
      <div className="space-y-6">
        {/* Event Info Header - Only show if location or timezone info available */}
        {(location || timeZone) && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start space-x-4">
              <div className="text-2xl">📍</div>
              <div>
                {location && (
                  <p className="font-medium text-gray-900 mb-1">{location}</p>
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
              Schedule Coming Soon
            </h3>
            <p className="text-gray-600">
              Schedule details will appear here once your hosts add them.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Helper to determine if we should show year in date headers
  const currentYear = new Date().getFullYear();
  const shouldShowYear = (dateStr: string) => {
    const itemYear = new Date(dateStr).getFullYear();
    return itemYear !== currentYear;
  };

  // Helper to format date headers with conditional year
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure consistent parsing
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };

    if (shouldShowYear(dateStr)) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className="space-y-6">
      {/* Event Info Header - Only show if location or timezone info available */}
      {(location || timeZone) && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="text-2xl">📍</div>
            <div>
              {location && (
                <p className="font-medium text-gray-900 mb-1">{location}</p>
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

      {/* Schedule Items grouped by date */}
      {sortedDates.map((date) => (
        <div key={date} className="bg-white rounded-2xl shadow-lg p-6">
          {/* Date Header */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <span>📅</span>
            <span>{formatDateHeader(date)}</span>
          </h3>

          {/* Items for this date */}
          <div className="space-y-3">
            {groupedItems[date].map((item) => {
              const startTime = fromUTCToEventZone(
                item.start_at,
                effectiveTimeZone,
              );
              const endTime = item.end_at
                ? fromUTCToEventZone(item.end_at, effectiveTimeZone)
                : null;

              return (
                <div
                  key={item.id}
                  className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="text-2xl mt-0.5">🕐</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {item.title}
                        </h4>

                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span className="font-mono font-medium">
                            {startTime?.formatted}
                            {endTime && ` – ${endTime.formatted}`}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                          {item.location && (
                            <div className="flex items-center space-x-1">
                              <span>📍</span>
                              <span>{item.location}</span>
                            </div>
                          )}

                          {item.attire && (
                            <div className="flex items-center space-x-1">
                              <span>👔</span>
                              <span>{item.attire}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Helpful tip */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
        <p className="text-blue-800 text-sm">
          <span className="font-medium">💡 Tip:</span> Times are approximate and
          may vary slightly on the day.
        </p>
      </div>
    </div>
  );
}
