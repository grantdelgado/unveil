'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CardContainer,
  SectionTitle,
  SecondaryButton,
  MicroCopy,
  LoadingSpinner,
} from '@/components/ui';

interface QuickActionsProps {
  eventId: string;
}

export function QuickActions({ eventId }: QuickActionsProps) {
  const [stats, setStats] = useState({
    totalGuests: 0,
    pendingRSVPs: 0,
    recentMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuickStats() {
      try {
        // Get guest stats (RSVP-Lite: use declined_at instead of rsvp_status)
        const { data: guestData } = await supabase
          .from('event_guests')
          .select('declined_at')
          .eq('event_id', eventId)
          .is('removed_at', null);

        // Get recent message count
        const { data: messageData } = await supabase
          .from('messages')
          .select('id')
          .eq('event_id', eventId)
          .gte(
            'created_at',
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          );

        const totalGuests = guestData?.length || 0;
        // RSVP-Lite: pending = not declined (declined_at is null)
        const pendingRSVPs =
          guestData?.filter((p) => !p.declined_at).length || 0;
        const recentMessages = messageData?.length || 0;

        setStats({
          totalGuests,
          pendingRSVPs,
          recentMessages,
        });
      } catch (error) {
        console.error('Error fetching quick stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchQuickStats();
  }, [eventId]);

  // Removed handleSendReminder - messaging consolidated to Messages tab

  if (loading) {
    return (
      <CardContainer>
        <LoadingSpinner />
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      <div className="space-y-6">
        <SectionTitle className="flex items-center">
          <span className="text-xl mr-2">⚡</span>
          Quick Actions
        </SectionTitle>

        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-700">
                {stats.totalGuests}
              </div>
              <MicroCopy>Guests</MicroCopy>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-xl font-bold text-amber-700">
                {stats.pendingRSVPs}
              </div>
              <MicroCopy>Pending</MicroCopy>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-700">
                {stats.recentMessages}
              </div>
              <MicroCopy>Messages</MicroCopy>
            </div>
          </div>

          {/* Essential Actions Only */}
          <div className="space-y-2">
            <SecondaryButton
              className="w-full"
              onClick={() => window.open(`/host/events/${eventId}`, '_blank')}
            >
              👁️ Preview Guest View
            </SecondaryButton>

            {stats.pendingRSVPs > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm text-amber-700 font-medium mb-1">
                  📧 {stats.pendingRSVPs} Pending RSVPs
                </div>
                <div className="text-xs text-amber-600">
                  Send reminders from the Messages tab
                </div>
              </div>
            )}
          </div>

          {stats.totalGuests === 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-sm text-purple-700 font-medium mb-1">
                🚀 Get Started
              </div>
              <MicroCopy className="text-purple-600">
                Import your guest list to begin sending invitations
              </MicroCopy>
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
}
