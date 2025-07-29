'use client';

// External dependencies
import React, { useRef, useEffect } from 'react';

// Internal utilities
import { formatEventDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils';

// Internal hooks (specific imports for better tree-shaking)
import { useUserEventsSorted, useEventInsights } from '@/hooks/events';
import { useAuth } from '@/hooks/useAuth';
import { usePullToRefresh } from '@/hooks/common/usePullToRefresh';

// Internal components (specific imports)
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { PageWrapper, SkeletonLoader } from '@/components/ui';

export default function SelectEventPage() {
  const { events, loading, error, refetch } = useUserEventsSorted();
  const { user } = useAuth();
  const { insights, fetchInsights } = useEventInsights();
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
      // Also refresh insights
      if (events && events.length > 0) {
        const eventIds = events.map(e => e.event_id);
        await fetchInsights(eventIds);
      }
    },
    threshold: 80,
    disabled: loading,
    hapticFeedback: true,
  });

  // Fetch insights when events are loaded
  useEffect(() => {
    if (events && events.length > 0) {
      const eventIds = events.map(e => e.event_id);
      fetchInsights(eventIds);
    }
  }, [events, fetchInsights]);

  // Bind pull-to-refresh to container
  useEffect(() => {
    if (containerRef.current) {
      pullToRefresh.bindToElement(containerRef.current);
    }
  }, [pullToRefresh]);

  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto space-y-6 pt-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
          
          <SkeletonLoader variant="card" count={3} />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">Error Loading Events</h1>
            <p className="text-gray-600">
              {error}
            </p>
            <button 
              onClick={refetch}
              className="px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const handleEventSelect = (event: {
    event_id: string;
    user_role: string;
    title: string;
  }) => {
    const path = event.user_role === 'host' 
      ? `/host/events/${event.event_id}/dashboard`
      : `/guest/events/${event.event_id}/home`;
    window.location.href = path;
  };

  const handleProfile = () => {
    window.location.href = '/profile';
  };

  // Group events by user role for better organization
  const hostEvents = events?.filter(event => event.user_role === 'host') || [];
  const guestEvents = events?.filter(event => event.user_role === 'guest') || [];

  return (
    <PageWrapper>
      <div
        ref={containerRef}
        className="h-full overflow-auto"
        style={{ 
          // Ensure smooth scrolling on iOS
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator
          isPulling={pullToRefresh.isPulling}
          isRefreshing={pullToRefresh.isRefreshing}
          pullDistance={pullToRefresh.pullDistance}
          canRefresh={pullToRefresh.canRefresh}
          refreshProgress={pullToRefresh.refreshProgress}
        />

        <div className="max-w-md mx-auto px-4 py-6 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-rose-500 mb-2">
                Welcome!
              </h1>
              <p className="text-lg text-gray-600">
                Choose an event to continue.
              </p>
            </div>
            <button 
              onClick={handleProfile}
              className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
              aria-label="Profile settings"
            >
              <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </button>
          </div>

          {/* Events List */}
          <div className="space-y-8">
            {/* Host Events */}
            {hostEvents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💍</span>
                  <h2 className="text-xl font-bold text-gray-800">Your Wedding</h2>
                </div>
                
                <div className="space-y-3">
                  {hostEvents.map((event) => {
                    const formattedDate = formatEventDate(event.event_date);
                    const eventInsights = insights[event.event_id];
                    
                    return (
                      <button
                        key={event.event_id}
                        onClick={() => handleEventSelect(event)}
                        className={cn(
                          'w-full p-5 bg-white border border-gray-200 rounded-xl shadow-sm',
                          'transition-all duration-200 hover:shadow-md hover:border-rose-300',
                          'focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2',
                          'active:scale-[0.98]',
                          'group'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-left">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {event.title}
                            </h3>
                            {event.location && (
                              <p className="text-gray-600 italic mb-2">
                                {event.location}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📅</span>
                              <span className="font-medium">{formattedDate}</span>
                            </div>
                            
                            {/* Host insights preview */}
                            {eventInsights && eventInsights.totalGuests > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>👥 {eventInsights.totalGuests} guests</span>
                                  <span>✅ {eventInsights.attendingCount} attending</span>
                                  <span>📊 {Math.round(eventInsights.responseRate)}% responded</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-gray-400 group-hover:text-rose-500 transition-colors ml-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guest Events */}
            {guestEvents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍾</span>
                  <h2 className="text-xl font-bold text-gray-800">Weddings You&apos;re Invited To</h2>
                </div>
                
                <div className="space-y-3">
                  {guestEvents.map((event) => {
                    const formattedDate = formatEventDate(event.event_date);
                    
                    return (
                      <button
                        key={event.event_id}
                        onClick={() => handleEventSelect(event)}
                        className={cn(
                          'w-full p-5 bg-white border border-gray-200 rounded-xl shadow-sm',
                          'transition-all duration-200 hover:shadow-md hover:border-rose-300',
                          'focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2',
                          'active:scale-[0.98]',
                          'group'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-left">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {event.title}
                            </h3>
                            {event.location && (
                              <p className="text-gray-600 italic mb-2">
                                {event.location}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>📅</span>
                              <span className="font-medium">{formattedDate}</span>
                            </div>
                          </div>
                          
                          <div className="text-gray-400 group-hover:text-rose-500 transition-colors ml-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!events || events.length === 0) && (
              <div className="text-center py-12 space-y-6">
                <div className="text-6xl">💒</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No events yet
                  </h3>
                  <p className="text-gray-600">
                    You don&apos;t have any events to view at this time.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Development Mode Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Development Mode</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>User ID:</strong> {user?.id || 'XXXXXXXXXX'}</p>
              <p><strong>Event Count:</strong> {events?.length || 0}</p>
              <p><strong>User Role:</strong> Authenticated</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Need help? Contact us at{' '}
              <a 
                href="mailto:support@unveil.app" 
                className="text-rose-500 hover:text-rose-600 transition-colors"
              >
                support@unveil.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
