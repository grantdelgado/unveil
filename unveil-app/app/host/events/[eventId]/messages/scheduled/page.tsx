'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import {
  PageWrapper,
  CardContainer,
  BackButton,
  LoadingSpinner,
  DevModeBox,
} from '@/components/ui';
import { MessageScheduler, MessageQueue } from '@/components/features/messaging/host';
import { useScheduledMessageCounts } from '@/hooks/messaging';
import { Calendar, Clock } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type EventGuest = Database['public']['Tables']['event_guests']['Row'];
type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

export default function ScheduledMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [, setEditingMessage] = useState<ScheduledMessage | null>(null);

  const scheduledCounts = useScheduledMessageCounts(eventId);

  // Fetch event and guest data
  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
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
            setError('Event not found or you do not have permission to access it.');
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        setEvent(eventData);

        // Get guest data for targeting
        const { data: guestsData, error: guestsError } = await supabase
          .from('event_guests')
          .select('*')
          .eq('event_id', eventId)
          .order('guest_name', { ascending: true });

        if (guestsError) {
          console.error('Guests fetch error:', guestsError);
          // Don't fail completely if guests can't be loaded
          setGuests([]);
        } else {
          setGuests(guestsData || []);
        }

      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, router]);

  const handleScheduleSuccess = () => {
    setShowScheduler(false);
    setEditingMessage(null);
  };

  const handleEditMessage = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setShowScheduler(true);
  };

  const handleCancelScheduler = () => {
    setShowScheduler(false);
    setEditingMessage(null);
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-64">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading scheduled messages...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
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
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="mb-2">
          <BackButton 
            href={`/host/events/${eventId}/messages`}
            fallback={`/host/events/${eventId}/dashboard`}
          >
            Back to Messages
          </BackButton>
        </div>

        {/* Header */}
        <CardContainer>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Scheduled Messages
                </h1>
                <p className="text-gray-600 mb-3">
                  Manage scheduled messages for <strong>{event?.title}</strong>
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>📅 {event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date TBD'}</span>
                  {event?.location && <span>📍 {event.location}</span>}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {scheduledCounts.total}
              </div>
              <div className="text-sm text-gray-600">
                Total Messages
              </div>
              {scheduledCounts.scheduled > 0 && (
                <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{scheduledCounts.scheduled} pending</span>
                </div>
              )}
            </div>
          </div>
        </CardContainer>

        {/* Main Content */}
        {showScheduler ? (
          <CardContainer>
            <MessageScheduler
              eventId={eventId}
              guests={guests}
              onScheduleSuccess={handleScheduleSuccess}
              onCancel={handleCancelScheduler}
            />
          </CardContainer>
        ) : (
          <MessageQueue
            eventId={eventId}
            onEdit={handleEditMessage}
            onScheduleNew={() => setShowScheduler(true)}
          />
        )}

        {/* Development Mode Info */}
        <DevModeBox>
          <div className="space-y-2">
            <p><strong>Event ID:</strong> {eventId}</p>
            <p><strong>Guests Loaded:</strong> {guests.length}</p>
            <p><strong>Available Tags:</strong> {
              Array.from(new Set(guests.flatMap(g => g.guest_tags || []))).join(', ') || 'None'
            }</p>
            <p><strong>Scheduled Messages:</strong> {scheduledCounts.total}</p>
            <div className="text-xs grid grid-cols-3 gap-2 mt-2">
              <span>📅 Scheduled: {scheduledCounts.scheduled}</span>
              <span>✅ Sent: {scheduledCounts.sent}</span>
              <span>❌ Failed: {scheduledCounts.failed}</span>
            </div>
          </div>
        </DevModeBox>
      </div>
    </PageWrapper>
  );
} 