'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import type { Database } from '@/app/reference/supabase.types';

// Use the direct database type for messages - matches useMessages hook return
type Message = Database['public']['Tables']['messages']['Row'];

interface RecentMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  className?: string;
}

export function RecentMessages({
  messages,
  isLoading = false,
  className
}: RecentMessagesProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-4 h-20" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
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

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Messages ({messages.length})
      </h3>
      
      <div className="space-y-3">
        {messages
          .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
          .map((message) => (
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
                    <span>
                      {formatMessageTimestamp(message.created_at || '')}
                    </span>
                    
                    {message.message_type && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {message.message_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
} 