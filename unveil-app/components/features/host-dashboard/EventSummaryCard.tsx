'use client';

import React from 'react';
import { formatEventDate } from '@/lib/utils';
import { CardContainer } from '@/components/ui';
import { useUnifiedGuestCounts } from '@/hooks/guests';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface EventSummaryCardProps {
  event: Event;
  className?: string;
}

export function EventSummaryCard({ event, className }: EventSummaryCardProps) {
  // Use unified guest counts for consistency with Guest Management
  const { counts, loading, error } = useUnifiedGuestCounts(event.id);

  if (error) {
    console.error('Error fetching guest stats:', error);
  }

  return (
    <CardContainer
      className={cn('bg-white border border-gray-200 shadow-sm', className)}
    >
      <div className="space-y-4">
        {/* Event Title and Basic Info */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-xl font-bold text-gray-900">
              {event.title}
            </h2>
            {!event.is_public && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md flex-shrink-0">
                <span className="text-sm">🔒</span>
                Hidden from guests
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📅</span>
              <span className="font-medium">
                {formatEventDate(event.event_date)}
              </span>
            </div>

            {event.location && (
              <div className="flex items-center gap-1.5">
                <span className="text-base">📍</span>
                <span className="font-medium">{event.location}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-base">👥</span>
              <span className="font-medium">
                {counts.total_invited}{' '}
                {counts.total_invited === 1 ? 'invited' : 'invited'}
              </span>
            </div>
          </div>
        </div>

        {/* Guest Attendance */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">
              Guest Attendance
            </h3>
            {!loading && counts.total_invited > 0 && (
              <span className="text-sm font-medium text-gray-600">
                {counts.attending} attending
              </span>
            )}
          </div>

          {loading ? (
            <div className="animate-pulse">
              <div className="h-2 bg-gray-200 rounded-full mb-3"></div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : counts.total_invited === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <div className="text-xl mb-1">👥</div>
              <p className="font-medium text-sm">No guests invited yet</p>
              <p className="text-xs">Start by importing your guest list</p>
            </div>
          ) : (
            <>
              {/* Progress Bar - RSVP-Lite format */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                <div className="h-full flex">
                  {counts.attending > 0 && (
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${(counts.attending / counts.total_invited) * 100}%`,
                      }}
                    />
                  )}
                  {counts.declined > 0 && (
                    <div
                      className="bg-red-500"
                      style={{
                        width: `${(counts.declined / counts.total_invited) * 100}%`,
                      }}
                    />
                  )}
                  {/* RSVP-Lite: Remove maybe/pending sections */}
                </div>
              </div>

              {/* Status Breakdown - RSVP-Lite format */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-base font-bold text-green-700 mb-0.5">
                    {counts.attending}
                  </div>
                  <div className="text-xs font-medium text-green-600">
                    Attending
                  </div>
                </div>

                <div className="text-center p-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-base font-bold text-red-700 mb-0.5">
                    {counts.declined}
                  </div>
                  <div className="text-xs font-medium text-red-600">
                    Can&apos;t make it
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </CardContainer>
  );
}
