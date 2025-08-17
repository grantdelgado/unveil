'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getEventById } from '@/lib/services/events';
import { useEventDetails } from '@/hooks/events/useEventDetails';
import { EventDetailsEditor } from '@/components/features/host-dashboard/EventDetailsEditor';
import type { EventDetailsFormData } from '@/lib/validation/events';
import {
  PageWrapper,
  BackButton,
  LoadingSpinner,
  CardContainer,
  PageTitle,
  SubTitle
} from '@/components/ui';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  
  // State management
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Hooks
  const { updateEvent } = useEventDetails();

  // Load event data
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verify user authentication
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          router.push('/login');
          return;
        }

        // Fetch event data
        const result = await getEventById(eventId);
        
        if (!result.success) {
          if (result.error && typeof result.error === 'object' && 'code' in result.error) {
            if (result.error.code === 'PGRST116') {
              setError('Event not found');
            } else if (result.error.code === '42501') {
              setError('You don\'t have permission to edit this event');
            } else {
              setError('Failed to load event data');
            }
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        if (!result.data) {
          setError('Event not found');
          return;
        }

        setEvent(result.data);
      } catch (err) {
        console.error('Error loading event:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEventData();
    }
  }, [eventId, router]);

  // Handle save
  const handleSave = async (formData: EventDetailsFormData) => {
    return await updateEvent(eventId, formData);
  };

  // Handle cancel
  const handleCancel = () => {
    router.push(`/host/events/${eventId}/dashboard`);
  };

  // Handle preview guest view
  const handlePreviewGuestView = () => {
    // Open guest view in new tab
    window.open(`/guest/events/${eventId}/home`, '_blank', 'noopener,noreferrer');
  };

  // Loading state
  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          {/* Back Navigation skeleton */}
          <div className="mb-6">
            <div className="animate-pulse h-10 bg-gray-200 rounded-lg w-32"></div>
          </div>
          
          {/* Loading content */}
          <div className="space-y-6">
            <CardContainer className="p-6">
              <div className="text-center space-y-4">
                <LoadingSpinner size="lg" />
                <div className="space-y-2">
                  <div className="h-8 bg-gray-200 rounded animate-pulse mx-auto w-64"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse mx-auto w-48"></div>
                </div>
              </div>
            </CardContainer>
            
            {/* Form skeleton */}
            {[1, 2, 3, 4].map((i) => (
              <CardContainer key={i} className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </CardContainer>
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          {/* Back Navigation */}
          <div className="mb-6">
            <BackButton 
              href={`/host/events/${eventId}/dashboard`}
              fallback="/select-event"
            >
              Back to Dashboard
            </BackButton>
          </div>

          <CardContainer className="p-8 text-center">
            <div className="space-y-6">
              <div className="text-4xl">
                {error?.includes('permission') ? '🔒' : '😞'}
              </div>
              <div className="space-y-2">
                <PageTitle>
                  {error?.includes('permission') 
                    ? 'Access Denied' 
                    : 'Unable to Load Event'
                  }
                </PageTitle>
                <SubTitle>
                  {error || 'This event could not be found or you may not have permission to edit it.'}
                </SubTitle>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push(`/host/events/${eventId}/dashboard`)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 transition-colors"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => router.push('/select-event')}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                >
                  All Events
                </button>
              </div>
            </div>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  // Main edit form
  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Back Navigation */}
        <div className="mb-6">
          <BackButton 
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
          </BackButton>
        </div>

        {/* Event Details Editor */}
        <EventDetailsEditor
          event={event}
          onSave={handleSave}
          onCancel={handleCancel}
          onPreviewGuestView={handlePreviewGuestView}
        />
      </div>
    </PageWrapper>
  );
}
