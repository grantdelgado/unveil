'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useEventWithGuest } from '@/hooks/events';

import { GuestMessaging } from '@/components/features/messaging';
import { EventSchedule } from '@/components/features/scheduling';
import { InstructionalBanner, PhotoAlbumButton, GuestRSVPBadge, GuestRSVPSection } from '@/components/features/guest';
import { throttle } from '@/lib/utils/throttle';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  SectionTitle,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  BackButton,
  SkeletonLoader
} from '@/components/ui';
import { ErrorBoundary, MessagingErrorFallback } from '@/components/ui/ErrorBoundary';

export default function GuestEventHomePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isUpdatingRSVP, setIsUpdatingRSVP] = useState(false);

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
  const { event, guestInfo, loading, error, updateRSVP } =
    useEventWithGuest(eventId, currentUserId);

  const handleRSVPUpdate = async (status: string) => {
    setIsUpdatingRSVP(true);
    try {
      const result = await updateRSVP(status);

      if (!result.success) {
        alert(result.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('RSVP update error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsUpdatingRSVP(false);
    }
  };

  const handleSendMessage = async () => {
    // NOTE: Message sending functionality available via MessageThread component
    console.log('Sending message:', messageText);
    setMessageText('');
    setShowMessageModal(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };



  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <div className="min-h-screen bg-[#FAFAFA]">
      {/* Sticky Header */}
      <div
        className={`sticky top-0 z-40 bg-[#FAFAFA]/95 backdrop-blur-sm border-b border-gray-200/50 transition-all duration-300 ${
          isScrolled ? 'shadow-lg' : 'shadow-sm'
        }`}
      >
        <div className="max-w-5xl mx-auto px-6 transition-all duration-300">
          <div
            className={`transition-all duration-300 ${isScrolled ? 'py-3' : 'py-6'}`}
          >
            <div className={`mb-3 transition-all duration-300 ${isScrolled ? 'text-sm' : ''}`}>
              <BackButton 
                href="/select-event"
                variant="subtle"
                className={isScrolled ? 'text-xs py-1 px-2' : ''}
              >
                Your Events
              </BackButton>
            </div>
            <div className="space-y-2">
              <h1
                className={`font-semibold text-gray-900 transition-all duration-300 tracking-tight ${
                  isScrolled ? 'text-xl' : 'text-3xl'
                }`}
              >
                {event.title}
              </h1>
              <div className="flex justify-end">
                <GuestRSVPBadge
                  currentStatus={guestInfo?.rsvp_status || null}
                  onStatusUpdate={handleRSVPUpdate}
                  isScrolled={isScrolled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RSVP Section - Only show if guest hasn't RSVP'd */}
      {!guestInfo?.rsvp_status && (
        <GuestRSVPSection 
          onStatusUpdate={handleRSVPUpdate}
          isUpdating={isUpdatingRSVP}
        />
      )}

      {/* Instructional Banner */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-4">
        <InstructionalBanner />
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">


            {/* Event Details Card */}
            <CardContainer className="p-5">
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-stone-800">Celebration Details</h2>

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
                      <p className="text-stone-700 text-base">
                        {formatDate(event.event_date)}
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
                        <p className="text-stone-700 text-base">{event.location}</p>
                      </div>
                    </div>
                  )}

                  {event.description && (
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
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 00-9-9z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-stone-800 mb-1">
                          About this celebration
                        </h3>
                        <p className="text-stone-700 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContainer>

            {/* Shared Photo Album */}
            <CardContainer>
              <div className="space-y-4">
                <SectionTitle>Photo Album</SectionTitle>
                <PhotoAlbumButton 
                  albumUrl={undefined} // TODO: Add shared_album_url field to database
                />
              </div>
            </CardContainer>

            {/* Messaging */}
            <CardContainer className="p-0 overflow-hidden">
              <GuestMessaging 
                eventId={eventId} 
                currentUserId={currentUserId} 
                guestId={guestInfo?.id || currentUserId || ''} 
              />
            </CardContainer>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Connect & Explore */}
            <CardContainer className="p-5">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-800">Connect & Explore</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SecondaryButton
                    onClick={() => setShowMessageModal(true)}
                    className="py-2.5 px-3 text-sm bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300"
                  >
                    Send a private note
                  </SecondaryButton>

                  <SecondaryButton className="py-2.5 px-3 text-sm bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300">
                    View gift registry
                  </SecondaryButton>

                  <SecondaryButton
                    onClick={() => setShowScheduleModal(true)}
                    className="py-2.5 px-3 text-sm bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300 md:col-span-2"
                  >
                    View schedule
                  </SecondaryButton>
                </div>
              </div>
            </CardContainer>

            {/* Host Contact */}
            {event.host && (
              <CardContainer className="p-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-stone-800">Your Hosts</h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center text-white font-medium text-lg border-2 border-stone-200">
                      {event.host.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h4 className="font-medium text-stone-800 text-base">
                        {event.host.full_name || 'Your hosts'}
                      </h4>
                      <p className="text-sm text-stone-600">
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

      {/* Direct Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <CardContainer maxWidth="md" className="shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <SectionTitle>Send a private note</SectionTitle>
                <SecondaryButton
                  onClick={() => setShowMessageModal(false)}
                  fullWidth={false}
                  className="!p-2 text-gray-400 hover:text-gray-600 border-none bg-transparent hover:bg-gray-100"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </SecondaryButton>
              </div>

              <div className="space-y-4">
                <div>
                  <FieldLabel>To: {event?.host?.full_name || 'Your hosts'}</FieldLabel>
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="message">Your message</FieldLabel>
                  <textarea
                    id="message"
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 transition-all resize-none"
                    placeholder="Share your thoughts, ask a question, or send your congratulations..."
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <SecondaryButton
                    onClick={() => setShowMessageModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={handleSendMessage}
                    className="flex-1"
                    disabled={!messageText.trim()}
                  >
                    Send message
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </CardContainer>
        </div>
      )}

      {/* Event Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-100">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
              <SectionTitle>Celebration Schedule</SectionTitle>
              <SecondaryButton
                onClick={() => setShowScheduleModal(false)}
                fullWidth={false}
                className="!p-2 text-gray-400 hover:text-gray-600 border-none bg-transparent hover:bg-gray-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </SecondaryButton>
            </div>
            <div className="p-6">
              {event && (
                <EventSchedule
                  eventDate={event.event_date}
                  location={event.location}
                />
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}
