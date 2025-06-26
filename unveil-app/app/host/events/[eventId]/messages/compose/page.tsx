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
import { EnhancedMessageCenter, MessageScheduler } from '@/components/features/messaging/host';
import { cn } from '@/lib/utils';
import { Send, Calendar, MessageSquare } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];
type EventGuest = Database['public']['Tables']['event_guests']['Row'];

type MessageMode = 'immediate' | 'scheduled';

export default function ComposeMessagePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MessageMode>('immediate');

  // Fetch event and guest data for scheduling
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

        // Get guest data for scheduling
        const { data: guestsData, error: guestsError } = await supabase
          .from('event_guests')
          .select('*')
          .eq('event_id', eventId)
          .order('guest_name', { ascending: true });

        if (guestsError) {
          console.error('Guests fetch error:', guestsError);
          // Don't fail if guests can't be loaded, just use empty array
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
    // Navigate to scheduled messages page after successful scheduling
    router.push(`/host/events/${eventId}/messages/scheduled`);
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-64">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading compose interface...</p>
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
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Compose Message
                </h1>
                <p className="text-gray-600 mb-3">
                  Send immediate or scheduled messages for <strong>{event?.title}</strong>
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>📅 {event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date TBD'}</span>
                  {event?.location && <span>📍 {event.location}</span>}
                  <span>👥 {guests.length} guests</span>
                </div>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setMode('immediate')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  mode === 'immediate'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <Send className="w-4 h-4" />
                Send Now
              </button>
              <button
                onClick={() => setMode('scheduled')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  mode === 'scheduled'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
            </div>
          </div>
        </CardContainer>

        {/* Compose Interface */}
        <CardContainer>
          {mode === 'immediate' ? (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Send Immediate Message</h2>
                <p className="text-sm text-gray-600">
                  Your message will be sent immediately to the selected recipients.
                </p>
              </div>
              <EnhancedMessageCenter eventId={eventId} />
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Schedule Message</h2>
                <p className="text-sm text-gray-600">
                  Set a specific date and time for your message to be sent automatically.
                </p>
              </div>
              <MessageScheduler
                eventId={eventId}
                guests={guests}
                onScheduleSuccess={handleScheduleSuccess}
              />
            </div>
          )}
        </CardContainer>

        {/* Development Mode Info */}
        <DevModeBox>
          <div className="space-y-2">
            <p><strong>Event ID:</strong> {eventId}</p>
            <p><strong>Mode:</strong> {mode}</p>
            <p><strong>Guests Available:</strong> {guests.length}</p>
            <p><strong>Available Tags:</strong> {
              Array.from(new Set(guests.flatMap(g => g.guest_tags || []))).join(', ') || 'None'
            }</p>
            <p><strong>Phase 2.3:</strong> Immediate and scheduled messaging interface complete</p>
          </div>
        </DevModeBox>
      </div>
    </PageWrapper>
  );
} 