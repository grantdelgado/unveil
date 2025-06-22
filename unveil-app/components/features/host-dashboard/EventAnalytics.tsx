'use client';

import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Database } from '@/app/reference/supabase.types';

import { CardContainer } from '@/components/ui/CardContainer';
import { SectionTitle, MicroCopy } from '@/components/ui/Typography';

type Participant = Database['public']['Tables']['event_participants']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Media = Database['public']['Tables']['media']['Row'];

interface EventAnalyticsProps {
  eventId: string;
}

export function EventAnalytics({ eventId }: EventAnalyticsProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [media, setMedia] = useState<Media[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all analytics data in parallel
        const [participantsResponse, messagesResponse, mediaResponse] =
          await Promise.all([
            supabase
              .from('event_participants')
              .select('*')
              .eq('event_id', eventId),

            supabase
              .from('messages')
              .select('*')
              .eq('event_id', eventId)
              .order('created_at', { ascending: false }),

            supabase
              .from('media')
              .select('*')
              .eq('event_id', eventId)
              .order('created_at', { ascending: false }),
          ]);

        if (participantsResponse.error) throw participantsResponse.error;
        if (messagesResponse.error) throw messagesResponse.error;
        if (mediaResponse.error) throw mediaResponse.error;

        setParticipants(participantsResponse.data || []);
        setMessages(messagesResponse.data || []);
        setMedia(mediaResponse.data || []);
      } catch (err) {
        console.error('Error fetching analytics data:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, [eventId]);

  const analytics = useMemo(() => {

    // RSVP Statistics
    const rsvpStats = {
      total: participants.length,
      attending: participants.filter((p) => p.rsvp_status === 'attending')
        .length,
      declined: participants.filter((p) => p.rsvp_status === 'declined').length,
      maybe: participants.filter((p) => p.rsvp_status === 'maybe').length,
      pending: participants.filter(
        (p) => !p.rsvp_status || p.rsvp_status === 'pending',
      ).length,
    };

    // Engagement Statistics
    const engagementStats = {
      totalMessages: messages.length,
      totalMedia: media.length,
      announcements: messages.filter((m) => m.message_type === 'announcement')
        .length,
      directMessages: messages.filter((m) => m.message_type === 'direct')
        .length,
      images: media.filter((m) => m.media_type === 'image').length,
      videos: media.filter((m) => m.media_type === 'video').length,
    };

    // Recent Activity
    const recentActivity = [
      ...messages.slice(0, 5).map((m) => ({
        type: 'message',
        content: `New ${m.message_type}: ${m.content.substring(0, 50)}...`,
        timestamp: m.created_at,
      })),
      ...media.slice(0, 5).map((m) => ({
        type: 'media',
        content: `New ${m.media_type} uploaded${m.caption ? `: ${m.caption.substring(0, 30)}...` : ''}`,
        timestamp: m.created_at,
      })),
    ]
      .filter((activity) => activity.timestamp)
      .sort(
        (a, b) =>
          new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime(),
      )
      .slice(0, 10);

    return {
      rsvpStats,
      engagementStats,
      recentActivity,
    };
  }, [participants, messages, media]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CardContainer>
          <SectionTitle>Event Analytics</SectionTitle>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        </CardContainer>
      </div>
    );
  }

  if (error) {
    return (
      <CardContainer>
        <h3 className="text-lg font-medium text-gray-700 mb-2">
          Analytics Error
        </h3>
        <p className="text-gray-500">{error}</p>
      </CardContainer>
    );
  }

  const { rsvpStats, engagementStats, recentActivity } = analytics;

  return (
    <div className="space-y-6">
      {/* Guest Statistics */}
      <CardContainer>
        <SectionTitle className="flex items-center mb-6">
          <span className="mr-3">👥</span>
          Guest Analytics
        </SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">
              {rsvpStats.total}
            </div>
            <div className="text-sm text-gray-600">Total Invited</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {rsvpStats.attending}
            </div>
            <div className="text-sm text-gray-600">Attending</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {rsvpStats.maybe}
            </div>
            <div className="text-sm text-gray-600">Maybe</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">
              {rsvpStats.declined}
            </div>
            <div className="text-sm text-gray-600">Declined</div>
          </div>
        </div>

        {/* Response Rate Progress */}
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Response Rate</span>
            <span className="text-sm text-gray-500">
              {Math.round((rsvpStats.attending / rsvpStats.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#FF6B6B] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(rsvpStats.attending / rsvpStats.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{rsvpStats.pending} pending</span>
            <span>{rsvpStats.total - rsvpStats.attending} not attending</span>
          </div>
        </div>
      </CardContainer>

      {/* Activity Statistics */}
      <CardContainer>
        <SectionTitle className="flex items-center mb-6">
          <span className="mr-3">📊</span>
          Activity Overview
        </SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {engagementStats.totalMessages}
            </div>
            <div className="text-sm text-gray-600">Total Messages</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {engagementStats.totalMedia}
            </div>
            <div className="text-sm text-gray-600">Media Uploads</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {engagementStats.announcements}
            </div>
            <div className="text-sm text-gray-600">Announcements</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {engagementStats.images}
            </div>
            <div className="text-sm text-gray-600">Photos Shared</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-800">
              Recent Activity
            </div>
            <MicroCopy>
              Last {Math.min(recentActivity.length, 5)} activities
            </MicroCopy>
          </div>

          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 py-2">
                <div className="text-lg">{activity.type === 'message' ? '💬' : '📸'}</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 truncate">
                    {activity.content}
                  </p>
                                     <p className="text-xs text-gray-500">
                     {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown time'}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContainer>

      {/* Engagement Insights */}
      <CardContainer>
        <SectionTitle className="flex items-center mb-6">
          <span className="mr-3">💡</span>
          Engagement Insights
        </SectionTitle>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Event Highlights
            </h3>
            <p className="text-gray-500">
              Get ready for an amazing celebration! Keep an eye on guest responses and engagement leading up to your event.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Planning Status
              </h3>

              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-700">
                  {Math.round(((rsvpStats.attending / rsvpStats.total) * 100) || 0)}%
                </div>
                <MicroCopy>Response Rate</MicroCopy>
                <div className="text-xs text-gray-600">Expected Attendance</div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Community Engagement
              </h3>

              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-700">
                  {engagementStats.totalMessages + engagementStats.totalMedia}
                </div>
                <MicroCopy>Total Interactions</MicroCopy>
                <div className="text-xs text-gray-600">Messages & Media</div>
              </div>
            </div>
          </div>
        </div>
      </CardContainer>
    </div>
  );
}

