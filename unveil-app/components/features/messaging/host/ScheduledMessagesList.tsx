'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useScheduledMessages } from '@/hooks/messaging/useScheduledMessages';
// Analytics temporarily removed
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage =
  Database['public']['Tables']['scheduled_messages']['Row'];

interface ScheduledMessagesListProps {
  eventId: string;
  onEditMessage?: (message: ScheduledMessage) => void;
  showAnalytics?: boolean;
  className?: string;
}

/**
 * Component for displaying and managing scheduled messages
 */
export function ScheduledMessagesList({
  eventId,
  onEditMessage: _onEditMessage, // Reserved for future functionality
  showAnalytics = true,
  className,
}: ScheduledMessagesListProps) {
  // Suppress unused variable warning - reserved for future use
  void _onEditMessage;
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [cancellingMessageId, setCancellingMessageId] = useState<string | null>(
    null,
  );

  const {
    scheduledMessages,
    loading,
    error,
    deleteScheduledMessage,
    cancelScheduledMessage,
    upcomingCount,
    sentCount,
    cancelledCount,
    refreshMessages,
  } = useScheduledMessages({ eventId });

  const getMessageTypeEmoji = (messageType: string) => {
    switch (messageType) {
      case 'reminder':
        return '📧';
      case 'thank_you':
        return '🎉';
      case 'channel':
        return '📢';
      default:
        return '📢';
    }
  };

  const getStatusEmoji = (status: string, sendAt: string) => {
    const sendTime = new Date(sendAt);
    const now = new Date();

    switch (status) {
      case 'scheduled':
        return sendTime > now ? '⏰' : '⚠️';
      case 'sent':
        return '✅';
      case 'cancelled':
        return '❌';
      case 'failed':
        return '🚫';
      default:
        return '❓';
    }
  };

  const getStatusText = (status: string, sendAt: string) => {
    const sendTime = new Date(sendAt);
    const now = new Date();

    switch (status) {
      case 'scheduled':
        return sendTime > now ? 'Scheduled' : 'Overdue';
      case 'sent':
        return 'Sent';
      case 'cancelled':
        return 'Cancelled';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const getRelativeTime = (sendAt: string) => {
    const sendTime = new Date(sendAt);
    const now = new Date();
    const diffMs = sendTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      const pastDiffMs = now.getTime() - sendTime.getTime();
      const pastDays = Math.floor(pastDiffMs / (1000 * 60 * 60 * 24));
      const pastHours = Math.floor(
        (pastDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const pastMinutes = Math.floor(
        (pastDiffMs % (1000 * 60 * 60)) / (1000 * 60),
      );

      if (pastDays > 0)
        return `${pastDays} day${pastDays !== 1 ? 's' : ''} ago`;
      if (pastHours > 0)
        return `${pastHours} hour${pastHours !== 1 ? 's' : ''} ago`;
      return `${pastMinutes} minute${pastMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    if (diffHours > 0)
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this scheduled message? This action cannot be undone.',
      )
    ) {
      return;
    }

    setDeletingMessageId(messageId);
    try {
      const result = await deleteScheduledMessage(messageId);
      if (!result.success) {
        alert(`Failed to delete message: ${result.error}`);
      }
    } catch {
      alert('Failed to delete message');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleCancelMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled message?')) {
      return;
    }

    setCancellingMessageId(messageId);
    try {
      const result = await cancelScheduledMessage(messageId);
      if (!result.success) {
        alert(`Failed to cancel message: ${result.error}`);
      }
    } catch {
      alert('Failed to cancel message');
    } finally {
      setCancellingMessageId(null);
    }
  };

  const getDeliveryMethods = (message: ScheduledMessage) => {
    const methods = [];
    if (message.send_via_push) methods.push('🔔 Push');
    if (message.send_via_sms) methods.push('💬 SMS');
    return methods.join(', ');
  };

  // Group messages by status
  const upcomingMessages = scheduledMessages.filter(
    (msg) => msg.status === 'scheduled' && new Date(msg.send_at) > new Date(),
  );
  const pastMessages = scheduledMessages.filter(
    (msg) =>
      msg.status === 'sent' ||
      msg.status === 'cancelled' ||
      msg.status === 'failed' ||
      (msg.status === 'scheduled' && new Date(msg.send_at) <= new Date()),
  );

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600">
          Loading scheduled messages...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'bg-red-50 border border-red-200 rounded-lg p-4',
          className,
        )}
      >
        <div className="text-red-800">
          <span className="font-medium">
            ❌ Error loading scheduled messages:
          </span>{' '}
          {error}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshMessages}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (scheduledMessages.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="text-4xl mb-3">📅</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Scheduled Messages
        </h3>
        <p className="text-gray-500 text-sm">
          Schedule messages to be sent automatically at a future time
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-blue-700">{upcomingCount}</div>
          <div className="text-xs text-blue-600">Upcoming</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-700">{sentCount}</div>
          <div className="text-xs text-green-600">Sent</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-gray-700">
            {cancelledCount}
          </div>
          <div className="text-xs text-gray-600">Cancelled</div>
        </div>
      </div>

      {/* Upcoming Messages */}
      {upcomingMessages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">⏰</span>
            Upcoming Messages ({upcomingMessages.length})
          </h3>
          <div className="space-y-3">
            {upcomingMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Standard Message Display */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">
                          {getMessageTypeEmoji(
                            message.message_type || 'announcement',
                          )}
                        </span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {message.message_type || 'announcement'}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {getRelativeTime(message.send_at)}
                        </span>
                      </div>

                      {/* Message Content Preview */}
                      <div className="text-sm text-gray-700 mb-3">
                        {message.content.length > 100
                          ? `${message.content.substring(0, 100)}...`
                          : message.content}
                      </div>

                      {/* Message Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Recipients:</span>{' '}
                          {message.recipient_count && message.recipient_count > 0 ? message.recipient_count : 'TBD'}
                        </div>
                        <div>
                          <span className="font-medium">Delivery:</span>{' '}
                          {getDeliveryMethods(message)}
                        </div>
                        <div>
                          <span className="font-medium">Time:</span>{' '}
                          {new Date(message.send_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelMessage(message.id)}
                        disabled={cancellingMessageId === message.id}
                        className="text-orange-600 hover:text-orange-700 border-orange-300"
                      >
                        {cancellingMessageId === message.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          'Cancel'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteMessage(message.id)}
                        disabled={deletingMessageId === message.id}
                        className="text-red-600 hover:text-red-700 border-red-300"
                      >
                        {deletingMessageId === message.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          'Delete'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Messages */}
      {pastMessages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">📜</span>
            Message History ({pastMessages.length})
          </h3>
          <div className="space-y-3">
            {pastMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Message Display */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">
                          {getMessageTypeEmoji(
                            message.message_type || 'announcement',
                          )}
                        </span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {message.message_type || 'announcement'}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-1 rounded-full',
                            message.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : message.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800',
                          )}
                        >
                          {getStatusEmoji(
                            message.status || 'scheduled',
                            message.send_at,
                          )}{' '}
                          {getStatusText(
                            message.status || 'scheduled',
                            message.send_at,
                          )}
                        </span>
                      </div>

                      {/* Message Content Preview */}
                      <div className="text-sm text-gray-600 mb-3">
                        {message.content.length > 100
                          ? `${message.content.substring(0, 100)}...`
                          : message.content}
                      </div>

                      {/* Message Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Recipients:</span>{' '}
                          {message.status === 'scheduled' 
                            ? (message.recipient_count && message.recipient_count > 0 ? message.recipient_count : 'TBD')
                            : (message.recipient_count || 0)
                          }
                          {message.status === 'sent' &&
                            message.success_count !== undefined && message.success_count !== null && message.success_count > 0 && (
                              <span className="text-green-600 ml-1">
                                ({message.success_count} delivered)
                              </span>
                            )}
                        </div>
                        <div>
                          <span className="font-medium">Delivery:</span>{' '}
                          {getDeliveryMethods(message)}
                        </div>
                        <div>
                          <span className="font-medium">
                            {message.status === 'sent' ? 'Sent:' : 'Scheduled:'}
                          </span>{' '}
                          {getRelativeTime(message.sent_at || message.send_at)}
                        </div>
                      </div>
                    </div>

                    {/* Actions for cancelled/failed messages */}
                    {(message.status === 'cancelled' ||
                      message.status === 'failed') && (
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMessage(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="text-red-600 hover:text-red-700 border-red-300"
                        >
                          {deletingMessageId === message.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Delete'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Analytics Card temporarily disabled */}
                {false && showAnalytics && message.status === 'sent' && (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                    📊 Analytics coming soon
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
