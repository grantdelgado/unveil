'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  groupMessagesByDateWithTimezone, 
  formatMessageDateHeaderWithTimezone 
} from '@/lib/utils/date';
import { useScheduledMessages } from '@/hooks/messaging/useScheduledMessages';
import {
  fromUTCToEventZone,
  getTimezoneInfo,
  formatScheduledDateTime,
} from '@/lib/utils/timezone';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
// cancelScheduledMessage imported via useScheduledMessages hook
import { CancelMessageDialog } from '@/components/ui/CancelMessageDialog';
import { logger } from '@/lib/logger';

// Use the direct database types
type Message = Database['public']['Tables']['messages']['Row'];
type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

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
  modification_count?: number;
  scheduled_message_id?: string | null; // For linking sent messages to their originating schedule
}

// Props for individual message row component
interface MessageRowProps {
  message: UnifiedMessage;
  showMyTime: boolean;
  eventTimezone: string | null;
}

// Props for upcoming message card
interface UpcomingMessageCardProps {
  message: UnifiedMessage;
  showMyTime: boolean;
  eventTimezone: string | null;
  onCancel: () => void;
  onModify?: () => void;
}

interface RecentMessagesProps {
  messages: Message[];
  scheduledMessages?: ScheduledMessage[];
  eventId: string;
  isLoading?: boolean;
  className?: string;
  onModifyMessage?: (message: ScheduledMessage) => void;
}

/**
 * Upcoming message card component with enhanced scheduling info
 */
