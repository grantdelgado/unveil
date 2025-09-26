'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEventWithGuest } from '@/hooks/events';
import { formatEventDate } from '@/lib/utils/date';
import { useDeferredMount } from '@/lib/utils/performance';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useProviderReady } from '@/hooks/common/useProviderReady';

import dynamic from 'next/dynamic';

// Performance: Lazy load GuestMessaging after critical content paints
const GuestMessaging = dynamic(
  () => import('@/components/features/messaging/guest/GuestMessaging').then((mod) => ({ default: mod.GuestMessaging })),
  {
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ),
    ssr: false, // Dynamic content, no SSR needed - improves TTFB
  }
);

// Lazy load heavy modal components
const DeclineEventModal = dynamic(
  () => import('@/components/features/guest/DeclineEventModal').then((mod) => ({ default: mod.DeclineEventModal })),
  {
    loading: () => null, // Modal loading state handled internally
    ssr: false,
  }
);

import {
  PhotoAlbumButton,
  DeclineBanner,
} from '@/components/features/guest';
import { MessageCircle, Camera } from 'lucide-react';
import { useGuestDecline } from '@/hooks/guests';
import { useErrorHandler } from '@/hooks/common';

import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  SecondaryButton,
  SkeletonLoader,
  Button,
} from '@/components/ui';
import {
  ErrorBoundary,
  MessagingErrorFallback,
} from '@/components/ui/ErrorBoundary';
import { MobileShell } from '@/components/layout';

