'use client';

import React, { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  CardContainer,
  BackButton,
  LoadingSpinner,
  ErrorBoundary,
  MessagingErrorFallback,
} from '@/components/ui';

// Lazy load heavy components
const MessageQueue = React.lazy(() => 
  import('@/components/features/messaging/host').then(module => ({ default: module.MessageQueue }))
);

interface ScheduledPageClientProps {
  eventId: string;
}

export function ScheduledPageClient({ eventId }: ScheduledPageClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verify user access
  useEffect(() => {
    if (!eventId) return;

    const verifyAccess = async () => {
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

        // Verify event access
        const { error: eventError } = await supabase
          .from('events')
          .select('id')
          .eq('id', eventId)
          .eq('host_user_id', user.id)
          .single();

        if (eventError) {
          console.error('Event access error:', eventError);
          if (eventError.code === 'PGRST116') {
            setError('Event not found or you do not have permission to access it.');
          } else {
            setError('Failed to verify event access');
          }
          return;
        }

      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [eventId, router]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading scheduled messages...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <BackButton 
            href={`/host/events/${eventId}/messages`}
            fallback={`/host/events/${eventId}/dashboard`}
          >
            Back to Messages
          </BackButton>
          
          <CardContainer className="mt-6">
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">❌</span>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Event</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </CardContainer>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-900 mb-6">Scheduled Messages</h1>
          <Suspense 
            fallback={
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-center min-h-64">
                  <div className="flex flex-col items-center gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm text-gray-600">Loading message queue...</p>
                  </div>
                </div>
              </div>
            }
          >
            <MessageQueue eventId={eventId} />
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
} 