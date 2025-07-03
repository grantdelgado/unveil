'use client';

import React, { useEffect, useState, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useRealtimeSubscription } from '@/hooks/realtime';
import { RSVPProgressChart } from './RSVPProgressChart';
import { StatusPill } from './StatusPill';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

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
    key: 'pending',
    label: 'Pending',
    icon: '⏳',
    bgColor: 'bg-orange-50',
    activeColor: 'bg-orange-500',
    textColor: 'text-orange-700',
    activeTextColor: 'text-white',
  },
  {
    key: 'maybe',
    label: 'Maybe',
    icon: '🤷‍♂️',
    bgColor: 'bg-yellow-50',
    activeColor: 'bg-yellow-500',
    textColor: 'text-yellow-700',
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


// Recent activity feed component
function RecentActivityFeed({ activities }: { activities: RSVPActivity[] }) {
  if (activities.length === 0) return null;

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'attending': return '✅';
      case 'maybe': return '🤷‍♂️';
      case 'declined': return '❌';
      default: return '⏳';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'attending': return 'will attend';
      case 'maybe': return 'might attend';
      case 'declined': return 'declined';
      default: return 'is pending';
    }
  };

  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700">Recent Activity</span>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {activities.slice(0, 5).map((activity) => (
          <div key={`${activity.id}-${activity.timestamp}`} className="flex items-center gap-2 text-xs">
            <span className="text-base">{getStatusEmoji(activity.new_status)}</span>
            <span className="text-gray-600 flex-1">
              <span className="font-medium">{activity.user_name}</span>
              {' '}
              {getStatusLabel(activity.new_status)}
            </span>
            <span className="text-gray-400">
              {new Date(activity.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const GuestStatusSummary = memo<GuestStatusSummaryProps>(({
  eventId,
  activeFilter,
  onFilterChange,
  className,
}) => {
  const [statusCounts, setStatusCounts] = useState<StatusCount>({
    attending: 0,
    pending: 0,
    declined: 0,
    maybe: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RSVPActivity[]>([]);
  const [showActivity, setShowActivity] = useState(false);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_guests')
        .select(`
          rsvp_status,
          users:user_id(full_name)
        `)
        .eq('event_id', eventId);

      if (error) {
        logger.databaseError('Error fetching RSVP status counts', error);
        return;
      }

      const counts = {
        attending: 0,
        pending: 0,
        declined: 0,
        maybe: 0,
        total: data?.length || 0,
      };

      data?.forEach((guest) => {
        const status = guest.rsvp_status || 'pending';
        if (status in counts) {
          counts[status as keyof Omit<StatusCount, 'total'>]++;
        }
      });

      setStatusCounts(counts);
    } catch (error) {
      logger.databaseError('Unexpected error fetching status counts', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Set up real-time subscription using centralized hook
  const { } = useRealtimeSubscription({
    subscriptionId: `guest-status-summary-${eventId}`,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      logger.realtime('Real-time RSVP update', { 
        eventType: payload.eventType, 
        guestId: payload.new && 'id' in payload.new ? payload.new.id : null 
      });
      
      // Update activity feed for RSVP changes
      if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
        const oldData = payload.old as Record<string, unknown>;
        const newData = payload.new as Record<string, unknown>;
        const oldRsvp = oldData?.rsvp_status;
        const newRsvp = newData?.rsvp_status;
        
        if (oldRsvp !== newRsvp) {
          const activity: RSVPActivity = {
            id: `rsvp-${Date.now()}`,
            user_name: (newData?.guest_name as string) || 'Unknown Guest',
            old_status: (oldRsvp as string) || null,
            new_status: (newRsvp as string) || 'pending',
            timestamp: new Date().toISOString(),
          };
          
          setRecentActivity(prev => [activity, ...prev.slice(0, 9)]);
        }
      }
      
      // Refresh the main data
      await fetchStatusCounts();
    }, [fetchStatusCounts]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest status summary subscription error', error);
    }, [])
  });

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

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
          {statusConfig.map((status) => (
            <div 
              key={status.key}
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
      {/* Enhanced progress overview */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <RSVPProgressChart statusCounts={statusCounts} />
          
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">RSVP Progress</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Responses</span>
                <span className="font-medium">
                  {statusCounts.attending + statusCounts.maybe + statusCounts.declined} of {statusCounts.total}
                </span>
              </div>
              
              {/* Mini breakdown */}
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  {statusCounts.attending} attending
                </span>
                {statusCounts.maybe > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    {statusCounts.maybe} maybe
                  </span>
                )}
                {statusCounts.declined > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    {statusCounts.declined} declined
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Activity toggle */}
          {recentActivity.length > 0 && (
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              📈 Activity
              <span className="text-xs transform transition-transform duration-200" 
                    style={{ transform: showActivity ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </button>
          )}
        </div>

        {/* Recent activity feed */}
        {showActivity && <RecentActivityFeed activities={recentActivity} />}
      </div>

      {/* Status filter buttons */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
        {statusConfig.map((status) => {
          const isActive = activeFilter === status.key;
          const count = getCountForStatus(status.key);
          
          return (
            <StatusPill
              key={status.key}
              label={status.label}
              icon={status.icon}
              count={count}
              isActive={isActive}
              bgColor={status.bgColor}
              activeColor={status.activeColor}
              textColor={status.textColor}
              activeTextColor={status.activeTextColor}
              onClick={() => onFilterChange(status.key)}
            />
          );
        })}
      </div>
    </div>
  );
});

GuestStatusSummary.displayName = 'GuestStatusSummary'; 