'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type PublicUserProfile = Database['public']['Tables']['users']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface MessageWithSender extends Message {
  sender: PublicUserProfile | null;
}

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwnMessage?: boolean;
  showSender?: boolean;
  className?: string;
}

export function MessageBubble({
  message,
  isOwnMessage = false,
  showSender = true,
  className,
}: MessageBubbleProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  const getMessageTypeStyle = () => {
    if (message.message_type === 'announcement') {
      return 'bg-gradient-to-r from-purple-50 to-rose-50 border border-purple-200 text-purple-900 shadow-sm';
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
      case 'direct':
        return '💬';
      default:
        return '💬';
    }
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Sender info */}
      {showSender && message.sender && (
        <div className={cn(
          'flex items-center gap-2 text-xs',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}>
          <span className="text-gray-500">
            {getMessageTypeIcon()} {message.sender.full_name || 'Unknown User'}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div className={cn(
        'flex',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}>
        <div className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 transition-all duration-200',
          getMessageTypeStyle(),
          isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md'
        )}>
          {/* Message type indicator for announcements */}
          {message.message_type === 'announcement' && (
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-purple-700">
              <span>📢</span>
              <span>Host Announcement</span>
            </div>
          )}

          {/* Message content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>

          {/* Timestamp */}
          <div className={cn(
            'text-xs mt-2 opacity-70',
            isOwnMessage ? 'text-right' : 'text-left'
          )}>
            {formatTime(message.created_at || '')}
          </div>
        </div>
      </div>
    </div>
  );
} 