function UpcomingMessageCard({ message, showMyTime, eventTimezone, onCancel, onModify }: UpcomingMessageCardProps) {
  // Format scheduled time with timezone info
  const getScheduledTimeDisplay = () => {
    if (!message.send_at) return '';

    if (eventTimezone && !showMyTime) {
      // Use the formatScheduledDateTime utility for full context
      return formatScheduledDateTime(message.send_at, eventTimezone) || 
        `Scheduled for ${new Date(message.send_at).toLocaleString()}`;
    } else {
      // Show in user's local time
      const date = new Date(message.send_at);
      return `Scheduled for ${date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      })} at ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          {/* Message content */}
          <p className="text-sm text-gray-900 mb-3 line-clamp-2">
            {message.content}
          </p>

          {/* Scheduling info */}
          <div className="text-sm text-blue-700 font-medium mb-2">
            {getScheduledTimeDisplay()}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              ⏰ Scheduled
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {message.message_type}
            </span>
            {message.modification_count && message.modification_count > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                ✏️ Modified {message.modification_count}x
              </span>
            )}
            {message.recipient_count && message.recipient_count > 0 && (
              <span className="text-gray-600">
                {message.recipient_count} {message.recipient_count === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onModify && (
            <button
              onClick={onModify}
              className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
            >
              Modify
            </button>
          )}
          <button
            onClick={onCancel}
            className="text-xs text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual message row component with cleaned up layout
 */
function MessageRow({ message, showMyTime, eventTimezone }: MessageRowProps) {
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

  // Helper function to get display time (just time, not full timestamp)
  const getDisplayTime = (message: UnifiedMessage) => {
    const timestamp = message.sent_at || message.created_at;
    if (!timestamp) return '';

    const messageDate = new Date(timestamp);
    
    if (eventTimezone && !showMyTime) {
      // Show event timezone time
      const eventTime = fromUTCToEventZone(timestamp, eventTimezone);
      return eventTime?.formatted || messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      } else {
        // Show user's local time
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  // Helper function to format delivery summary
  const getDeliveryLabel = (message: UnifiedMessage) => {
    // For sent messages (from messages table): show actual delivery counts
    if (message.type === 'sent') {
      const successCount = message.success_count || 0;
      const failureCount = message.failure_count || 0;
      const totalRecipients = message.recipient_count || 0;

      // Don't show anything if no delivery info available
      if (successCount === 0 && failureCount === 0 && totalRecipients === 0) {
        return null;
      }

      // Show delivered/failed counts for sent messages
      if (successCount > 0 || failureCount > 0) {
        const parts = [];
        
        if (successCount > 0) {
          // Show "X/Y delivered" if we have total, otherwise "X delivered"
          if (totalRecipients > 0 && totalRecipients !== successCount) {
            parts.push(`${successCount}/${totalRecipients} delivered`);
        } else {
            parts.push(`${successCount} delivered`);
          }
        }
        
        if (failureCount > 0) {
          parts.push(`${failureCount} failed`);
        }
        
        return (
          <span className="text-gray-500">
            {parts.join(' • ')}
          </span>
        );
      }

      // Fallback for sent messages without delivery stats
      if (totalRecipients > 0) {
        return (
          <span className="text-gray-500">
            {totalRecipients} {totalRecipients === 1 ? 'recipient' : 'recipients'}
          </span>
        );
      }
    }

    // For scheduled messages: show intended audience size (not delivery counts)
    if (message.type === 'scheduled') {
      const recipientCount = message.recipient_count || 0;
      
      if (recipientCount > 0) {
        return (
          <span className="text-gray-500">
            {recipientCount} {recipientCount === 1 ? 'person' : 'people'}
          </span>
        );
      }
    }

    return null;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors min-h-[44px]">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          {/* Message content */}
          <p className="text-sm text-gray-900 mb-2 line-clamp-2">
            {message.content}
          </p>

          {/* Status and metadata row */}
          <div className="flex items-center gap-3 text-xs">
            {/* Left side: Status, Type, Delivery */}
            <div className="flex items-center gap-2">
              {getStatusBadge(message)}
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {message.message_type}
              </span>
              {getDeliveryLabel(message)}
            </div>
          </div>
        </div>

        {/* Right side: Time */}
        <div className="text-xs text-gray-500 text-right flex-shrink-0">
          {getDisplayTime(message)}
        </div>
      </div>
    </div>
  );
}

export function RecentMessages({
  messages,
  scheduledMessages: propScheduledMessages,
  eventId,
  isLoading = false,
  className,
  onModifyMessage,
}: RecentMessagesProps) {
  // State for timezone toggle
  const [showMyTime, setShowMyTime] = React.useState(false);
  const [eventTimezone, setEventTimezone] = React.useState<string | null>(null);
  
  // State for cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [messageToCancel, setMessageToCancel] = React.useState<ScheduledMessage | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  // Two-phase loading: track initial boot vs live updates
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = React.useState(false);
  
  // Debounced updating indicator to prevent flicker
  const [showUpdating, setShowUpdating] = React.useState(false);

  // Fetch scheduled messages - Hotfix: use prop if available, otherwise fetch
  const {
    scheduledMessages: hookScheduledMessages,
    loading: scheduledLoading,
    cancelScheduledMessage,
  } = useScheduledMessages({ 
    eventId,
    autoRefresh: false, // Hotfix: disable auto-refresh, rely on realtime
    realTimeUpdates: !propScheduledMessages // Disable if we have props
  });


  
  // Use prop scheduled messages if available, otherwise use hook
  const scheduledMessages = propScheduledMessages || hookScheduledMessages;
  const effectiveScheduledLoading = propScheduledMessages ? false : scheduledLoading;

  // Only show skeleton on initial load, not subsequent updates
  const isBootLoading = (isLoading || effectiveScheduledLoading) && !hasInitiallyLoaded;
  const isLiveUpdating = (isLoading || effectiveScheduledLoading) && hasInitiallyLoaded;
  
  // Debounce the updating indicator to prevent flicker
  React.useEffect(() => {
    if (isLiveUpdating) {
      // Show updating indicator after 500ms delay to avoid flicker on quick updates
      const timer = setTimeout(() => {
        setShowUpdating(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Hide immediately when not updating
      setShowUpdating(false);
    }
  }, [isLiveUpdating]);

  // Track when we've completed initial load
  React.useEffect(() => {
    if (!isLoading && !effectiveScheduledLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [isLoading, effectiveScheduledLoading, hasInitiallyLoaded]);

  // Hotfix: Dev observability - log query states (remove after verification)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MessageHistory] Query states:', {
        eventId,
        messagesCount: messages?.length || 0,
        scheduledCount: scheduledMessages?.length || 0,
        isLoading,
        scheduledLoading,
        hasInitiallyLoaded,
        isBootLoading,
        isLiveUpdating
      });
    }
  }, [eventId, messages?.length, scheduledMessages?.length, isLoading, scheduledLoading, effectiveScheduledLoading, hasInitiallyLoaded, isBootLoading, isLiveUpdating]);

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
    // Hotfix: Add safety checks and logging
    console.log('[RecentMessages] Processing messages:', {
      messages: messages?.length || 0,
      scheduledMessages: scheduledMessages?.length || 0,
      scheduledSource: propScheduledMessages ? 'props' : 'hook',
      messagesArray: messages,
      scheduledArray: scheduledMessages
    });

    const sentMessages: UnifiedMessage[] = (messages || []).map((msg) => ({
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
      scheduled_message_id: msg.scheduled_message_id, // Track linkage for deduplication
    }));

    // Deduplication: Exclude sent scheduled messages when corresponding message exists
    const scheduledMsgs: UnifiedMessage[] = (scheduledMessages || [])
      .filter((msg) => {
        // If this scheduled message was sent, check if we have the corresponding message
        if (msg.status === 'sent') {
          const hasCorrespondingMessage = sentMessages.some(
            (sentMsg) => sentMsg.scheduled_message_id === msg.id
          );
          // Exclude sent scheduled messages that have corresponding message entries
          return !hasCorrespondingMessage;
        }
        // Keep all non-sent scheduled messages (scheduled, cancelled, failed, etc.)
        return true;
      })
      .map((msg) => ({
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

    // Observability: Log merge statistics (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      const originalScheduledCount = scheduledMessages?.length || 0;
      const dedupedCount = originalScheduledCount - scheduledMsgs.length;
      console.log('[MessageHistory] Merge statistics:', {
        scheduledShown: scheduledMsgs.length,
        messagesShown: sentMessages.length,
        deduped: dedupedCount,
        originalScheduled: originalScheduledCount
      });
    }

    // Combine and sort: upcoming scheduled first, then by date (newest first)
    const combined = [...sentMessages, ...scheduledMsgs];
    const sorted = combined.sort((a, b) => {
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
    
    console.log('[RecentMessages] Final unified messages:', {
      totalCount: sorted.length,
      sentCount: sentMessages.length,
      scheduledCount: scheduledMsgs.length,
      messages: sorted
    });
    
    return sorted;
  }, [messages, scheduledMessages, propScheduledMessages]); // Dependencies are stable arrays from hooks



  // Handle cancel scheduled message - enhanced with dialog
  const handleCancelScheduled = (messageId: string) => {
    const message = scheduledMessages.find(m => m.id === messageId);
    if (message) {
      // Log cancel request (PII-safe)
      const now = new Date();
      const sendTime = new Date(message.send_at);
      const sendAtDeltaSeconds = Math.floor((sendTime.getTime() - now.getTime()) / 1000);
      
      logger.sms('Schedule cancel requested', {
        event_id: eventId,
        scheduled_id: messageId,
        status_before: message.status,
        send_at_delta_seconds: sendAtDeltaSeconds,
        content_length: message.content.length,
      });

      setMessageToCancel(message);
      setCancelDialogOpen(true);
      setCancelError(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!messageToCancel) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelScheduledMessage(messageToCancel.id);
      
      if (!result.success) {
        const errorMsg = typeof result.error === 'object' && result.error && 'message' in result.error 
          ? (result.error as { message: string }).message 
          : 'Failed to cancel message';
        setCancelError(errorMsg);
        return;
      }

      // Log successful cancel (PII-safe)
      logger.sms('Schedule cancel succeeded', {
        event_id: eventId,
        scheduled_id: messageToCancel.id,
        status_after: 'cancelled',
      });

      // Success - close dialog
      setCancelDialogOpen(false);
      setMessageToCancel(null);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Network error occurred');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCloseCancelDialog = () => {
    if (!isCancelling) {
      setCancelDialogOpen(false);
      setMessageToCancel(null);
      setCancelError(null);
    }
  };

  // One-time rollout telemetry for always-on modify feature
  React.useEffect(() => {
    // Log once per session that modify is always-on (no PII)
    const hasLoggedRollout = sessionStorage.getItem('modify_always_on_logged');
    if (!hasLoggedRollout && scheduledMessages.length > 0) {
      logger.sms('Feature rollout: modify always on', {
        event_id: eventId,
        feature: 'modify_scheduled',
        always_on: true,
        flag_removed: true,
      });
      sessionStorage.setItem('modify_always_on_logged', 'true');
    }
  }, [eventId, scheduledMessages.length]);

  // Handle modify scheduled message
  const handleModifyScheduled = (messageId: string) => {
    const message = scheduledMessages.find(m => m.id === messageId);
    if (message && onModifyMessage) {
      // Log modify request (PII-safe)
      const now = new Date();
      const sendTime = new Date(message.send_at);
      const sendAtDeltaSeconds = Math.floor((sendTime.getTime() - now.getTime()) / 1000);
      
      logger.sms('Schedule modify requested', {
        event_id: eventId,
        scheduled_id: messageId,
        status_before: message.status,
        send_at_delta_seconds: sendAtDeltaSeconds,
        content_length: message.content.length,
        modification_count: (message as ScheduledMessage & { modification_count?: number }).modification_count || 0,
      });

      onModifyMessage(message);
    }
  };

  // Check if message can be modified (not too close to send time)
  const canModifyMessage = (message: ScheduledMessage): boolean => {
    const now = new Date();
    const sendTime = new Date(message.send_at);
    const minLeadMs = 180 * 1000; // 3 minutes minimum lead time
    const freezeWindowMs = 60 * 1000; // 1 minute freeze window
    
    return (
      message.status === 'scheduled' &&
      sendTime > new Date(now.getTime() + minLeadMs + freezeWindowMs)
    );
  };

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

  // Group past messages by date with timezone awareness (before early returns)
  const groupedPastMessages = React.useMemo(() => {
    return groupMessagesByDateWithTimezone(pastMessages, showMyTime, eventTimezone);
  }, [pastMessages, showMyTime, eventTimezone]);

  // Sort date groups (newest first) (before early returns)
  const sortedDateGroups = React.useMemo(() => {
    return Object.keys(groupedPastMessages).sort((a, b) => {
      // Sort by ISO date strings (YYYY-MM-DD) in descending order
      return b.localeCompare(a);
    });
  }, [groupedPastMessages]);

  // Early returns must come AFTER all hooks
  if (isBootLoading) {
    console.log('[RecentMessages] Showing loading state:', {
      isBootLoading,
      isLoading,
      scheduledLoading,
      effectiveScheduledLoading,
      hasInitiallyLoaded,
      hasPropScheduledMessages: !!propScheduledMessages
    });
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
    console.log('[RecentMessages] Showing empty state:', {
      unifiedMessagesLength: unifiedMessages.length,
      messagesLength: messages?.length || 0,
      scheduledMessagesLength: scheduledMessages?.length || 0,
      isBootLoading,
      isLiveUpdating
    });
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="text-gray-500">
          <div className="text-5xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
          <p className="text-sm text-gray-600 mb-4">
            Send your first message to guests using the compose tab
          </p>
          <div className="text-xs text-gray-400">
            Messages and scheduled announcements will appear here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Message History ({unifiedMessages.length})
          {showUpdating && (
            <span className="ml-2 text-xs text-blue-600 animate-pulse">
              Updating...
            </span>
          )}
        </h3>

        {/* Timezone Toggle - Show when we have any messages with times */}
        {eventTimezone && (upcomingMessages.length > 0 || pastMessages.length > 0) && (
          <div className="text-right">
          <button
            onClick={() => setShowMyTime(!showMyTime)}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-1"
          >
            {showMyTime ? '🌍 Show Event Time' : '🏠 Show My Time'}
          </button>
            <div className="text-xs text-gray-500">
              Times shown in <strong>{showMyTime ? 'Your time' : 'Event time'}</strong>
              {!showMyTime && eventTimezone && (
                <span className="ml-1">({getTimezoneInfo(eventTimezone)?.abbreviation || eventTimezone})</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Scheduled Messages */}
      {upcomingMessages.length > 0 ? (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">
            Upcoming ({upcomingMessages.length})
          </h4>
          <div className="space-y-3">
            {upcomingMessages.map((message) => (
              <UpcomingMessageCard 
                key={message.id}
                message={message} 
                showMyTime={showMyTime} 
                eventTimezone={eventTimezone}
                onCancel={() => handleCancelScheduled(message.id)}
                onModify={
                  message.type === 'scheduled' && canModifyMessage(message as unknown as ScheduledMessage)
                    ? () => handleModifyScheduled(message.id)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ) : (
        pastMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <div className="text-4xl mb-2">⏰</div>
              <p className="text-sm">No upcoming messages</p>
              <p className="text-xs text-gray-400 mt-1">
                Schedule messages from the compose tab
              </p>
            </div>
          </div>
        )
      )}

      {/* Past Messages (Sent + Past Scheduled) - Grouped by Date */}
      {pastMessages.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-4">
            {upcomingMessages.length > 0 ? 'Past Messages' : 'All Messages'} (
            {pastMessages.length})
          </h4>
          
          {/* Date-Grouped Message List */}
          {sortedDateGroups.length > 0 ? (
            <div className="space-y-6">
              {sortedDateGroups.map((dateKey) => {
                const messagesInGroup = groupedPastMessages[dateKey];
                const dateHeader = formatMessageDateHeaderWithTimezone(dateKey, showMyTime, eventTimezone);
                
                return (
                  <div key={dateKey}>
                    {/* Date Header */}
                    <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 pb-2 mb-3 z-10">
                      <h5 
                        className="text-sm font-medium text-gray-700"
                        role="heading"
                        aria-level={5}
                      >
                        {dateHeader}
                      </h5>
                    </div>
                    
                    {/* Messages for this date */}
                    <div className="space-y-3">
                      {messagesInGroup.map((message) => (
                        <MessageRow 
                          key={message.id} 
                          message={message} 
                          showMyTime={showMyTime} 
                          eventTimezone={eventTimezone} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-sm">No past messages</p>
                <p className="text-xs text-gray-400 mt-1">
                  Sent messages will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Message Dialog */}
      <CancelMessageDialog
        isOpen={cancelDialogOpen}
        onClose={handleCloseCancelDialog}
        onConfirm={handleConfirmCancel}
        message={messageToCancel}
        isLoading={isCancelling}
      />

      {/* Show cancel error if any */}
      {cancelError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="text-sm text-red-800">
            <span className="font-medium">Cancel failed:</span> {cancelError}
          </div>
          <button
            onClick={() => setCancelError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
