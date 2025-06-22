// app/host/dashboard/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useHostEvents } from '@/hooks/events';
import { usePullToRefresh } from '@/hooks/common/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { formatEventDate } from '@/lib/utils/date';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  SectionTitle,
  PrimaryButton,
  MicroCopy,
  DevModeBox,
  LoadingSpinner
} from '@/components/ui';

export default function HostDashboardPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Effect to get current user ID
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.error(
          'HostDashboard: Error getting session or no user, redirecting to login.',
          sessionError,
        );
        router.push('/login');
        return;
      }
      setCurrentUserId(session.user.id);
    };
    getSession();
  }, [router]);

  // Use the useHostEvents hook with the fetched userId
  const { hostedEvents, loading, error, refetch } = useHostEvents(currentUserId);

  // Pull-to-refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      if (refetch) {
        await refetch();
      }
    },
    threshold: 80,
    disabled: loading,
    hapticFeedback: true,
  });

  // Bind pull-to-refresh to container
  useEffect(() => {
    if (containerRef.current) {
      pullToRefresh.bindToElement(containerRef.current);
    }
  }, [pullToRefresh]);

  if (loading) {
    return (
      <PageWrapper>
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <CardContainer>
          <div className="text-center space-y-4">
            <PageTitle>Dashboard Error</PageTitle>
            <SubTitle>
              We couldn&apos;t load your dashboard. Please try again.
            </SubTitle>
            <PrimaryButton onClick={() => window.location.reload()}>
              Try Again
            </PrimaryButton>
          </div>
        </CardContainer>
      </PageWrapper>
    );
  }

  const validHostedEvents = hostedEvents || [];

  return (
    <PageWrapper centered={false}>
      <div
        ref={containerRef}
        className="max-w-6xl mx-auto h-full overflow-auto"
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

        {/* Header Section */}
        <CardContainer maxWidth="xl" className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <PageTitle className="text-left">Host Dashboard</PageTitle>
              <SubTitle>Manage your wedding events and connect with guests</SubTitle>
            </div>
            <div className="md:flex-shrink-0">
              <Link href="/host/events/create">
                <PrimaryButton fullWidth={false} className="md:min-w-[200px]">
                  + Create New Event
                </PrimaryButton>
              </Link>
            </div>
          </div>
        </CardContainer>

        {/* Events Section */}
        <section>
          <div className="mb-6">
            <SectionTitle>Your Events</SectionTitle>
          </div>
          
          {validHostedEvents.length > 0 ? (
            <div className="grid gap-6">
              {validHostedEvents.map((event) => (
                <CardContainer key={event.id} maxWidth="xl" animated={false}>
                  <Link 
                    href={`/host/events/${event.id}/dashboard`}
                    className="block group"
                  >
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[#FF6B6B] transition-colors duration-200">
                        {event.title}
                      </h3>
                      
                      <div className="space-y-2">
                        {event.event_date && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <span>📅</span>
                            <span>{formatEventDate(event.event_date)}</span>
                          </div>
                        )}
                        
                        {event.location && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <span>📍</span>
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-gray-400 group-hover:text-[#FF6B6B] transition-colors duration-200">
                          <span className="text-sm">Click to manage event →</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </CardContainer>
              ))}
            </div>
          ) : (
            <CardContainer maxWidth="xl">
              <div className="text-center py-12 space-y-6">
                <div className="text-6xl mb-4">🎊</div>
                <div className="space-y-2">
                  <SectionTitle>No Events Yet</SectionTitle>
                  <SubTitle>You haven&apos;t created any wedding events yet.</SubTitle>
                  <MicroCopy>Get started by creating your first wedding hub.</MicroCopy>
                </div>
                
                <div className="pt-4">
                  <Link href="/host/events/create">
                    <PrimaryButton fullWidth={false}>
                      Create Your First Event
                    </PrimaryButton>
                  </Link>
                </div>
              </div>
            </CardContainer>
          )}
        </section>

        {/* Microcopy */}
        <div className="mt-8">
          <MicroCopy>
            {validHostedEvents.length > 0 
              ? "Pull down to refresh your events • Need help managing your events? Contact support."
              : "Need help getting started? Contact support at help@unveil.app"
            }
          </MicroCopy>
        </div>

        {/* Development Mode */}
        <DevModeBox>
          <p><strong>User ID:</strong> {currentUserId}</p>
          <p><strong>Events Found:</strong> {validHostedEvents.length}</p>
          <p><strong>Loading State:</strong> {loading ? 'true' : 'false'}</p>
          <p><strong>Pull-to-refresh:</strong> {pullToRefresh.isPulling ? 'Active' : 'Ready'}</p>
          {error && <p><strong>Error:</strong> {error}</p>}
        </DevModeBox>
      </div>
    </PageWrapper>
  );
}
