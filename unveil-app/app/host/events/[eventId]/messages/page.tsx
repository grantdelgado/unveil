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
import { Calendar, Send, BarChart3, MessageSquare } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];

interface MessagingHubCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

export default function MessagingHubPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);

  // Fetch event data and scheduled message count
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
            setError('Event not found or you do not have permission to access it.');
          } else {
            setError('Failed to load event data');
          }
          return;
        }

        setEvent(eventData);

        // Get scheduled message count
        const { data: scheduledData, error: scheduledError } = await supabase
          .from('scheduled_messages')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('sender_user_id', user.id)
          .in('status', ['scheduled', 'sending']);

        if (!scheduledError) {
          setScheduledCount(scheduledData?.length || 0);
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

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900';
      case 'green':
        return 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900';
      case 'purple':
        return 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-900';
      case 'orange':
        return 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-900';
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-900';
    }
  };

  const messagingCards: MessagingHubCard[] = [
    {
      title: 'Compose Message',
      description: 'Send immediate or scheduled messages to your guests',
      icon: <Send className="w-6 h-6" />,
      href: `/host/events/${eventId}/messages/compose`,
      color: 'blue',
    },
    {
      title: 'Scheduled Messages',
      description: 'View and manage your upcoming scheduled messages',
      icon: <Calendar className="w-6 h-6" />,
      href: `/host/events/${eventId}/messages/scheduled`,
      badge: scheduledCount,
      color: 'green',
    },
    {
      title: 'Message Analytics',
      description: 'Track delivery rates and guest engagement',
      icon: <BarChart3 className="w-6 h-6" />,
      href: `/host/events/${eventId}/messages/analytics`,
      color: 'purple',
    },
  ];

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-64">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading messaging center...</p>
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
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
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
            href={`/host/events/${eventId}/dashboard`}
            fallback="/select-event"
          >
            Back to Dashboard
          </BackButton>
        </div>

        {/* Header */}
        <CardContainer>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-100 to-rose-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Messaging Center
              </h1>
              <p className="text-gray-600 mb-3">
                Communicate with your guests for <strong>{event?.title}</strong>
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>📅 {event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date TBD'}</span>
                {event?.location && <span>📍 {event.location}</span>}
              </div>
            </div>
          </div>
        </CardContainer>

        {/* Messaging Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {messagingCards.map((card) => (
            <div 
              key={card.title}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
              onClick={() => router.push(card.href)}
            >
              <CardContainer className={`border ${getColorClasses(card.color)} hover:shadow-md`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {card.icon}
                    </div>
                    {card.badge !== undefined && card.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{card.title}</h3>
                  <p className="text-sm opacity-90">{card.description}</p>
                </div>
              </CardContainer>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <CardContainer>
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{scheduledCount}</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">0</div>
                <div className="text-sm text-gray-600">Sent Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">0</div>
                <div className="text-sm text-gray-600">Total Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">-</div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
            </div>
          </div>
        </CardContainer>

        {/* Development Mode Info */}
        <DevModeBox>
          <p><strong>Messaging Hub:</strong> {event?.title} | Event ID: {eventId}</p>
          <p><strong>Phase 1:</strong> Basic routing and navigation complete</p>
        </DevModeBox>
      </div>
    </PageWrapper>
  );
} 