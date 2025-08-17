'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { autoJoinEventByPhone } from '@/lib/services/guestAutoJoin';
import { 
  PageWrapper, 
  CardContainer, 
  PageTitle, 
  SubTitle, 
  PrimaryButton, 
  SecondaryButton,
  LoadingSpinner,
  MicroCopy
} from '@/components/ui';
import { UnveilHeader } from '@/components/shared';

type JoinState = 'loading' | 'join_gate' | 'authenticating' | 'joining' | 'error';

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  time_zone: string | null;
}

export default function GuestEventJoinPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const eventId = params.eventId as string;
  const phoneParam = searchParams.get('phone');
  
  const [joinState, setJoinState] = useState<JoinState>('loading');
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [, setCurrentUser] = useState<{ id: string; phone?: string } | null>(null);

  const handleAutoJoin = useCallback(async (userId: string, userPhone?: string | null) => {
    try {
      const phoneToUse = userPhone || phoneParam;
      
      if (!phoneToUse) {
        // User is authenticated but no phone available, check if already joined
        await checkExistingAccess(userId);
        return;
      }

      // Normalize the phone number
      const validation = normalizePhoneNumber(phoneToUse);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid phone number format');
        setJoinState('error');
        return;
      }

      const normalizedPhone = validation.normalized!;
      
      // Attempt to auto-join using the enhanced service
      const result = await autoJoinEventByPhone(eventId, userId, normalizedPhone);
      
      if (result.success) {
              // Log success telemetry (no PII)
      console.log('Auto-join success:', {
        eventId,
        userId,
        hasPhone: !!(userPhone || phoneParam)
      });
        // Successfully joined, redirect to event home
        router.replace(`/guest/events/${eventId}/home`);
      } else if (result.error === 'not_invited') {
        setError('We couldn&apos;t find your invitation to this event. Please check with the host or try a different phone number.');
        setJoinState('error');
      } else if (result.error === 'already_joined') {
        // Already joined, just redirect
        router.replace(`/guest/events/${eventId}/home`);
      } else if (result.error === 'already_claimed') {
        setError('This invitation has already been claimed by another account. Please contact the host if you believe this is an error.');
        setJoinState('error');
      } else {
        setError(result.error || 'Unable to join event. Please try again.');
        setJoinState('error');
      }
    } catch (err) {
      console.error('Auto-join error:', err);
      // Log telemetry for debugging (no PII)
      console.log('Auto-join telemetry:', {
        eventId,
        userId,
        hasPhone: !!(userPhone || phoneParam),
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      setError('Something went wrong while joining the event. Please try again.');
      setJoinState('error');
    }
  }, [eventId, phoneParam, router]);

  const checkExistingAccess = useCallback(async (userId: string) => {
    try {
      // Check if user already has access to this event
      const { data: existingGuest, error } = await supabase
        .from('event_guests')
        .select('id, user_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (existingGuest) {
        // User already has access
        router.replace(`/guest/events/${eventId}/home`);
      } else {
        setError('We couldn&apos;t find your invitation to this event. Please check with the host.');
        setJoinState('error');
      }
    } catch (err) {
      console.error('Error checking existing access:', err);
      setError('Unable to verify event access. Please try again.');
      setJoinState('error');
    }
  }, [eventId, router]);

  // Check authentication and event access on mount
  const checkAuthAndEvent = useCallback(async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
        }

        setCurrentUser(session?.user || null);

        // Fetch event info (basic details for join gate)
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('id, title, event_date, location, time_zone')
          .eq('id', eventId)
          .single();

        if (eventError || !event) {
          setError('Event not found');
          setJoinState('error');
          return;
        }

        setEventInfo(event);

        // If user is authenticated, attempt auto-join
        if (session?.user) {
          setJoinState('joining');
          await handleAutoJoin(session.user.id, session.user.phone || phoneParam);
        } else {
          // Show join gate for unauthenticated users
          setJoinState('join_gate');
        }
      } catch (err) {
        console.error('Error during auth/event check:', err);
        setError('Something went wrong. Please try again.');
        setJoinState('error');
      }
    }, [eventId, phoneParam, handleAutoJoin]);

  useEffect(() => {
    if (eventId) {
      checkAuthAndEvent();
    }
  }, [eventId, checkAuthAndEvent]);

  const handleJoinClick = () => {
    setJoinState('authenticating');
    
    // Preserve the current URL including phone parameter for post-auth redirect
    const returnUrl = `/guest/events/${eventId}${phoneParam ? `?phone=${encodeURIComponent(phoneParam)}` : ''}`;
    
    // Navigate to login with return URL
    router.push(`/login?next=${encodeURIComponent(returnUrl)}`);
  };

  const handleContactHost = () => {
    // For now, just show an alert. In the future, this could open a contact form
    alert('Please contact the event host for assistance with your invitation.');
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (joinState === 'loading') {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <LoadingSpinner size="lg" text="Loading event..." />
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (joinState === 'error') {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <CardContainer className="text-center">
            <div className="text-4xl mb-4">😔</div>
            <PageTitle className="mb-4">
              {error.includes('Event not found') ? 'Event Not Found' : 'Unable to Join Event'}
            </PageTitle>
            <SubTitle className="mb-6">
              {error}
            </SubTitle>
            
            <div className="space-y-3">
              {!error.includes('Event not found') && (
                <SecondaryButton 
                  onClick={handleContactHost}
                  className="w-full"
                >
                  Contact Host
                </SecondaryButton>
              )}
              
              <SecondaryButton 
                onClick={() => router.push('/select-event')}
                className="w-full"
              >
                Back to Events
              </SecondaryButton>
            </div>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  // Joining state
  if (joinState === 'joining') {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <LoadingSpinner size="lg" text="Joining event..." />
        </div>
      </PageWrapper>
    );
  }

  // Join gate for unauthenticated users
  if (joinState === 'join_gate' && eventInfo) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <CardContainer className="text-center">
            <div className="mb-6">
              <UnveilHeader size="sm" className="mb-4" />
              <div className="text-4xl mb-4">🎉</div>
              <PageTitle className="mb-2">
                You&apos;re Invited!
              </PageTitle>
              <SubTitle className="mb-6">
                Join {eventInfo.title}
              </SubTitle>
            </div>

            {/* Event details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">Event:</span>
                  <p className="text-gray-900">{eventInfo.title}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Date:</span>
                  <p className="text-gray-900">{formatEventDate(eventInfo.event_date)}</p>
                </div>
                {eventInfo.location && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Location:</span>
                    <p className="text-gray-900">{eventInfo.location}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <PrimaryButton 
                onClick={handleJoinClick}
                className="w-full"
              >
                Continue to Join Event
              </PrimaryButton>
              
              <MicroCopy className="text-center">
                We&apos;ll verify your phone number to confirm your invitation.
              </MicroCopy>
            </div>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  return null;
}
