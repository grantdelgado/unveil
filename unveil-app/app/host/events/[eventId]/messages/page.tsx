'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  PageWrapper,
  CardContainer,
  BackButton,
  LoadingSpinner
} from '@/components/ui';

// Lazy load MVP messaging center with simplified UI
const LazyMessageCenter = lazy(() => import('@/components/features/messaging/host/MessageCenterMVP').then(m => ({ default: m.MessageCenterMVP })));

type Event = Database['public']['Tables']['events']['Row'];

export default function EventMessagesPage() {
  const params = useParams();
  const router = useRouter();
  // const searchParams = useSearchParams();
  const eventId = params.eventId as string;
  
  // Get pre-selected message type from URL params (for future use)
  // const messageType = searchParams.get('type');

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch event data
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

        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .eq('host_user_id', user.id)
          .single();

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

        setEvent(eventData);
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

        {/* Message Center Interface */}
        <Suspense 
          fallback={
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Loading message center...</span>
            </div>
          }
        >
          <LazyMessageCenter eventId={eventId} />
        </Suspense>
      </div>
    </PageWrapper>
  );
}