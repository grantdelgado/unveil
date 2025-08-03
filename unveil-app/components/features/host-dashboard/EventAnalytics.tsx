'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Database } from '@/app/reference/supabase.types';

import { CardContainer } from '@/components/ui/CardContainer';
import { SectionTitle, MicroCopy } from '@/components/ui/Typography';

type Guest = Database['public']['Tables']['event_guests']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Media = Database['public']['Tables']['media']['Row'];

interface ActivityItem {
  type: 'message' | 'media';
  content: string;
  timestamp: string | null;
}

interface EventAnalyticsProps {
  eventId: string;
}

function EventAnalyticsComponent({ eventId }: EventAnalyticsProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [media, setMedia] = useState<Media[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all analytics data in parallel
      const [guestsResponse, messagesResponse, mediaResponse] =
        await Promise.all([
          supabase
            .from('event_guests')
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

      if (guestsResponse.error) throw guestsResponse.error;
      if (messagesResponse.error) throw messagesResponse.error;
      if (mediaResponse.error) throw mediaResponse.error;

      setGuests(guestsResponse.data || []);
      setMessages(messagesResponse.data || []);
      setMedia(mediaResponse.data || []);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Asynchronous analytics calculations to prevent blocking main thread
  const [analytics, setAnalytics] = useState<{
    rsvpStats: { total: number; attending: number; declined: number; maybe: number; pending: number };
    engagementStats: { 
      totalMessages: number; 
      totalMedia: number;
      announcements: number; 
      directMessages: number;
      images: number;
      videos: number;
    };
    recentActivity: ActivityItem[];
  }>({
    rsvpStats: { total: 0, attending: 0, declined: 0, maybe: 0, pending: 0 },
    engagementStats: { 
      totalMessages: 0, 
      totalMedia: 0,
      announcements: 0, 
      directMessages: 0,
      images: 0,
      videos: 0,
    },
    recentActivity: [],
  });

  // Break down heavy calculations into smaller, async chunks
  useEffect(() => {
    const calculateAnalytics = async () => {
      // Use setTimeout to break computation into chunks
      const rsvpStats = await new Promise<typeof analytics.rsvpStats>((resolve) => {
        setTimeout(() => {
          const stats = guests.reduce(
            (acc, guest) => {
              const status = guest.rsvp_status || 'pending';
              acc.total++;
              acc[status as keyof typeof acc] = (acc[status as keyof typeof acc] || 0) + 1;
              return acc;
            },
            { total: 0, attending: 0, declined: 0, maybe: 0, pending: 0 }
          );
          resolve(stats);
        }, 0);
      });

      const engagementStats = await new Promise<typeof analytics.engagementStats>((resolve) => {
        setTimeout(() => {
          // Pre-filter media to avoid multiple filters
          const imageCount = media.filter(m => m.media_type === 'image').length;
          const videoCount = media.filter(m => m.media_type === 'video').length;
          
          const messageStats = messages.reduce(
            (acc, message) => {
              acc.totalMessages++;
              if (message.message_type === 'announcement') acc.announcements++;
              if (message.message_type === 'direct') acc.directMessages++;
              return acc;
            },
            { 
              totalMessages: 0, 
              totalMedia: media.length,
              announcements: 0, 
              directMessages: 0,
              images: imageCount,
              videos: videoCount,
            }
          );
          resolve(messageStats);
        }, 0);
      });

      const recentActivity = await new Promise<ActivityItem[]>((resolve) => {
        setTimeout(() => {
          const activity = [
            ...messages.slice(0, 5).map((m) => ({
              type: 'message' as const,
              content: `New ${m.message_type}: ${m.content?.substring(0, 50) || ''}...`,
              timestamp: m.created_at,
            })),
            ...media.slice(0, 5).map((m) => ({
              type: 'media' as const,
              content: `New ${m.media_type} uploaded${m.caption ? `: ${m.caption.substring(0, 30)}...` : ''}`,
              timestamp: m.created_at,
            })),
          ]
            .filter((activity) => activity.timestamp)
            .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
            .slice(0, 10);
          resolve(activity);
        }, 0);
      });

      setAnalytics({
        rsvpStats,
        engagementStats,
        recentActivity,
      });
    };

    if (guests.length > 0 || messages.length > 0 || media.length > 0) {
      calculateAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, messages, media]); // Removed analytics to prevent infinite loop

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

// Memoize the component to prevent unnecessary re-renders
export const EventAnalytics = memo(EventAnalyticsComponent);

