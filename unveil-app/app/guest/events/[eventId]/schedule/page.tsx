'use client';

import { useParams } from 'next/navigation';
import { useEventWithGuest } from '@/hooks/events';
import { 
  PageWrapper, 
  CardContainer, 
  PageTitle, 
  SubTitle, 
  BackButton,
  SkeletonLoader 
} from '@/components/ui';
import EventSchedule from '@/components/features/scheduling/EventSchedule';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function GuestEventSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get session first
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        console.error('❌ Error getting session:', sessionError);
        router.push('/login');
        return;
      }

      setCurrentUserId(session.user.id);
    };

    getSession();
  }, [router]);

  // Use the custom hook to fetch event and guest data
  const { event, loading, error } = useEventWithGuest(eventId, currentUserId);

  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto space-y-6">
          <SkeletonLoader variant="card" count={2} />
        </div>
      </PageWrapper>
    );
  }

  if (error || !event) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          <CardContainer className="p-8 text-center">
            <div className="text-4xl mb-4">😔</div>
            <PageTitle>Event Not Found</PageTitle>
            <SubTitle>
              {error?.message || 'This event may have been moved or is no longer available.'}
            </SubTitle>
            <BackButton 
              href="/select-event"
              className="mt-6"
            >
              Return to Your Events
            </BackButton>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper centered={false}>
      <div className="max-w-4xl mx-auto pt-4 pb-6">
        {/* Header */}
        <div className="mb-6">
          <BackButton 
            href={`/guest/events/${eventId}/home`}
            variant="subtle"
            className="mb-4"
          >
            Back to Event
          </BackButton>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.title} Schedule</h1>
          <SubTitle>
            A complete breakdown of celebration times and locations
          </SubTitle>
        </div>

        {/* Event Schedule */}
        <EventSchedule 
          eventId={eventId}
          eventDate={event.event_date}
          location={event.location}
          timeZone={event.time_zone}
        />
      </div>
    </PageWrapper>
  );
}
