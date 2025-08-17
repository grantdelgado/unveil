'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  CompactEventHeader,
  EventSummaryCard,
  ModernActionList,
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
        {/* Compact header skeleton */}
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

        <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
          {/* Event summary skeleton */}
          <div className="animate-pulse space-y-4 bg-white rounded-lg border p-6">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
          
          {/* Actions skeleton */}
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
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <PageWrapper centered={false}>
        {/* Compact header with back navigation */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <BackButton 
                  href="/select-event"
                  fallback="/select-event"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  Back to Events
                </BackButton>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Event Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Unable to load
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      {/* Compact Event Header */}
      <CompactEventHeader event={event} />
      
      <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {/* Event Summary Card */}
        <EventSummaryCard event={event} />

        {/* Modern Action List */}
        <ModernActionList 
          eventId={eventId}
          guestCount={guestCount}
          pendingRSVPs={pendingRSVPs}
        />
      </div>
    </PageWrapper>
  );
}