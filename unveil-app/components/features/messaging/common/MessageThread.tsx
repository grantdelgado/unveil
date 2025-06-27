'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';
import { EmptyState, LoadingSpinner } from '@/components/ui';
// MessageCircle import removed - not used in this component
import type { Database } from '@/app/reference/supabase.types';

type PublicUserProfile = Database['public']['Tables']['users']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface MessageWithSender extends Message {
  sender: PublicUserProfile | null;
}

interface MessageThreadProps {
  messages: MessageWithSender[];
  currentUserId?: string | null;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  autoScroll?: boolean;
  className?: string;
}

export function MessageThread({
  messages = [],
  currentUserId,
  loading = false,
  emptyTitle = "No messages yet",
  emptyDescription = "Start the conversation by sending the first message!",
  autoScroll = true,
  className,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, autoScroll]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('p-8', className)}>
        <EmptyState
          variant="messages"
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  const groupMessagesByDate = (messages: MessageWithSender[]) => {
    const groups: { [key: string]: MessageWithSender[] } = {};
    
    messages.forEach((message) => {
      if (!message.created_at) return;
      
      const date = new Date(message.created_at);
      const dateKey = date.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
        <div key={dateKey} className="space-y-4">
          {/* Date header */}
          <div className="flex justify-center">
            <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
              {formatDateHeader(dateKey)}
            </div>
          </div>

          {/* Messages for this date */}
          <div className="space-y-3">
            {dateMessages.map((message, index) => {
              const isOwnMessage = Boolean(currentUserId && message.sender_user_id === currentUserId);
              const prevMessage = index > 0 ? dateMessages[index - 1] : null;
              const showSender = !prevMessage || prevMessage.sender_user_id !== message.sender_user_id;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showSender={showSender}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
} 