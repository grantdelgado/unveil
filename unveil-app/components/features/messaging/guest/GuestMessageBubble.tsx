'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import type { GuestMessage } from '@/lib/utils/messageUtils';

interface GuestMessageBubbleProps {
  message: GuestMessage;
  className?: string;
}

export function GuestMessageBubble({
  message,
  className,
}: GuestMessageBubbleProps) {
  const isOwnMessage = message.is_own_message;
  const isCatchup = message.is_catchup || false;
  // const isChannelMessage = message.message_type === 'channel';

  const getMessageTypeStyle = () => {
    if (message.message_type === 'announcement') {
      return 'bg-gradient-to-r from-purple-50 to-rose-50 border border-purple-200 text-purple-900 shadow-sm';
    }

    if (message.message_type === 'channel') {
      return 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 shadow-sm';
    }

    if (isOwnMessage) {
      return 'bg-gradient-to-r from-rose-500 to-purple-500 text-white shadow-sm';
    }

    return 'bg-white border border-gray-200 text-gray-900 shadow-sm';
  };

  const getMessageTypeIcon = () => {
    switch (message.message_type) {
      case 'announcement':
        return '📢';
      case 'channel':
        return '🏷️';
      case 'direct':
        return '💬';
      default:
        return '💬';
    }
  };

  const getMessageTypeLabel = () => {
    switch (message.message_type) {
      case 'announcement':
        return 'Announcement';
      case 'channel':
        return `Channel${message.channel_tags?.length ? `: ${message.channel_tags.join(', ')}` : ''}`;
      case 'direct':
        return 'Direct';
      default:
        return '';
    }
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Sender info with message type badge */}
      <div
        className={cn(
          'flex items-center gap-2 text-xs',
          isOwnMessage ? 'justify-end' : 'justify-start',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">
            {getMessageTypeIcon()} {message.sender_name}
          </span>

          {/* Message type badge */}
          {!isOwnMessage && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                message.message_type === 'announcement' &&
                  'bg-purple-100 text-purple-700',
                message.message_type === 'channel' &&
                  'bg-blue-100 text-blue-700',
                message.message_type === 'direct' &&
                  'bg-gray-100 text-gray-700',
              )}
            >
              {getMessageTypeLabel()}
            </span>
          )}

          {/* Catchup indicator */}
          {isCatchup && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Posted before you joined
            </span>
          )}
        </div>
      </div>

      {/* Message bubble */}
      <div
        className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}
      >
        <div
          className={cn(
            'max-w-[80%] rounded-2xl px-4 py-3 transition-all duration-200',
            getMessageTypeStyle(),
            isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md',
          )}
        >
          {/* Message content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>

          {/* Timestamp and source info */}
          <div
            className={cn(
              'text-xs mt-2 opacity-70 flex items-center gap-2',
              isOwnMessage ? 'justify-end' : 'justify-start',
            )}
          >
            <span>{formatMessageTimestamp(message.created_at)}</span>

            {/* Development: Show source info */}
            {process.env.NODE_ENV === 'development' && message.source && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-mono',
                  message.source === 'delivery'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-blue-200 text-blue-800',
                )}
              >
                {message.source}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
