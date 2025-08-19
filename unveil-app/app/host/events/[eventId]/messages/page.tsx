'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  PageWrapper,
  CardContainer,
  BackButton,
  LoadingSpinner
} from '@/components/ui';

// Lazy load enhanced messaging center with selection and scheduling
const LazyMessageCenter = lazy(() => import('@/components/features/messaging/host/MessageCenter').then(m => ({ default: m.MessageCenter })));

type Event = Database['public']['Tables']['events']['Row'];

/**
 * Inner component that handles the messages page content
 */
function MessagesPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.eventId as string;
  
  // Get preselection parameters from URL
  const preset = searchParams.get('preset'); // 'not_invited', 'custom', etc.
  const guestsParam = searchParams.get('guests'); // comma-separated guest IDs

  // Get confirmation parameters from URL (REMOVED - now handled by in-modal flow)
  // const sent = searchParams.get('sent');
  // const messageId = searchParams.get('messageId');
  // const sentCount = searchParams.get('sentCount');
  // const failedCount = searchParams.get('failedCount');
  // const scheduledAt = searchParams.get('scheduledAt');

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [hasShownToast, setHasShownToast] = useState(false); // REMOVED - no longer needed

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

  // REMOVED: Handle send confirmation toast - now handled by in-modal flow
  // useEffect(() => {
  //   if (sent === '1' && !hasShownToast && event) {
  //     const sentCountNum = parseInt(sentCount || '0', 10);
  //     const failedCountNum = parseInt(failedCount || '0', 10);
  //     
  //     if (scheduledAt) {
  //       // Scheduled message
  //       const scheduledDate = new Date(scheduledAt);
  //       const formattedDate = scheduledDate.toLocaleDateString();
  //       const formattedTime = scheduledDate.toLocaleTimeString([], { 
  //         hour: '2-digit', 
  //         minute: '2-digit' 
  //       });
  //       
  //       showSuccess(
  //         'Message scheduled',
  //         `Message scheduled for ${formattedDate} at ${formattedTime}.`
  //       );
  //     } else if (failedCountNum > 0) {
  //       // Partial failures
  //       showError(
  //         'Message sent with issues',
  //         `Sent to ${sentCountNum} guests; ${failedCountNum} failed.`,
  //         messageId ? {
  //           label: 'View deliveries',
  //           onClick: () => {
  //             // TODO: Navigate to message detail/history if available
  //             console.log('Navigate to message deliveries:', messageId);
  //           }
  //         } : undefined
  //       );
  //     } else {
  //       // Full success
  //       showSuccess(
  //         'Message sent',
  //         `Message sent to ${sentCountNum} guest${sentCountNum === 1 ? '' : 's'}.`,
  //         messageId ? {
  //           label: 'View deliveries',
  //           onClick: () => {
  //             // TODO: Navigate to message detail/history if available
  //             console.log('Navigate to message deliveries:', messageId);
  //           }
  //         } : undefined
  //       );
  //     }
  //     
  //     setHasShownToast(true);
  //     
  //     // Clear query params to prevent duplicate toasts
  //     const newUrl = new URL(window.location.href);
  //     newUrl.searchParams.delete('sent');
  //     newUrl.searchParams.delete('messageId');
  //     newUrl.searchParams.delete('sentCount');
  //     newUrl.searchParams.delete('failedCount');
  //     newUrl.searchParams.delete('scheduledAt');
  //     
  //     // Use router.replace to update URL without triggering navigation
  //     router.replace(newUrl.pathname + (newUrl.search ? `?${newUrl.searchParams.toString()}` : ''));
  //   }
  // }, [sent, messageId, sentCount, failedCount, scheduledAt, hasShownToast, event, showSuccess, showError, router]);

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
          <LazyMessageCenter 
            eventId={eventId} 
            preselectionPreset={preset}
            preselectedGuestIds={guestsParam ? guestsParam.split(',') : undefined}
          />
        </Suspense>
      </div>
    </PageWrapper>
  );
}

/**
 * Main page component - no longer needs ToastProvider wrapper
 */
export default function EventMessagesPage() {
  return <MessagesPageContent />;
}