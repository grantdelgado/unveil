'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState, LoadingSpinner } from '@/components/ui';
import { MessageCircle } from 'lucide-react';

interface MessageThreadProps {
  messages?: any[];
  loading?: boolean;
  className?: string;
}

export function MessageThread({
  messages = [],
  loading = false,
  className,
}: MessageThreadProps) {
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('p-8', className)}>
        <EmptyState
          
          title="No messages yet"
          description="Start the conversation by sending the first message!"
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {messages.map((message, index) => (
        <div key={message.id || index} className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm">{message.content}</p>
        </div>
      ))}
    </div>
  );
}
