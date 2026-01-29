'use client';

import dynamic from 'next/dynamic';
import { useUnifiedGuestCounts } from '@/hooks/guests';
import { PageWrapper } from '@/components/ui';
import type { Database } from '@/app/reference/supabase.types';

// Lazy load dashboard components to reduce initial bundle size
const EventSummaryCard = dynamic(
  () =>
    import('@/components/features/host-dashboard/EventSummaryCard').then(
      (mod) => ({ default: mod.EventSummaryCard }),
    ),
  {
    loading: () => (
      <div className="animate-pulse space-y-4 bg-white rounded-lg border p-6">
        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    ),
    ssr: true,
  },
);

const ModernActionList = dynamic(
  () =>
    import('@/components/features/host-dashboard/ModernActionList').then(
      (mod) => ({ default: mod.ModernActionList }),
    ),
  {
    loading: () => (
      <div className="animate-pulse space-y-4 bg-white rounded-lg border p-6">
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
        <div className="space-y-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-0 py-4">
              <div className="h-5 w-5 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-48"></div>
              </div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    ),
    ssr: true,
  },
);

const CompactEventHeader = dynamic(
  () =>
    import('@/components/features/host-dashboard/CompactEventHeader').then(
      (mod) => ({ default: mod.CompactEventHeader }),
    ),
  {
    loading: () => (
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="animate-pulse h-6 bg-gray-200 rounded w-24"></div>
              <div className="min-w-0 flex-1">
                <div className="animate-pulse h-6 bg-gray-200 rounded w-48 mb-1"></div>
                <div className="animate-pulse h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <div className="animate-pulse h-8 bg-gray-200 rounded w-16"></div>
              <div className="animate-pulse h-8 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    ),
    ssr: true,
  },
);

type Event = Database['public']['Tables']['events']['Row'];

interface HostDashboardClientProps {
  event: Event;
  eventId: string;
}

/**
 * Client component for the host dashboard
 * Receives pre-verified event data from the server component
 * Server has already verified:
 * - User is authenticated
 * - User has host role for this event
 */
export function HostDashboardClient({
  event,
  eventId,
}: HostDashboardClientProps) {
  // Use unified guest counts for consistency
  const { counts: guestCounts } = useUnifiedGuestCounts(eventId);

  return (
    <PageWrapper centered={false}>
      {/* Compact Event Header */}
      <CompactEventHeader event={event} />

      <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {/* Event Summary Card */}
        <EventSummaryCard event={event} />

        {/* Modern Action List */}
        <ModernActionList
          eventId={eventId}
          guestCount={guestCounts.total_invited}
          pendingRSVPs={0} // RSVP-Lite: No pending RSVPs concept
        />
      </div>
    </PageWrapper>
  );
}
