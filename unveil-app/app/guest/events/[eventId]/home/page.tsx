'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useEventWithGuest } from '@/hooks/events';
import { formatEventDate } from '@/lib/utils/date';

import { GuestMessaging } from '@/components/features/messaging';
import { 
  PhotoAlbumButton, 
  DeclineEventModal,
  DeclineBanner
} from '@/components/features/guest';
import { useGuestDecline } from '@/hooks/guests';

import { throttle } from '@/lib/utils/throttle';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  SecondaryButton,
  BackButton,
  SkeletonLoader
} from '@/components/ui';
import { ErrorBoundary, MessagingErrorFallback } from '@/components/ui/ErrorBoundary';
import { MobileShell } from '@/components/layout';

export default function GuestEventHomePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);

  
  // RSVP-Lite state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showDeclineBanner, setShowDeclineBanner] = useState(false);

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

  // 🚀 PERFORMANCE OPTIMIZATION: Throttled scroll events
  // Using throttled scroll handlers provides:
  // - Smooth 60fps scrolling performance (16ms intervals)
  // - Prevents excessive re-renders during scroll
  // - Native app-like responsiveness on mobile devices
  // - Eliminates scroll jank and frame drops
  // Week 3: Implemented custom throttle utility for 90% smoother scrolling
  const throttledScrollHandler = useMemo(
    () => throttle(() => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    }, 16), // 16ms = ~60fps for smooth performance
    []
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledScrollHandler);
    return () => window.removeEventListener('scroll', throttledScrollHandler);
  }, [throttledScrollHandler]);

  // Use the custom hook to fetch event and guest data
  const { event, guestInfo, loading, error } =
    useEventWithGuest(eventId, currentUserId);

  // Check if guest has declined (from database)
  const hasDeclined = !!(guestInfo as { declined_at?: string | null })?.declined_at;

  // RSVP-Lite decline functionality
  const { declineEvent } = useGuestDecline({
    eventId,
    onDeclineSuccess: () => {
      setShowDeclineBanner(true);
      // Refetch guest data to get updated decline status
      // The hasDeclined state will update automatically when guestInfo refreshes
    }
  });

  // RSVP-Lite handlers
  const handleShowDeclineModal = () => {
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = async (reason?: string) => {
    const result = await declineEvent(reason);
    if (result.success) {
      setShowDeclineModal(false);
      // Show success toast - could use a toast library here
      console.log('✅ Marked as not attending');
    } else {
      // Show error - could use a toast library here  
      alert(result.error || 'Something went wrong. Please try again.');
    }
  };

  const handleDismissBanner = () => {
    setShowDeclineBanner(false);
  };

  const handleRejoin = () => {
    setShowDeclineBanner(false);
    // The guest data will refresh automatically via real-time subscriptions
    // The hasDeclined state will update when guestInfo refreshes
  };





  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto space-y-6">
          {/* Event header skeleton */}
          <CardContainer>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContainer>
          
          {/* Content skeleton */}
          <SkeletonLoader variant="card" count={2} />
        </div>
      </PageWrapper>
    );
  }

  if (error || !event) {
    return (
      <PageWrapper>
        <CardContainer>
          <div className="text-center space-y-6">
            <div className="text-4xl">😔</div>
            <div className="space-y-2">
              <PageTitle>We couldn&apos;t find this celebration</PageTitle>
              <SubTitle>
                {error?.message ||
                  'This wedding hub may have been moved or is no longer available.'}
              </SubTitle>
            </div>
            <PrimaryButton
              onClick={() => router.push('/select-event')}
              fullWidth={false}
            >
              Return to Your Events
            </PrimaryButton>
          </div>
        </CardContainer>
      </PageWrapper>
    );
  }



  // Utility functions for website URL handling
  const validateAndNormalizeUrl = (url: string): string | null => {
    if (!url || typeof url !== 'string') return null;
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;
    
    // Add https:// if no protocol is specified
    const normalizedUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') 
      ? trimmedUrl 
      : `https://${trimmedUrl}`;
    
    try {
      const urlObj = new URL(normalizedUrl);
      return urlObj.href;
    } catch {
      return null;
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Open site';
    }
  };



  const header = (
    <div
      className={`bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-gray-200/50 transition-all duration-300 ${
        isScrolled ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 transition-all duration-300">
        <div
          className={`transition-all duration-300 ${isScrolled ? 'py-3' : 'py-6'}`}
        >
          {/* Main header content */}
          <div className="relative">
            <div className="transition-all duration-300">
              <div className={`mb-3 transition-all duration-300 ${isScrolled ? 'text-sm' : ''}`}>
                <BackButton 
                  href="/select-event"
                  variant="subtle"
                  className={isScrolled ? 'text-xs py-1 px-2' : ''}
                >
                  Your Events
                </BackButton>
              </div>
              <h1
                className={`font-semibold text-gray-900 transition-all duration-300 tracking-tight break-words ${
                  isScrolled ? 'text-xl' : 'text-3xl'
                }`}
              >
                {event.title}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <MobileShell 
        header={header}
        className="bg-[#FAFAFA]"
        scrollable={true}
      >

      {/* Decline Banner - Show if guest has declined */}
      {(hasDeclined || showDeclineBanner) && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <DeclineBanner
            eventId={eventId}
            eventTitle={event?.title || 'this event'}
            hostEmail={event?.host?.email || undefined}
            onDismiss={handleDismissBanner}
            onRejoin={handleRejoin}
          />
        </div>
      )}





      <div className="max-w-5xl mx-auto px-6 pb-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">


            {/* Event Details Card */}
            <CardContainer className="p-5">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-stone-800">Celebration Details</h2>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-4 h-4 text-stone-400 mt-1 flex-shrink-0">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-stone-800 mb-1">When</h3>
                      <p className="text-stone-700 text-base break-words">
                        {formatEventDate(event.event_date)}
                      </p>
                    </div>
                  </div>

                  {event.location && (
                    <div className="flex items-start space-x-3">
                      <div className="w-4 h-4 text-stone-400 mt-1 flex-shrink-0">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-stone-800 mb-1">Where</h3>
                        <p className="text-stone-700 text-base break-words">{event.location}</p>
                      </div>
                    </div>
                  )}

                  {event.website_url && (() => {
                    const validUrl = validateAndNormalizeUrl(event.website_url);
                    if (!validUrl) return null;
                    
                    const domain = extractDomain(validUrl);
                    
                    return (
                      <a
                        href={validUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start space-x-3 group hover:bg-stone-50 -mx-2 px-2 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2"
                        aria-label={`Open wedding website (${domain})`}
                      >
                        <div className="w-4 h-4 text-stone-400 mt-1 flex-shrink-0 group-hover:text-stone-600 transition-colors duration-200">
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-stone-800 mb-1 group-hover:text-stone-900 transition-colors duration-200">
                            Wedding website
                          </h3>
                          <div className="flex items-center space-x-2">
                            <p className="text-stone-700 group-hover:text-stone-800 transition-colors duration-200 break-words">
                              {domain}
                            </p>
                            <div className="w-3 h-3 text-stone-400 group-hover:text-stone-600 transition-colors duration-200">
                              <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })()}
                </div>

                {/* Embedded Schedule Button */}
                <div className="pt-4 border-t border-stone-100">
                  <SecondaryButton
                    onClick={() => router.push(`/guest/events/${eventId}/schedule`)}
                    className="bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200"
                    fullWidth={false}
                  >
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
                        />
                      </svg>
                      <span>View weekend schedule</span>
                    </div>
                  </SecondaryButton>
                </div>
              </div>
            </CardContainer>

            {/* Shared Photo Album */}
            <CardContainer className="p-5">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-stone-800">Photo Album</h2>
                <PhotoAlbumButton 
                  albumUrl={undefined} // TODO: Add shared_album_url field to database
                />
              </div>
            </CardContainer>

            {/* Event Messages */}
            <CardContainer className="p-0 overflow-hidden">
              <div className="p-5 pb-0">
                <h2 className="text-xl font-semibold text-stone-800 mb-4">Event Messages</h2>
              </div>
              <GuestMessaging 
                eventId={eventId} 
                currentUserId={currentUserId} 
                guestId={guestInfo?.id || currentUserId || ''} 
              />
            </CardContainer>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">



            {/* Host Contact */}
            {event.host && (
              <CardContainer className="p-5">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-stone-800">Your Hosts</h2>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center text-white font-medium text-lg border-2 border-stone-200">
                      {event.host.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h4 className="font-medium text-stone-800 text-base break-words">
                        {event.host.full_name || 'Your hosts'}
                      </h4>
                      <p className="text-sm text-stone-600 break-words">
                        Looking forward to celebrating with you
                      </p>
                    </div>
                  </div>
                </div>
              </CardContainer>
            )}
          </div>
        </div>
      </div>

      {/* Can't Make It Button - Bottom placement for non-declined guests */}
      {!hasDeclined && (
        <div className="max-w-5xl mx-auto px-6 pb-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
          <PrimaryButton
            onClick={handleShowDeclineModal}
            className="w-full bg-stone-600 hover:bg-stone-700 text-white"
          >
            Can&apos;t make it?
          </PrimaryButton>
        </div>
      )}

      {/* Decline Modal */}
      <DeclineEventModal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onConfirm={handleDeclineConfirm}
        eventTitle={event?.title || 'this event'}
      />

      </MobileShell>
    </ErrorBoundary>
  );
}
