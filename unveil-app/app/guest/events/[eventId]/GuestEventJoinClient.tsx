'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { useErrorHandler } from '@/hooks/common';
import { autoJoinEventByPhone } from '@/lib/services/guestAutoJoin';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  SecondaryButton,
  LoadingSpinner,
  MicroCopy,
} from '@/components/ui';
import { UnveilHeader } from '@/components/shared';

type JoinState =
  | 'loading'
  | 'join_gate'
  | 'authenticating'
  | 'joining'
  | 'error';

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  time_zone: string | null;
}

interface GuestEventJoinClientProps {
  /** Event info pre-fetched from server */
  eventInfo: EventInfo;
  /** Event ID from URL params */
  eventId: string;
  /** Whether user was authenticated on the server */
  isAuthenticated: boolean;
  /** User ID if authenticated */
  userId?: string;
  /** User phone if authenticated */
  userPhone?: string | null;
}

/**
 * Client component for guest event join flow
 *
 * Server has already verified:
 * - Event exists
 * - Basic event info is available
 *
 * Client handles:
 * - Auth state and session management
 * - Auto-join logic
 * - Join gate for unauthenticated users
 */
export function GuestEventJoinClient({
  eventInfo,
  eventId,
  isAuthenticated,
  userId,
  userPhone,
}: GuestEventJoinClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get('phone');

  const [joinState, setJoinState] = useState<JoinState>(
    isAuthenticated ? 'joining' : 'join_gate',
  );
  const [error, setError] = useState<string>('');
  const { handleError } = useErrorHandler();

  const checkExistingAccess = useCallback(
    async (uid: string) => {
      try {
        const { data: existingGuest, error: accessError } = await supabase
          .from('event_guests')
          .select('id, user_id')
          .eq('event_id', eventId)
          .eq('user_id', uid)
          .single();

        if (accessError && accessError.code !== 'PGRST116') {
          console.error('Error checking existing access:', accessError);
          return;
        }

        if (existingGuest) {
          router.replace(`/guest/events/${eventId}/home`);
        } else {
          setError(
            "We couldn't find your invitation to this event. Please check with the host.",
          );
          setJoinState('error');
        }
      } catch (err) {
        console.error('Error checking existing access:', err);
        setError('Something went wrong. Please try again.');
        setJoinState('error');
      }
    },
    [eventId, router],
  );

  const handleAutoJoin = useCallback(
    async (uid: string, phone?: string | null) => {
      try {
        const phoneToUse = phone || phoneParam;

        if (!phoneToUse) {
          await checkExistingAccess(uid);
          return;
        }

        const validation = normalizePhoneNumber(phoneToUse);
        if (!validation.isValid) {
          setError(validation.error || 'Invalid phone number format');
          setJoinState('error');
          return;
        }

        const normalizedPhone = validation.normalized!;
        const result = await autoJoinEventByPhone(eventId, uid, normalizedPhone);

        if (result.success) {
          router.replace(`/guest/events/${eventId}/home`);
        } else if (result.error === 'not_invited') {
          setError(
            "We couldn't find your invitation to this event. Please check with the host or try a different phone number.",
          );
          setJoinState('error');
        } else if (result.error === 'already_joined') {
          router.replace(`/guest/events/${eventId}/home`);
        } else if (result.error === 'already_claimed') {
          setError(
            'This invitation has already been claimed by another account. Please contact the host if you believe this is an error.',
          );
          setJoinState('error');
        } else {
          setError(result.error || 'Unable to join event. Please try again.');
          setJoinState('error');
        }
      } catch (err) {
        console.error('Auto-join error:', err);
        setError(
          'Something went wrong while joining the event. Please try again.',
        );
        setJoinState('error');
      }
    },
    [eventId, phoneParam, router, checkExistingAccess],
  );

  // Handle auto-join for authenticated users
  useEffect(() => {
    if (isAuthenticated && userId && joinState === 'joining') {
      handleAutoJoin(userId, userPhone || phoneParam);
    }
  }, [isAuthenticated, userId, userPhone, phoneParam, joinState, handleAutoJoin]);

  const handleJoinClick = () => {
    setJoinState('authenticating');
    const returnUrl = `/guest/events/${eventId}${phoneParam ? `?phone=${encodeURIComponent(phoneParam)}` : ''}`;
    router.push(`/login?next=${encodeURIComponent(returnUrl)}`);
  };

  const handleContactHost = () => {
    handleError(
      'Please contact the event host for assistance with your invitation.',
      {
        context: 'Contact host',
        showToast: true,
      },
    );
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Error state
  if (joinState === 'error') {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <CardContainer className="text-center">
            <div className="text-4xl mb-4">😔</div>
            <PageTitle className="mb-4">Unable to Join Event</PageTitle>
            <SubTitle className="mb-6">{error}</SubTitle>

            <div className="space-y-3">
              <SecondaryButton onClick={handleContactHost} className="w-full">
                Contact Host
              </SecondaryButton>
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
  if (joinState === 'join_gate') {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <CardContainer className="text-center">
            <div className="mb-6">
              <UnveilHeader size="sm" className="mb-4" />
              <div className="text-4xl mb-4">🎉</div>
              <PageTitle className="mb-2">You&apos;re Invited!</PageTitle>
              <SubTitle className="mb-6">Join {eventInfo.title}</SubTitle>
            </div>

            {/* Event details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Event:
                  </span>
                  <p className="text-gray-900">{eventInfo.title}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Date:
                  </span>
                  <p className="text-gray-900">
                    {formatEventDate(eventInfo.event_date)}
                  </p>
                </div>
                {eventInfo.location && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">
                      Location:
                    </span>
                    <p className="text-gray-900">{eventInfo.location}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <PrimaryButton onClick={handleJoinClick} className="w-full">
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

  // Authenticating state - just show loading
  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <LoadingSpinner size="lg" text="Redirecting to login..." />
      </div>
    </PageWrapper>
  );
}
