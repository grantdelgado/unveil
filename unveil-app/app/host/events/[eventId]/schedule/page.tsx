'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageWrapper, BackButton, LoadingSpinner } from '@/components/ui';
import { ScheduleManagement } from '@/components/features/scheduling/ScheduleManagement';

type Event = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  time_zone: string | null;
  host_user_id: string;
};

export default function HostSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verify user access
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Check if user is authorized as host
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

        // Load event data
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, title, event_date, location, time_zone, host_user_id')
          .eq('id', eventId)
          .single();

        if (eventError) {
          console.error('Event fetch error:', eventError);
          if (eventError.code === 'PGRST116') {
            setError('Event not found');
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        setEvent(eventData);
      } catch (error) {
        console.error('Unexpected error:', error);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, router]);

  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading event schedule...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error || !event) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto space-y-6">
          <BackButton 
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
          </BackButton>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">😔</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Schedule</h1>
            <p className="text-gray-600">
              {error || 'This event may have been moved or is no longer available.'}
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Schedule</h1>
          <p className="text-gray-600">
            Manage the timeline and schedule items for <span className="font-medium text-gray-800">{event.title}</span>
          </p>
        </div>

        {/* Schedule Management */}
        <ScheduleManagement 
          eventId={eventId}
          event={event}
        />
      </div>
    </PageWrapper>
  );
}
