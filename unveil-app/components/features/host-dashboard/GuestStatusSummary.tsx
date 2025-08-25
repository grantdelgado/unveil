'use client';

import React, { memo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUnifiedGuestCounts } from '@/hooks/guests/useUnifiedGuestCounts';

import { StatusPill } from './StatusPill';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { useRealtimeSubscription } from '@/hooks/realtime';

interface GuestStatusSummaryProps {
  eventId: string;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  className?: string;
}

interface StatusCount {
  attending: number;
  pending: number;
  declined: number;
  maybe: number;
  total: number;
}

interface RSVPActivity {
  id: string;
  user_name: string;
  old_status: string | null;
  new_status: string;
  timestamp: string;
}

function RecentActivityFeed({ activities }: { activities: RSVPActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No recent RSVP activity
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center gap-2 text-sm">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-900 truncate">
              {activity.user_name}
            </span>
            <span className="text-gray-500">
              {' '}
              changed from{' '}
              <span className="font-medium">
                {activity.old_status || 'No response'}
              </span>{' '}
              to <span className="font-medium">{activity.new_status}</span>
            </span>
          </div>
          <div className="text-xs text-gray-400 flex-shrink-0">
            {new Date(activity.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export const GuestStatusSummary = memo<GuestStatusSummaryProps>(
  ({ eventId, activeFilter, onFilterChange, className }) => {
    // Use unified guest counts for consistency
    const { counts, loading } = useUnifiedGuestCounts(eventId);
    
    // Map unified counts to the expected format
    const statusCounts: StatusCount = {
      attending: counts.attending,
      pending: 0, // Always 0 in RSVP-Lite
      declined: counts.declined,
      maybe: 0, // Always 0 in RSVP-Lite
      total: counts.total_guests,
    };
    const [recentActivity, setRecentActivity] = useState<RSVPActivity[]>([]);
    const [showActivity, setShowActivity] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(true);

    // RSVP-Lite status configuration
    const statusConfig = [
      {
        key: 'all',
        label: 'All',
        icon: '👥',
        bgColor: 'bg-gray-100',
        activeColor: 'bg-[#FF6B6B]',
        textColor: 'text-gray-700',
        activeTextColor: 'text-white',
      },
      {
        key: 'attending',
        label: 'Attending',
        icon: '✅',
        bgColor: 'bg-green-50',
        activeColor: 'bg-green-500',
        textColor: 'text-green-700',
        activeTextColor: 'text-white',
      },
      {
        key: 'declined',
        label: 'Declined',
        icon: '❌',
        bgColor: 'bg-red-50',
        activeColor: 'bg-red-500',
        textColor: 'text-red-700',
        activeTextColor: 'text-white',
      },
    ] as const;

    // Note: Status counts now come from useUnifiedGuestCounts hook

    // Set up real-time subscription using centralized hook with enhanced stability
    const {} = useRealtimeSubscription({
      subscriptionId: `guest-status-summary-${eventId}`,
      table: 'event_guests',
      event: '*',
      filter: `event_id=eq.${eventId}`,
      enabled: Boolean(eventId),
      performanceOptions: {
        enablePooling: true,
        eventId,
      },
      onDataChange: useCallback(
        async (
          payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
        ) => {
          // Only log significant updates to reduce noise
          if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
            const oldData = payload.old as Record<string, unknown>;
            const newData = payload.new as Record<string, unknown>;
            const oldDeclined = oldData?.declined_at;
            const newDeclined = newData?.declined_at;

            if (oldDeclined !== newDeclined) {
              logger.realtime('Real-time attendance update', {
                eventType: payload.eventType,
                guestId:
                  payload.new && 'id' in payload.new ? payload.new.id : null,
                oldDeclined: !!oldDeclined,
                newDeclined: !!newDeclined,
              });

              const activity: RSVPActivity = {
                id: `attendance-${Date.now()}`,
                user_name: (newData?.guest_name as string) || 'Unknown Guest',
                old_status: oldDeclined ? 'declined' : 'attending',
                new_status: newDeclined ? 'declined' : 'attending',
                timestamp: new Date().toISOString(),
              };

              setRecentActivity((prev) => [activity, ...prev.slice(0, 9)]);
            }
          }

          // Note: Status counts automatically refresh via useUnifiedGuestCounts
        },
        [],
      ),
      onError: useCallback((error: Error) => {
        // Only log non-connection errors to reduce noise
        if (
          !error.message.includes('CHANNEL_ERROR') &&
          !error.message.includes('timeout')
        ) {
          logger.realtimeError(
            'Guest status summary subscription error',
            error,
          );
        }
        setRealtimeConnected(false);
      }, []),
      onStatusChange: useCallback((status: string) => {
        setRealtimeConnected(status === 'connected');
        // Only log meaningful status changes
        if (status === 'connected') {
          logger.realtime('Guest status summary realtime connected');
        } else if (status === 'error') {
          logger.realtime('Guest status summary realtime status: error');
        }
      }, []),
    });

    // Note: Status counts are automatically managed by useUnifiedGuestCounts hook
    // No manual fetching needed as the hook handles initial load and real-time updates

    const getCountForStatus = (key: string): number => {
      if (key === 'all') return statusCounts.total;
      return statusCounts[key as keyof Omit<StatusCount, 'total'>] || 0;
    };

    if (loading) {
      return (
        <div className={cn('space-y-4', className)}>
          {/* Progress chart skeleton */}
          <div className="flex items-center gap-4 bg-white rounded-lg p-4 border border-gray-200">
            <div className="w-20 h-20 bg-gray-100 rounded-full animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4"></div>
            </div>
          </div>

          {/* Status filters skeleton */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
            {['all', 'attending', 'declined'].map((status) => (
              <div
                key={status}
                className="flex-shrink-0 bg-gray-100 rounded-full px-4 py-2 animate-pulse"
                style={{ minWidth: '88px', height: '44px' }}
              >
                <div className="h-full bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={cn('space-y-4', className)}>
        {/* Guest Attendance Summary */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-bold text-green-700">
                  {statusCounts.total > 0
                    ? Math.round(
                        (statusCounts.attending / statusCounts.total) * 100,
                      )
                    : 0}
                  %
                </div>
                <div className="text-xs text-green-600">attending</div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Guest Attendance
              </h3>
              <p className="text-sm text-gray-600">
                {statusCounts.attending} attending, {statusCounts.declined}{' '}
                can&apos;t make it
              </p>
              {!realtimeConnected && (
                <p className="text-xs text-yellow-600 mt-1">
                  Using polling mode (real-time connection lost)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
          {statusConfig.map((status) => (
            <StatusPill
              key={status.key}
              label={status.label}
              icon={status.icon}
              count={getCountForStatus(status.key)}
              isActive={activeFilter === status.key}
              bgColor={status.bgColor}
              activeColor={status.activeColor}
              textColor={status.textColor}
              activeTextColor={status.activeTextColor}
              onClick={() => onFilterChange(status.key)}
            />
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Recent RSVP Activity
            </h3>
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showActivity ? 'Hide' : 'Show'}
            </button>
          </div>

          {showActivity && <RecentActivityFeed activities={recentActivity} />}
        </div>
      </div>
    );
  },
);

GuestStatusSummary.displayName = 'GuestStatusSummary';
