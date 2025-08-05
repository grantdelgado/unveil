'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  StaticEventHeader,
  EventSummaryCard,
  DashboardActions,
} from '@/components/features/host-dashboard';
import {
  PageWrapper,
  BackButton
} from '@/components/ui';

type Event = Database['public']['Tables']['events']['Row'];

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [pendingRSVPs, setPendingRSVPs] = useState(0);

  // Fetch event data and guest stats
  useEffect(() => {
    if (!eventId) return;

    const fetchEventData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verify user access and fetch event
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Check if user is authorized as host (primary or delegated)
        const { data: hostCheck, error: hostError } = await supabase
          .rpc('is_event_host', { p_event_id: eventId });

        if (hostError) {
          console.error('Host authorization check failed:', hostError);
          setError('Failed to verify event access permissions');
          return;
        }

        if (!hostCheck) {
          console.warn('User not authorized as host for event:', eventId);
          setError('You do not have host permissions for this event');
          return;
        }

        // Parallel data loading for better performance (user is authorized)
        const [
          { data: eventData, error: eventError },
          { data: guestData, error: guestError }
        ] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single(),
          supabase
            .from('event_guests')
            .select('rsvp_status')
            .eq('event_id', eventId)
        ]);

        if (eventError) {
          console.error('Event fetch error:', eventError);
          if (eventError.code === 'PGRST116') {
            setError('Event not found');
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        if (guestError) {
          console.error('Guest data error:', guestError);
        }

        setEvent(eventData);
        setGuestCount(guestData?.length || 0);
        
        // Calculate pending RSVPs
        const pending = guestData?.filter(
          (guest) => !guest.rsvp_status || guest.rsvp_status === 'pending'
        ).length || 0;
        setPendingRSVPs(pending);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  // Loading state
  if (loading) {
    return (
      <PageWrapper centered={false}>
        {/* Back Navigation skeleton - Consistent with main layout */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="animate-pulse h-10 bg-gray-200 rounded-lg w-32"></div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Header image skeleton */}
          <div className="w-full h-48 md:h-64 bg-gray-200 animate-pulse"></div>
          
          <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Event summary skeleton */}
            <div className="animate-pulse space-y-4 bg-white rounded-lg border p-6">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
            
            {/* Actions skeleton */}
            <div className="animate-pulse space-y-4 bg-white rounded-lg border p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <PageWrapper centered={false}>
        {/* Back Navigation - Consistent with main layout */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <BackButton 
              href="/select-event"
              fallback="/select-event"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors duration-200 font-medium"
            >
              Back to Events
            </BackButton>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-center py-12 px-6">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Unable to Load Event
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Main dashboard layout - clean overview page
  return (
    <PageWrapper centered={false}>
      {/* Back Navigation - Above header image */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <BackButton 
            href="/select-event"
            fallback="/select-event"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors duration-200 font-medium"
          >
            Back to Events
          </BackButton>
        </div>
      </div>

      {/* Static Event Header Image */}
      <StaticEventHeader event={event} />
      
      <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Summary Card */}
        <EventSummaryCard event={event} />

        {/* Dashboard Actions */}
        <DashboardActions 
          eventId={eventId}
          guestCount={guestCount}
          pendingRSVPs={pendingRSVPs}
        />
      </div>
    </PageWrapper>
  );
}