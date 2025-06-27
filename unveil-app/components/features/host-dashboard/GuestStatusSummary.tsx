'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
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

// Progress donut chart component
function RSVPProgressChart({ statusCounts }: { statusCounts: StatusCount }) {
  const { attending, maybe, declined, total } = statusCounts;
  
  if (total === 0) {
    return (
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-xs text-gray-500">No guests</span>
      </div>
    );
  }

  const responded = attending + maybe + declined;
  const responseRate = Math.round((responded / total) * 100);
  
  const radius = 30;
  const strokeWidth = 6;
  const normalizedRadius = radius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Create stroke-dasharray for each segment
  const attendingLength = (attending / total) * circumference;
  const maybeLength = (maybe / total) * circumference;
  const declinedLength = (declined / total) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg
        width="80"
        height="80"
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx="40"
          cy="40"
          r={normalizedRadius}
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Attending segment */}
        {attending > 0 && (
          <circle
            cx="40"
            cy="40"
            r={normalizedRadius}
            stroke="#10b981"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${attendingLength} ${circumference}`}
            strokeDashoffset="0"
            className="transition-all duration-500"
          />
        )}
        
        {/* Maybe segment */}
        {maybe > 0 && (
          <circle
            cx="40"
            cy="40"
            r={normalizedRadius}
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${maybeLength} ${circumference}`}
            strokeDashoffset={-attendingLength}
            className="transition-all duration-500"
          />
        )}
        
        {/* Declined segment */}
        {declined > 0 && (
          <circle
            cx="40"
            cy="40"
            r={normalizedRadius}
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`${declinedLength} ${circumference}`}
            strokeDashoffset={-(attendingLength + maybeLength)}
            className="transition-all duration-500"
          />
        )}
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-gray-900">{responseRate}%</span>
        <span className="text-xs text-gray-500">replied</span>
      </div>
    </div>
  );
}

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

export function GuestStatusSummary({
  eventId,
  activeFilter,
  onFilterChange,
  className,
}: GuestStatusSummaryProps) {
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
        console.error('Error fetching RSVP status counts:', error);
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
      console.error('Unexpected error fetching status counts:', error);
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
    onDataChange: useCallback(async (payload) => {
      console.log('🔄 Real-time RSVP update:', payload);
      
      // Update activity feed for RSVP changes
      if (payload.eventType === 'UPDATE' && payload.old && payload.new) {
        const oldStatus = payload.old.rsvp_status;
        const newStatus = payload.new.rsvp_status;
        
        if (oldStatus !== newStatus) {
          // Fetch user name for activity
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', payload.new.user_id)
            .single();

          const activity: RSVPActivity = {
            id: payload.new.id,
            user_name: userData?.full_name || 'Unknown User',
            old_status: oldStatus,
            new_status: newStatus,
            timestamp: new Date().toISOString(),
          };

          setRecentActivity(prev => [activity, ...prev.slice(0, 9)]);
        }
      }
      
      // Refresh counts
      await fetchStatusCounts();
    }, [fetchStatusCounts]),
    onError: useCallback((error: Error) => {
      console.error('❌ Guest status summary subscription error:', error);
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
            <button
              key={status.key}
              onClick={() => onFilterChange(status.key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border-2',
                'hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:ring-offset-1',
                'min-h-[44px] min-w-[88px] justify-center', // Touch-friendly sizing
                isActive
                  ? `${status.activeColor} ${status.activeTextColor} border-[#FF6B6B]`
                  : `${status.bgColor} ${status.textColor} border-transparent hover:border-gray-200`
              )}
              type="button"
              aria-pressed={isActive}
              aria-label={`Filter by ${status.label} guests (${count})`}
            >
              <span className="text-base" role="img" aria-hidden="true">
                {status.icon}
              </span>
              <span className="whitespace-nowrap">
                {status.label}
                <span className="ml-1 font-semibold">({count})</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 