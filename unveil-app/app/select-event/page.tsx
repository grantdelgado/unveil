'use client';

import React, { useRef, useEffect } from 'react';
import { formatEventDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import { useUserEventsSorted, useEventInsights } from '@/hooks';
import { useAuth } from '@/hooks/auth';
import { usePullToRefresh } from '@/hooks/common/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { 
  PageWrapper,
  CardContainer,
  LogoContainer,
  PageTitle,
  SubTitle,
  SectionTitle,
  PrimaryButton,
  IconButton,
  MicroCopy,
  DevModeBox,
  EmptyState,
  SkeletonLoader
} from '@/components/ui';

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
              <LogoContainer className="justify-start mb-4" />
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
        <CardContainer>
          <div className="text-center space-y-4">
            <PageTitle>Error Loading Events</PageTitle>
            <SubTitle>
              {error}
            </SubTitle>
            <PrimaryButton onClick={refetch}>
              Try Again
            </PrimaryButton>
          </div>
        </CardContainer>
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

  const handleCreateEvent = () => {
    window.location.href = '/host/events/create';
  };

  const handleProfile = () => {
    window.location.href = '/profile';
  };

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

        <CardContainer maxWidth="md">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <LogoContainer className="justify-start mb-4" />
              <PageTitle className="text-left mb-2">
                Welcome!
              </PageTitle>
              <SubTitle>Choose an event to continue</SubTitle>
            </div>
            <IconButton 
              onClick={handleProfile}
              size="lg"
              aria-label="Profile settings"
            >
              <span className="text-gray-600">👤</span>
            </IconButton>
          </div>

          {/* Events List */}
          <div className="space-y-6">
            {events && events.length > 0 ? (
              <>
                <SectionTitle>Your Events</SectionTitle>
                <div className="space-y-4">
                  {events.map((event) => {
                    const formattedDate = formatEventDate(event.event_date);
                    const eventInsights = insights[event.event_id];
                    
                    return (
                      <button
                        key={event.event_id}
                        onClick={() => handleEventSelect(event)}
                        className={cn(
                          'w-full p-5 border border-gray-200 rounded-lg bg-white text-left',
                          'transition-all duration-200 hover:border-pink-300 hover:shadow-md hover:bg-pink-50',
                          'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2',
                          'active:scale-[0.98] active:shadow-sm',
                          'min-h-[44px]' // Touch-friendly minimum height
                        )}
                        aria-label={`Enter ${event.title} as ${event.user_role === 'host' ? 'Event Host' : 'Guest'}`}
                        title={`Click to enter ${event.title} as ${event.user_role === 'host' ? 'Host' : 'Guest'}`}
                      >
                        <div className="space-y-4">
                          {/* Header with title and role */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-pink-700">
                                  {event.title}
                                </h3>
                                <span className={cn(
                                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                  event.user_role === 'host' 
                                    ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                    : 'bg-rose-100 text-rose-700 border border-rose-200'
                                )}>
                                  {event.user_role === 'host' ? '👑 Host' : '🎊 Guest'}
                                </span>
                              </div>
                              
                              <div className="space-y-1 text-sm text-gray-600">
                                <p className="flex items-center gap-2">
                                  <span>📅</span>
                                  <span>{formattedDate}</span>
                                </p>
                                {event.location && (
                                  <p className="flex items-center gap-2">
                                    <span>📍</span>
                                    <span>{event.location}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                           
                           <div className="text-gray-400 group-hover:text-pink-500 transition-colors duration-200 ml-4">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                             </svg>
                           </div>
                         </div>

                         {/* Event insights for hosts */}
                         {event.user_role === 'host' && eventInsights && (
                           <div className="pt-3 border-t border-gray-100">
                             <div className="grid grid-cols-2 gap-4">
                               {/* Guest count and RSVP status */}
                               <div>
                                 <div className="flex items-center gap-2 text-sm">
                                   <span className="text-gray-500">👥</span>
                                   <span className="font-medium text-gray-700">
                                     {eventInsights.totalGuests} guest{eventInsights.totalGuests !== 1 ? 's' : ''}
                                   </span>
                                 </div>
                                 {eventInsights.totalGuests > 0 && (
                                   <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                                     <span className="flex items-center gap-1">
                                       <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                       {eventInsights.attendingCount}
                                     </span>
                                     <span className="flex items-center gap-1">
                                       <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                       {eventInsights.maybeCount}
                                     </span>
                                     <span className="flex items-center gap-1">
                                       <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                       {eventInsights.declinedCount}
                                     </span>
                                     <span className="flex items-center gap-1">
                                       <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                       {eventInsights.pendingCount}
                                     </span>
                                   </div>
                                 )}
                               </div>

                               {/* Response rate */}
                               <div>
                                 <div className="flex items-center gap-2 text-sm">
                                   <span className="text-gray-500">📊</span>
                                   <span className="font-medium text-gray-700">
                                     {Math.round(eventInsights.responseRate)}% responded
                                   </span>
                                 </div>
                                 {eventInsights.lastActivity && (
                                   <div className="mt-1 text-xs text-gray-600">
                                     Last activity: {new Date(eventInsights.lastActivity).toLocaleDateString()}
                                   </div>
                                 )}
                               </div>
                             </div>

                             {/* Recent RSVP changes */}
                             {eventInsights.recentChanges.length > 0 && (
                               <div className="mt-3 text-xs text-gray-600">
                                 <span className="font-medium">Recent: </span>
                                 {eventInsights.recentChanges.slice(0, 2).map((change, idx) => (
                                   <span key={idx} className="inline-block">
                                     {change.userName} {change.status === 'attending' ? '✅' : change.status === 'declined' ? '❌' : '🤔'}
                                     {idx < Math.min(eventInsights.recentChanges.length - 1, 1) && ', '}
                                   </span>
                                 ))}
                               </div>
                             )}
                           </div>
                         )}

                         {/* Guest view - simpler info */}
                         {event.user_role === 'guest' && eventInsights && eventInsights.totalGuests > 0 && (
                           <div className="pt-3 border-t border-gray-100">
                             <div className="flex items-center gap-4 text-sm text-gray-600">
                               <span className="flex items-center gap-2">
                                 <span>👥</span>
                                 <span>{eventInsights.totalGuests} invited</span>
                               </span>
                               <span className="flex items-center gap-2">
                                 <span>✅</span>
                                 <span>{eventInsights.attendingCount} attending</span>
                               </span>
                             </div>
                           </div>
                         )}
                       </div>
                     </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState
                variant="events"
                onAction={handleCreateEvent}
              />
            )}

            {/* Create Event Button */}
            <div className="space-y-4">
              <PrimaryButton onClick={handleCreateEvent}>
                + Create New Event
              </PrimaryButton>
            </div>
          </div>

          {/* Microcopy */}
          <div className="mt-6">
            <MicroCopy>
              {events && events.length > 0 
                ? "Pull down to refresh your events • Need help? Contact support at help@unveil.app"
                : "Need help? Contact support at help@unveil.app"
              }
            </MicroCopy>
          </div>

          {/* Development Mode */}
          <DevModeBox>
            <p><strong>User ID:</strong> {user?.id}</p>
            <p><strong>Events Found:</strong> {events?.length || 0}</p>
            <p><strong>User Role:</strong> {user?.role || 'unknown'}</p>
            <p><strong>Pull-to-refresh:</strong> {pullToRefresh.isPulling ? 'Active' : 'Ready'}</p>
          </DevModeBox>
        </CardContainer>
      </div>
    </PageWrapper>
  );
}