export default function GuestEventHomePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Performance: Defer messaging until after critical content renders
  const shouldLoadMessaging = useDeferredMount(100); // 100ms delay for LCP optimization
  
  // Provider safety: Ensure providers are ready before loading messaging
  const { isReady: providersReady } = useProviderReady();
  
  // Performance: Load sidebar with simple delay (below-the-fold on mobile)
  const shouldLoadSidebar = useDeferredMount(300); // Load after messaging

  // RSVP-Lite state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showDeclineBanner, setShowDeclineBanner] = useState(false);

  // Use auth provider instead of direct Supabase client
  const { session, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (!authLoading) {
      if (!session?.user) {
        router.push('/login');
        return;
      }
      setCurrentUserId(session.user.id);
    }
  }, [session, authLoading, router]);

  // Use the custom hook to fetch event and guest data
  // Only enable realtime subscriptions after providers are ready
  const { event, guestInfo, loading, error } = useEventWithGuest(
    eventId,
    currentUserId,
  );

  // Check if guest has declined (from database)
  const hasDeclined = !!(guestInfo as { declined_at?: string | null })
    ?.declined_at;

  // RSVP-Lite decline functionality
  const { handleError } = useErrorHandler();
  const { declineEvent } = useGuestDecline({
    eventId,
    onDeclineSuccess: () => {
      setShowDeclineBanner(true);
    },
  });

  // Calculate primary CTA based on event features - Messages are visible above, so prioritize other actions
  const primaryCTA = useMemo(() => {
    // Priority: Photos > Schedule (Messages are already visible above)
    if (event?.photo_album_url) {
      return {
        label: 'Upload Photos',
        action: () => {
          const albumUrl = validateAndNormalizeUrl(event.photo_album_url || '');
          if (albumUrl) {
            window.open(albumUrl, '_blank', 'noopener,noreferrer');
          }
        },
        icon: 'camera',
      };
    }
    
    return {
      label: 'View Schedule',
      action: () => router.push(`/guest/events/${eventId}/schedule`),
      icon: 'calendar',
    };
  }, [event, eventId, router]);

  // Calculate days until event for status chip
  const eventStatus = useMemo(() => {
    if (!event?.event_date) return null;
    
    const eventDate = new Date(event.event_date);
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0) return `In ${diffDays} days`;
    return null; // Past events
  }, [event?.event_date]);

  // RSVP-Lite handlers
  const handleShowDeclineModal = () => {
    setShowDeclineModal(true);
  };

  const handleDeclineConfirm = async (reason?: string) => {
    const result = await declineEvent(reason);
    if (result.success) {
      setShowDeclineModal(false);
      console.log('✅ Marked as not attending');
    } else {
      handleError(result.error || 'Something went wrong. Please try again.', { 
        context: 'Decline event' 
      });
    }
  };

  const handleDismissBanner = () => {
    setShowDeclineBanner(false);
  };

  const handleRejoin = () => {
    setShowDeclineBanner(false);
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto space-y-6">
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

  // Check if user is no longer a guest of this event
  if (event && !guestInfo && currentUserId) {
    return (
      <PageWrapper>
        <CardContainer>
          <div className="text-center space-y-6">
            <div className="text-4xl">🚫</div>
            <div className="space-y-2">
              <PageTitle>No longer invited</PageTitle>
              <SubTitle>
                You are no longer a guest of this event. Please contact the host
                if you believe this is an error.
              </SubTitle>
            </div>
            <PrimaryButton
              onClick={() => router.push('/select-event')}
              fullWidth={false}
            >
              View Your Other Events
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

    const normalizedUrl =
      trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
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


  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <MobileShell 
        className="bg-[#FAFAFA]" 
        scrollable={true}
        footer={
          !hasDeclined && (
            <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200/50 px-6 py-4">
              <button
                onClick={primaryCTA.action}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {primaryCTA.icon === 'message' && <MessageCircle className="h-5 w-5" />}
                {primaryCTA.icon === 'camera' && <div className="h-5 w-5"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg></div>}
                {primaryCTA.icon === 'calendar' && <div className="h-5 w-5"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" /></svg></div>}
                <span>{primaryCTA.label}</span>
              </button>
            </div>
          )
        }
      >
        {/* Clean Event Header */}
        <div className="pt-[env(safe-area-inset-top)] px-6 pb-6">
          {/* Back Navigation */}
          <button
            onClick={() => router.push('/select-event')}
            className="-ml-2 mt-2 p-2 rounded-xl flex items-center gap-2 min-h-[44px] min-w-[44px] text-[15px] font-medium text-gray-900 hover:bg-gray-100/40 active:bg-gray-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 mb-6"
          >
            <div className="h-5 w-5"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></div>
            <span>Your Events</span>
          </button>

          {/* Event Title & Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                {event.title}
              </h1>
              {eventStatus && (
                <span className="ml-4 px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full whitespace-nowrap">
                  {eventStatus}
                </span>
              )}
            </div>
            <div className="space-y-1 text-gray-600">
              <p className="text-sm font-medium">
                {formatEventDate(event.event_date)}
              </p>
              {event.location && (
                <p className="text-sm">
                  {event.location}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => router.push(`/guest/events/${eventId}/schedule`)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <div className="h-4 w-4"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" /></svg></div>
              <span className="text-sm font-medium">Schedule</span>
            </button>
            {event?.photo_album_url && primaryCTA.icon !== 'camera' && (
              <button
                onClick={() => {
                  const albumUrl = validateAndNormalizeUrl(event.photo_album_url || '');
                  if (albumUrl) {
                    window.open(albumUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Photos</span>
              </button>
            )}
            {!hasDeclined && (
              <button
                onClick={handleShowDeclineModal}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap text-gray-600 hover:text-gray-800"
              >
                <div className="h-4 w-4"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <span className="text-sm font-medium">Can&apos;t make it?</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Decline Banner */}
        {(hasDeclined || showDeclineBanner) && (
          <div className="max-w-5xl mx-auto px-6 pb-4">
            <DeclineBanner
              eventId={eventId}
              eventTitle={event?.title || 'this event'}
              onDismiss={handleDismissBanner}
              onRejoin={handleRejoin}
            />
          </div>
        )}

        <div className="max-w-5xl mx-auto px-6 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Event Details Card */}
              <CardContainer className="p-5">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-stone-800">
                    Celebration Details
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-4 h-4 text-stone-400 mt-1 flex-shrink-0">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
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
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-medium text-stone-800 mb-1">Where</h3>
                          <p className="text-stone-700 text-base break-words">
                            {event.location}
                          </p>
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
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
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
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </a>
                      );
                    })()}
                  </div>

                  {/* Schedule Button */}
                  <div className="pt-4 border-t border-stone-100">
                    <SecondaryButton
                      onClick={() => router.push(`/guest/events/${eventId}/schedule`)}
                      className="bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200"
                      fullWidth={false}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
                        </svg>
                        <span>View weekend schedule</span>
                      </div>
                    </SecondaryButton>
                  </div>
                </div>
              </CardContainer>

              {/* Photo Album - Always render, PhotoAlbumButton is lightweight */}
              {event?.photo_album_url && (
                <CardContainer className="p-5">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-stone-800">Photo Album</h2>
                    <PhotoAlbumButton
                      albumUrl={event.photo_album_url}
                      eventId={eventId}
                    />
                  </div>
                </CardContainer>
              )}

              {/* Event Messages - Provider available from layout */}
              <CardContainer className="p-0 overflow-hidden" data-testid="event-messages-card" aria-label="Event Messages Section">
                {/* Performance: Only load messaging after providers ready and initial render */}
                {currentUserId && guestInfo && shouldLoadMessaging && providersReady && (
                  <GuestMessaging
                    eventId={eventId}
                    currentUserId={currentUserId}
                    guestId={guestInfo.id || currentUserId}
                    eventTimezone={event?.time_zone || null}
                  />
                )}
                {/* Show loading placeholder until messaging loads */}
                {currentUserId && guestInfo && (!shouldLoadMessaging || !providersReady) && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-pulse space-y-4 w-full">
                      <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContainer>
            </div>

            {/* Sidebar - Simple deferred loading */}
            <div className="space-y-8">
              {/* Host Contact */}
              {event.host && shouldLoadSidebar && (
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
              {/* Sidebar placeholder */}
              {event.host && !shouldLoadSidebar && (
                <CardContainer className="p-5">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </CardContainer>
              )}
            </div>
          </div>
        </div>

        {/* Can't Make It Button - moved to content area for declined users */}
        {hasDeclined && (
          <div className="max-w-5xl mx-auto px-6 pb-4">
            <Button
              onClick={handleShowDeclineModal}
              variant="outline"
              className="w-full bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-300"
            >
              Update RSVP status
            </Button>
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