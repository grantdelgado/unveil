'use client';

import React, { useEffect, useState } from 'react';
import { formatEventDate } from '@/lib/utils';
import { CardContainer } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface GuestStats {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  maybe: number;
}

interface EventSummaryCardProps {
  event: Event;
  className?: string;
}

export function EventSummaryCard({ event, className }: EventSummaryCardProps) {
  const [guestStats, setGuestStats] = useState<GuestStats>({
    total: 0,
    attending: 0,
    declined: 0,
    pending: 0,
    maybe: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuestStats = async () => {
      try {
        const { data, error } = await supabase
          .from('event_guests')
          .select('rsvp_status')
          .eq('event_id', event.id);

        if (error) throw error;

        const stats = data?.reduce((acc, guest) => {
          const status = guest.rsvp_status || 'pending';
          acc[status as keyof Omit<GuestStats, 'total'>] = (acc[status as keyof Omit<GuestStats, 'total'>] || 0) + 1;
          acc.total += 1;
          return acc;
        }, {
          attending: 0,
          declined: 0,
          pending: 0,
          maybe: 0,
          total: 0,
        }) || { attending: 0, declined: 0, pending: 0, maybe: 0, total: 0 };

        setGuestStats(stats);
      } catch (error) {
        console.error('Error fetching guest stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuestStats();
  }, [event.id]);

  const attendancePercentage = guestStats.total > 0 
    ? Math.round((guestStats.attending / guestStats.total) * 100) 
    : 0;

  return (
    <CardContainer className={cn("bg-white border border-gray-200 shadow-sm", className)}>
      <div className="space-y-4">
        {/* Event Title and Basic Info */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {event.title}
          </h2>
          
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
                {guestStats.total} {guestStats.total === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          </div>
        </div>

        {/* RSVP Summary */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">RSVP Status</h3>
            {!loading && guestStats.total > 0 && (
              <span className="text-sm font-medium text-gray-600">
                {attendancePercentage}% confirmed
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
          ) : guestStats.total === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <div className="text-xl mb-1">👥</div>
              <p className="font-medium text-sm">No guests yet</p>
              <p className="text-xs">Start by importing your guest list</p>
            </div>
          ) : (
            <>
              {/* Progress Bar - thinner */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                <div className="h-full flex">
                  {guestStats.attending > 0 && (
                    <div 
                      className="bg-green-500" 
                      style={{ width: `${(guestStats.attending / guestStats.total) * 100}%` }}
                    />
                  )}
                  {guestStats.maybe > 0 && (
                    <div 
                      className="bg-yellow-500" 
                      style={{ width: `${(guestStats.maybe / guestStats.total) * 100}%` }}
                    />
                  )}
                  {guestStats.declined > 0 && (
                    <div 
                      className="bg-red-500" 
                      style={{ width: `${(guestStats.declined / guestStats.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Status Breakdown - more compact */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-center p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-base font-bold text-green-700 mb-0.5">
                    {guestStats.attending}
                  </div>
                  <div className="text-xs font-medium text-green-600">
                    Attending
                  </div>
                </div>
                
                <div className="text-center p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-base font-bold text-gray-700 mb-0.5">
                    {guestStats.pending}
                  </div>
                  <div className="text-xs font-medium text-gray-600">
                    Pending
                  </div>
                </div>
                
                {guestStats.maybe > 0 && (
                  <div className="text-center p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-base font-bold text-yellow-700 mb-0.5">
                      {guestStats.maybe}
                    </div>
                    <div className="text-xs font-medium text-yellow-600">
                      Maybe
                    </div>
                  </div>
                )}
                
                {guestStats.declined > 0 && (
                  <div className="text-center p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-base font-bold text-red-700 mb-0.5">
                      {guestStats.declined}
                    </div>
                    <div className="text-xs font-medium text-red-600">
                      Declined
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </CardContainer>
  );
}