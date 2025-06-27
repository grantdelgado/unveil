'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/app/reference/supabase.types';

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: Database['public']['Tables']['users']['Row'] | null;
};

interface RecentMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onDuplicateMessage?: (message: Message) => void;
  className?: string;
}

export function RecentMessages({
  messages,
  isLoading = false,
  onDuplicateMessage,
  className
}: RecentMessagesProps) {
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement': return 'Announcement';
      case 'direct': return 'Direct Message';
      case 'reminder': return 'Reminder';
      default: return 'Message';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return '📢';
      case 'direct': return '💬';
      case 'reminder': return '⏰';
      default: return '📝';
    }
  };

  const getStatusColor = () => {
    // For now, all messages are considered sent since we don't have delivery tracking
    return 'text-green-600 bg-green-50';
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📨</span>
          <h3 className="text-lg font-medium text-gray-900">Recent Messages</h3>
        </div>
        
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📨</span>
          <h3 className="text-lg font-medium text-gray-900">Recent Messages</h3>
        </div>
        
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl" role="img" aria-hidden="true">📭</span>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                No messages sent yet
              </p>
              <p className="text-xs text-gray-600">
                Your sent messages will appear here with delivery status and options to resend.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📨</span>
        <h3 className="text-lg font-medium text-gray-900">Recent Messages</h3>
        <span className="text-sm text-gray-500">({messages.length})</span>
      </div>

      <div className="space-y-3">
        {messages.map((message) => {
          const isExpanded = expandedMessage === message.id;
          const messageContent = message.content || '';
          const shouldTruncate = messageContent.length > 100;
          
          return (
            <div 
              key={message.id}
              className="border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">
                    {getMessageTypeIcon(message.message_type || 'announcement')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {getMessageTypeLabel(message.message_type || 'announcement')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status badge */}
                <span className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full flex-shrink-0',
                  getStatusColor()
                )}>
                  Sent
                </span>
              </div>

              {/* Message content */}
              <div className="mb-3">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {isExpanded || !shouldTruncate 
                    ? messageContent 
                    : truncateContent(messageContent)}
                </p>
                
                {shouldTruncate && (
                  <button
                    onClick={() => setExpandedMessage(isExpanded ? null : message.id)}
                    className="text-xs text-[#FF6B6B] hover:text-[#ff5252] mt-1 focus:outline-none focus:underline"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>

              {/* Recipients info - message type indicates scope */}
              {message.message_type === 'direct' && (
                <div className="text-xs text-gray-500 mb-3">
                  Direct message
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {onDuplicateMessage && (
                  <Button
                    onClick={() => onDuplicateMessage(message)}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3 border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    <span className="mr-1" role="img" aria-hidden="true">📋</span>
                    Duplicate
                  </Button>
                )}
                
                {/* Resend functionality removed since we don't track delivery status */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more button if there are many messages */}
      {messages.length >= 5 && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            View Message History
          </Button>
        </div>
      )}
    </div>
  );
} 