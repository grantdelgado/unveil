'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import { useScheduledMessages } from '@/hooks/messaging/useScheduledMessages';
import {
  fromUTCToEventZone,
  getTimezoneInfo,
  isValidTimezone,
} from '@/lib/utils/timezone';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

// Use the direct database types
type Message = Database['public']['Tables']['messages']['Row'];

// Combined message type for unified display
interface UnifiedMessage {
  id: string;
  content: string;
  created_at: string;
  message_type: string;
  type: 'sent' | 'scheduled';
  status?: string;
  send_at?: string;
  sent_at?: string;
  recipient_count?: number;
  success_count?: number;
  failure_count?: number;
}

interface RecentMessagesProps {
  messages: Message[];
  eventId: string;
  isLoading?: boolean;
  className?: string;
}

export function RecentMessages({
  messages,
  eventId,
  isLoading = false,
  className,
}: RecentMessagesProps) {
  // State for timezone toggle
  const [showMyTime, setShowMyTime] = React.useState(false);
  const [eventTimezone, setEventTimezone] = React.useState<string | null>(null);

  // Two-phase loading: track initial boot vs live updates
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = React.useState(false);

  // Fetch scheduled messages
  const {
    scheduledMessages,
    loading: scheduledLoading,
    cancelScheduledMessage,
  } = useScheduledMessages({ eventId });

  // Only show skeleton on initial load, not subsequent updates
  const isBootLoading = (isLoading || scheduledLoading) && !hasInitiallyLoaded;
  const isLiveUpdating = (isLoading || scheduledLoading) && hasInitiallyLoaded;

  // Track when we've completed initial load
  React.useEffect(() => {
    if (!isLoading && !scheduledLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoading, scheduledLoading, hasInitiallyLoaded]);

  // Fetch event timezone
  React.useEffect(() => {
    const fetchEventTimezone = async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('time_zone')
          .eq('id', eventId)
          .single();

        setEventTimezone(data?.time_zone || null);
      } catch (error) {
        console.warn('Failed to fetch event timezone:', error);
      }
    };

    fetchEventTimezone();
  }, [eventId]);

  // Combine and transform messages with stable dependencies
  const unifiedMessages: UnifiedMessage[] = React.useMemo(() => {
    const sentMessages: UnifiedMessage[] = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at || '',
      message_type: msg.message_type || 'direct',
      type: 'sent' as const,
      status: 'sent',
      sent_at: msg.delivered_at || msg.created_at || '',
      recipient_count: (msg.delivered_count || 0) + (msg.failed_count || 0),
      success_count: msg.delivered_count || 0,
      failure_count: msg.failed_count || 0,
    }));

    const scheduledMsgs: UnifiedMessage[] = scheduledMessages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at || '',
      message_type: msg.message_type || 'announcement',
      type: 'scheduled' as const,
      status: msg.status || 'scheduled',
      send_at: msg.send_at,
      sent_at: msg.sent_at || undefined,
      recipient_count: msg.recipient_count || 0,
      success_count: msg.success_count || 0,
      failure_count: msg.failure_count || 0,
    }));

    // Combine and sort: upcoming scheduled first, then by date (newest first)
    const combined = [...sentMessages, ...scheduledMsgs];
    return combined.sort((a, b) => {
      // Upcoming scheduled messages first
      if (a.type === 'scheduled' && a.status === 'scheduled' && a.send_at) {
        const sendTime = new Date(a.send_at);
        if (sendTime > new Date()) {
          if (b.type === 'scheduled' && b.status === 'scheduled' && b.send_at) {
            const bSendTime = new Date(b.send_at);
            if (bSendTime > new Date()) {
              return sendTime.getTime() - bSendTime.getTime(); // Earlier scheduled first
            }
          }
          return -1; // Upcoming scheduled before everything else
        }
      }

      if (b.type === 'scheduled' && b.status === 'scheduled' && b.send_at) {
        const sendTime = new Date(b.send_at);
        if (sendTime > new Date()) {
          return 1; // Upcoming scheduled before everything else
        }
      }

      // For everything else, sort by most recent first
      const aTime = new Date(a.sent_at || a.created_at).getTime();
      const bTime = new Date(b.sent_at || b.created_at).getTime();
      return bTime - aTime;
    });
  }, [messages, scheduledMessages]); // Dependencies are stable arrays from hooks

  // Helper function to get status badge
  const getStatusBadge = (message: UnifiedMessage) => {
    if (message.type === 'sent') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          ✅ Sent
        </span>
      );
    }

    switch (message.status) {
      case 'scheduled':
        const isUpcoming =
          message.send_at && new Date(message.send_at) > new Date();
        return (
          <span
            className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              isUpcoming
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700',
            )}
          >
            ⏰ {isUpcoming ? 'Scheduled' : 'Past Due'}
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            🔄 Sending
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            ✅ Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            ⚠️ Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            🚫 Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  // Helper function to format display time with timezone awareness
  const getDisplayTime = (message: UnifiedMessage) => {
    if (message.type === 'sent') {
      return formatMessageTimestamp(message.sent_at || message.created_at);
    }

    if (message.status === 'scheduled' && message.send_at) {
      const sendTime = new Date(message.send_at);
      const now = new Date();

      // Format time based on timezone preference
      let timeDisplay: string;
      if (eventTimezone && isValidTimezone(eventTimezone) && !showMyTime) {
        // Show event timezone
        const eventTime = fromUTCToEventZone(message.send_at, eventTimezone);
        if (eventTime) {
          const tzInfo = getTimezoneInfo(eventTimezone);
          timeDisplay = `${eventTime.formatted} ${tzInfo?.abbreviation || ''}`;
        } else {
          timeDisplay = formatMessageTimestamp(message.send_at);
        }
      } else {
        // Show user's local time
        timeDisplay = formatMessageTimestamp(message.send_at);
      }

      if (sendTime > now) {
        return `Scheduled for ${timeDisplay}`;
      } else {
        return `Was scheduled for ${timeDisplay}`;
      }
    }

    if (message.sent_at) {
      return `Sent ${formatMessageTimestamp(message.sent_at)}`;
    }

    return formatMessageTimestamp(message.created_at);
  };

  // Handle cancel scheduled message
  const handleCancelScheduled = async (messageId: string) => {
    if (confirm('Are you sure you want to cancel this scheduled message?')) {
      await cancelScheduledMessage(messageId);
    }
  };

  if (isBootLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-100 rounded-lg p-4 h-20"
          />
        ))}
      </div>
    );
  }

  if (unifiedMessages.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="text-gray-500">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-sm">No messages sent yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Use the compose tab to send your first message to guests
          </p>
        </div>
      </div>
    );
  }

  // Separate upcoming and past messages
  const upcomingMessages = unifiedMessages.filter(
    (msg) =>
      msg.type === 'scheduled' &&
      msg.status === 'scheduled' &&
      msg.send_at &&
      new Date(msg.send_at) > new Date(),
  );
  const pastMessages = unifiedMessages.filter(
    (msg) =>
      !(
        msg.type === 'scheduled' &&
        msg.status === 'scheduled' &&
        msg.send_at &&
        new Date(msg.send_at) > new Date()
      ),
  );

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Message History ({unifiedMessages.length})
          {isLiveUpdating && (
            <span className="ml-2 text-xs text-blue-600 animate-pulse">
              Updating...
            </span>
          )}
        </h3>

        {/* Timezone Toggle for Scheduled Messages */}
        {eventTimezone && upcomingMessages.length > 0 && (
          <button
            onClick={() => setShowMyTime(!showMyTime)}
            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showMyTime ? '🌍 Show Event Time' : '🏠 Show My Time'}
          </button>
        )}
      </div>

      {/* Upcoming Scheduled Messages */}
      {upcomingMessages.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">
            Upcoming ({upcomingMessages.length})
          </h4>
          <div className="space-y-3">
            {upcomingMessages.map((message) => (
              <div
                key={message.id}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 mb-2">
                      {message.content}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                      <span>{getDisplayTime(message)}</span>
                      {getStatusBadge(message)}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {message.message_type}
                      </span>
                      {message.recipient_count &&
                        message.recipient_count > 0 && (
                          <span className="text-gray-500">
                            {message.recipient_count}{' '}
                            {message.recipient_count === 1
                              ? 'person'
                              : 'people'}
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Cancel button for scheduled messages */}
                  {message.type === 'scheduled' &&
                    message.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancelScheduled(message.id)}
                        className="ml-2 text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-300 rounded hover:bg-red-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Messages (Sent + Past Scheduled) */}
      {pastMessages.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">
            {upcomingMessages.length > 0 ? 'Past Messages' : 'All Messages'} (
            {pastMessages.length})
          </h4>
          <div className="space-y-3">
            {pastMessages.map((message) => (
              <div
                key={message.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 mb-2">
                      {message.content}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{getDisplayTime(message)}</span>
                      {getStatusBadge(message)}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {message.message_type}
                      </span>

                      {/* Delivery stats */}
                      {message.success_count || message.failure_count ? (
                        <span className="text-gray-500">
                          {message.success_count || 0} delivered
                          {message.failure_count &&
                            message.failure_count > 0 && (
                              <span className="text-red-600 ml-1">
                                • {message.failure_count} failed
                              </span>
                            )}
                        </span>
                      ) : (
                        message.recipient_count &&
                        message.recipient_count > 0 && (
                          <span className="text-gray-500">
                            {message.recipient_count}{' '}
                            {message.recipient_count === 1
                              ? 'person'
                              : 'people'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
