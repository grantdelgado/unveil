'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  EventHeader,
  GuestStatusCard,
  QuickMessageActions,
  TabNavigation,
  GuestManagement,
  EnhancedMessageCenter,
  QuickActions,
  SMSTestPanel,
  type TabItem,
} from '@/components/features/host-dashboard';
import { GuestImportWizard } from '@/components/features/guests';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  PrimaryButton,
  SecondaryButton,
  BackButton,
  DevModeBox,
  SkeletonLoader
} from '@/components/ui';

type Event = Database['public']['Tables']['events']['Row'];

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  // Core state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('guests'); // Default to guests for MVP
  const [showGuestImport, setShowGuestImport] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  // Tab configuration for MVP - only Guests and Messages
  const tabs: TabItem[] = [
    {
      key: 'guests',
      label: 'Participants',
      icon: '👥',
      badge: participantCount > 0 ? undefined : 1, // Show badge if no participants yet
    },
    {
      key: 'messages',
      label: 'Messages',
      icon: '💬',
    },
  ];

  // Fetch event data and participant count
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

        // Get event details
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

        // Get participant count
        const { data: participantData, error: participantError } =
          await supabase
            .from('event_participants')
            .select('id')
            .eq('event_id', eventId);

        if (participantError) {
          console.error('Participant count error:', participantError);
        } else {
          setParticipantCount(participantData?.length || 0);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, router]);

  // Listen for external tab change events (from bottom navigation)
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      if (event.detail?.tab && ['guests', 'messages'].includes(event.detail.tab)) {
        setActiveTab(event.detail.tab);
      }
    };

    ['navigationTabChange', 'dashboardTabChange'].forEach(eventType => {
      window.addEventListener(eventType, handleTabChange as EventListener);
    });

    return () => {
      ['navigationTabChange', 'dashboardTabChange'].forEach(eventType => {
        window.removeEventListener(eventType, handleTabChange as EventListener);
      });
    };
  }, []);

  // Handle tab changes with event dispatch for bottom navigation sync
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    
    // Dispatch event for bottom navigation sync
    window.dispatchEvent(new CustomEvent('dashboardTabChange', { 
      detail: { tab: newTab } 
    }));
  };

  // Handle data refresh after guest management actions
  const handleDataRefresh = async () => {
    const { data: participantData } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', eventId);

    setParticipantCount(participantData?.length || 0);
  };

  // Handle quick message actions
  const handleQuickMessage = (messageType: 'announcement' | 'reminder' | 'custom') => {
    // Switch to messages tab and focus on the appropriate action
    setActiveTab('messages');
    console.log(`Quick message action: ${messageType}`);
    // TODO: Phase 4 will implement specific message templates
  };

  // Loading state with enhanced skeleton
  if (loading) {
    return (
      <PageWrapper centered={false}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Event header skeleton */}
          <CardContainer maxWidth="xl">
            <div className="animate-pulse space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              </div>
            </div>
          </CardContainer>

          {/* Quick stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <CardContainer key={i}>
                <div className="animate-pulse space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContainer>
            ))}
          </div>

          {/* Tab navigation skeleton */}
          <div className="flex gap-2 border-b border-gray-200 pb-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>

          {/* Content skeleton */}
          <SkeletonLoader variant="card" count={2} />
        </div>
      </PageWrapper>
    );
  }

  // Error and not found states
  if (error || !event) {
    return (
      <PageWrapper>
        <CardContainer>
          <div className="text-center space-y-6">
            <div className="text-4xl">{error ? '⚠️' : '🤔'}</div>
            <div className="space-y-2">
              <PageTitle>{error ? 'Unable to Load Event' : 'Event Not Found'}</PageTitle>
              <SubTitle>
                {error || "The event you're looking for doesn't exist or you don't have access to it."}
              </SubTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {error && (
                <PrimaryButton onClick={() => window.location.reload()} fullWidth={false}>
                  Try Again
                </PrimaryButton>
              )}
              <SecondaryButton 
                onClick={() => router.push('/select-event')}
                fullWidth={false}
              >
                Back to Events
              </SecondaryButton>
            </div>
          </div>
        </CardContainer>
      </PageWrapper>
    );
  }

  // Main dashboard layout
  return (
    <PageWrapper centered={false}>
      {/* Guest Import Modal */}
      {showGuestImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <GuestImportWizard
              eventId={eventId}
              onImportComplete={() => {
                setShowGuestImport(false);
                handleDataRefresh();
              }}
              onClose={() => setShowGuestImport(false)}
            />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Navigation */}
        <div className="mb-2">
          <BackButton 
            href="/select-event"
            fallback="/select-event"
          >
            Back to Events
          </BackButton>
        </div>

        {/* Event Header with QuickActions */}
        <EventHeader event={event} participantCount={participantCount}>
          <QuickActions eventId={eventId} />
        </EventHeader>

        {/* Priority Action Cards - Mobile-First Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GuestStatusCard 
            eventId={eventId} 
            onManageClick={() => handleTabChange('guests')} 
          />
          <QuickMessageActions 
            eventId={eventId}
            onSendMessage={handleQuickMessage}
            onComposeClick={() => handleTabChange('messages')}
          />
        </div>

        {/* Main Content with Tab Navigation */}
        <CardContainer maxWidth="xl" className="overflow-hidden">
          <TabNavigation 
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          {/* Tab Content */}
          <div className="py-6">
            {activeTab === 'guests' && (
              <GuestManagement
                eventId={eventId}
                onGuestUpdated={handleDataRefresh}
                onImportGuests={() => setShowGuestImport(true)}
                onSendMessage={handleQuickMessage}
              />
            )}

            {activeTab === 'messages' && (
              <div className="space-y-6">
                <EnhancedMessageCenter eventId={eventId} />
                {/* Development mode SMS testing */}
                {process.env.NODE_ENV === 'development' && (
                  <SMSTestPanel eventId={eventId} />
                )}
              </div>
            )}
          </div>
        </CardContainer>

        {/* Development Mode Info */}
        <DevModeBox>
          <p><strong>Host Dashboard:</strong> {event?.title} | Tab: {activeTab} | Guests: {participantCount}</p>
        </DevModeBox>
      </div>
    </PageWrapper>
  );
}
