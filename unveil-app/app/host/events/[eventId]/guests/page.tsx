'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  PageWrapper,
  CardContainer,
  BackButton,
  LoadingSpinner,
} from '@/components/ui';

// Lazy load heavy components
const LazyGuestImportWizard = lazy(() =>
  import('@/components/features/guests/GuestImportWizard').then((m) => ({
    default: m.GuestImportWizard,
  })),
);
const LazyGuestManagement = lazy(() =>
  import('@/components/features/host-dashboard/GuestManagement').then((m) => ({
    default: m.GuestManagement,
  })),
);

type Event = Database['public']['Tables']['events']['Row'];

export default function EventGuestsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGuestImport, setShowGuestImport] = useState(false);
  const [showAddIndividualGuest, setShowAddIndividualGuest] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [, setGuestCount] = useState(0);

  // Fetch event data and guest count
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

        const [
          { data: eventData, error: eventError },
          { data: guestData, error: guestError },
        ] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .eq('host_user_id', user.id)
            .single(),
          supabase.from('event_guests').select('id').eq('event_id', eventId),
        ]);

        if (eventError) {
          console.error('Event fetch error:', eventError);
          if (eventError.code === 'PGRST116') {
            setError(
              'Event not found or you do not have permission to access it.',
            );
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        if (guestError) {
          console.error('Guest count error:', guestError);
        }

        setEvent(eventData);
        setGuestCount(guestData?.length || 0);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  // Handle data refresh after guest management actions
  const handleDataRefresh = async () => {
    const { data: guestData } = await supabase
      .from('event_guests')
      .select('id')
      .eq('event_id', eventId);

    setGuestCount(guestData?.length || 0);

    // Trigger a custom event to notify the guest management component to refresh
    window.dispatchEvent(
      new CustomEvent('guestDataRefresh', { detail: { eventId } }),
    );
  };

  // Loading state
  if (loading) {
    return (
      <PageWrapper centered={false}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header skeleton */}
          <CardContainer>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContainer>
          <LoadingSpinner size="lg" />
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <PageWrapper centered={false}>
        <div className="max-w-4xl mx-auto space-y-6">
          <BackButton
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
          </BackButton>
          <CardContainer>
            <div className="text-center py-8">
              <div className="text-3xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Unable to Load Event
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
            </div>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper centered={false}>
      {/* Guest Import Modal (Manual) */}
      {showGuestImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <Suspense
              fallback={
                <CardContainer>
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                    <span className="ml-3 text-gray-600">
                      Loading guest import...
                    </span>
                  </div>
                </CardContainer>
              }
            >
              <LazyGuestImportWizard
                eventId={eventId}
                startInManualMode={true}
                onImportComplete={() => {
                  setShowGuestImport(false);
                  handleDataRefresh();
                }}
                onClose={() => setShowGuestImport(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* CSV Import Modal (Direct) */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <Suspense
              fallback={
                <CardContainer>
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                    <span className="ml-3 text-gray-600">
                      Loading CSV import...
                    </span>
                  </div>
                </CardContainer>
              }
            >
              <LazyGuestImportWizard
                eventId={eventId}
                startInCSVMode={true}
                onImportComplete={() => {
                  setShowCSVImport(false);
                  handleDataRefresh();
                }}
                onClose={() => setShowCSVImport(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Add Individual Guest Modal */}
      {showAddIndividualGuest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <Suspense
              fallback={
                <CardContainer>
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                    <span className="ml-3 text-gray-600">
                      Loading guest form...
                    </span>
                  </div>
                </CardContainer>
              }
            >
              <LazyGuestImportWizard
                eventId={eventId}
                startInManualMode={true}
                onImportComplete={() => {
                  setShowAddIndividualGuest(false);
                  handleDataRefresh();
                }}
                onClose={() => setShowAddIndividualGuest(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="mb-6">
          <BackButton
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
          </BackButton>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Guest Management
          </h1>
          <p className="text-gray-600">
            Manage guest attendance, send invitations, and organize guests for{' '}
            <span className="font-medium text-gray-800">{event.title}</span>
          </p>
        </div>

        {/* Guest Management Interface */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">
                Loading guest management...
              </span>
            </div>
          }
        >
          <LazyGuestManagement
            eventId={eventId}
            isEventPublic={event?.is_public ?? true}
            onGuestUpdated={handleDataRefresh}
            onImportGuests={() => setShowCSVImport(true)}
            onAddIndividualGuest={() => setShowAddIndividualGuest(true)}
            onSendMessage={(messageType) => {
              // Navigate to messages page with pre-selected type
              router.push(
                `/host/events/${eventId}/messages?type=${messageType}`,
              );
            }}
          />
        </Suspense>
      </div>
    </PageWrapper>
  );
}
