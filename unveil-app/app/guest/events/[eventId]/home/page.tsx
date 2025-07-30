'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useEventWithGuest } from '@/hooks/events';
import { GuestPhotoGallery } from '@/components/features/media';
import { GuestMessaging } from '@/components/features/messaging';
import { EventSchedule } from '@/components/features/scheduling';
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
  MicroCopy,
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

  // Scroll listener for sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Use the custom hook to fetch event and guest data
  const { event, guestInfo, loading, error, updateRSVP } =
    useEventWithGuest(eventId, currentUserId);

  const handleRSVPUpdate = async (status: string) => {
    const result = await updateRSVP(status);

    if (result.success) {
      // Success feedback handled by the UI state change
    } else {
      alert(result.error || 'Something went wrong. Please try again.');
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

  const getRSVPStatusColor = (status: string | null) => {
    switch (status) {
      case 'Attending':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Declined':
        return 'bg-stone-100 text-stone-700 border-stone-200';
      case 'Maybe':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const getRSVPStatusText = (status: string | null) => {
    switch (status) {
      case 'Attending':
        return 'Celebrating with you';
      case 'Declined':
        return 'Unable to attend';
      case 'Maybe':
        return 'Considering';
      default:
        return 'Awaiting your response';
    }
  };

  const RSVPButton = ({ 
    status, 
    children, 
    currentStatus 
  }: { 
    status: string; 
    children: React.ReactNode; 
    currentStatus: string | null;
  }) => {
    const isSelected = currentStatus === status;
    const getColorClasses = () => {
      if (isSelected) {
        switch (status) {
          case 'Attending':
            return 'bg-emerald-600 text-white shadow-sm';
          case 'Maybe':
            return 'bg-amber-600 text-white shadow-sm';
          case 'Declined':
            return 'bg-stone-600 text-white shadow-sm';
          default:
            return 'bg-purple-600 text-white shadow-sm';
        }
      } else {
        switch (status) {
          case 'Attending':
            return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300';
          case 'Maybe':
            return 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 hover:border-amber-300';
          case 'Declined':
            return 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200 hover:border-stone-300';
          default:
            return 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 hover:border-purple-300';
        }
      }
    };

    return (
      <button
        onClick={() => handleRSVPUpdate(status)}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${getColorClasses()}`}
      >
        {children}
      </button>
    );
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
            <div className="flex items-center justify-between">
              <div>
                <h1
                  className={`font-semibold text-gray-900 transition-all duration-300 tracking-tight ${
                    isScrolled ? 'text-xl' : 'text-3xl'
                  }`}
                >
                  {event.title}
                </h1>
                <p
                  className={`text-gray-600 transition-all duration-300 ${
                    isScrolled ? 'text-sm' : 'text-base'
                  }`}
                >
                  Hosted by {event.host?.full_name || 'Your hosts'}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full border font-medium transition-all duration-300 ${
                  isScrolled ? 'text-xs px-3 py-1' : 'text-sm'
                } ${getRSVPStatusColor(guestInfo?.rsvp_status || null)}`}
              >
                                  {getRSVPStatusText(guestInfo?.rsvp_status || null)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Welcome Message */}
            <CardContainer className="bg-gradient-to-r from-rose-50 to-purple-50 border-rose-200/50">
              <div className="text-center space-y-3">
                <SectionTitle>You&apos;re invited to celebrate</SectionTitle>
                <SubTitle className="text-lg leading-relaxed">
                  We&apos;re so excited to share this special moment with you.
                  Your presence would make our day even more magical.
                </SubTitle>
              </div>
            </CardContainer>

            {/* Event Details Card */}
            <CardContainer>
              <div className="space-y-6">
                <SectionTitle>Celebration Details</SectionTitle>

                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-6 h-6 text-rose-500 mt-1 flex-shrink-0">
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
                      <h3 className="font-medium text-gray-800 mb-1">When</h3>
                      <p className="text-gray-600 text-lg">
                        {formatDate(event.event_date)}
                      </p>
                    </div>
                  </div>

                  {event.location && (
                    <div className="flex items-start space-x-4">
                      <div className="w-6 h-6 text-rose-500 mt-1 flex-shrink-0">
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
                        <h3 className="font-medium text-gray-800 mb-1">Where</h3>
                        <p className="text-gray-600 text-lg">{event.location}</p>
                      </div>
                    </div>
                  )}

                  {event.description && (
                    <div className="flex items-start space-x-4">
                      <div className="w-6 h-6 text-rose-500 mt-1 flex-shrink-0">
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
                        <h3 className="font-medium text-gray-800 mb-1">
                          About this celebration
                        </h3>
                        <p className="text-gray-600 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContainer>

            {/* Photo Gallery */}
            <GuestPhotoGallery
              eventId={eventId}
              currentUserId={currentUserId}
            />

            {/* Messaging */}
            <GuestMessaging 
              eventId={eventId} 
              currentUserId={currentUserId} 
              guestId={guestInfo?.id || currentUserId || ''} 
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Card */}
            <CardContainer>
              <div className="space-y-6">
                <div className="space-y-2">
                  <SectionTitle>Will you be joining us?</SectionTitle>
                  <MicroCopy>Let us know if you can celebrate with us</MicroCopy>
                </div>

                <div className="space-y-3">
                  <RSVPButton status="Attending" currentStatus={guestInfo?.rsvp_status || null}>
                    Yes, I&apos;ll be there
                  </RSVPButton>

                  <RSVPButton status="Maybe" currentStatus={guestInfo?.rsvp_status || null}>
                    I&apos;m not sure yet
                  </RSVPButton>

                  <RSVPButton status="Declined" currentStatus={guestInfo?.rsvp_status || null}>
                    I can&apos;t make it
                  </RSVPButton>
                </div>
              </div>
            </CardContainer>

            {/* Quick Actions */}
            <CardContainer>
              <div className="space-y-4">
                <SectionTitle>Connect & Explore</SectionTitle>

                <div className="space-y-3">
                  <SecondaryButton
                    onClick={() => setShowMessageModal(true)}
                    className="w-full bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300"
                  >
                    Send a private note
                  </SecondaryButton>

                  <SecondaryButton className="w-full bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300">
                    View gift registry
                  </SecondaryButton>

                  <SecondaryButton
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full"
                  >
                    View schedule
                  </SecondaryButton>
                </div>
              </div>
            </CardContainer>

            {/* Host Contact */}
            {event.host && (
              <CardContainer>
                <div className="space-y-4">
                  <SectionTitle>Your Hosts</SectionTitle>
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xl shadow-sm">
                      {event.host.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 text-lg">
                        {event.host.full_name || 'Your hosts'}
                      </h3>
                      <MicroCopy>
                        Looking forward to celebrating with you
                      </MicroCopy>
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
