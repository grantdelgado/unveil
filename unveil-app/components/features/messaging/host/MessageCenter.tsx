'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/hooks/useMessages';
import { useGuests } from '@/hooks/useGuests';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageComposer } from './MessageComposer';
import { RecentMessages } from './RecentMessages';

interface MessageCenterProps {
  eventId: string;
  className?: string;
}

export function MessageCenter({ eventId, className }: MessageCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'history'>('compose');

  // Domain hooks - direct data access
  const { messages, loading: messagesLoading, error: messagesError, refreshMessages } = useMessages(eventId);
  const { guests, loading: guestsLoading, error: guestsError } = useGuests(eventId);

  // Combined loading state
  const loading = messagesLoading || guestsLoading;
  const error = messagesError || guestsError;

  const handleMessageSent = async () => {
    // Refresh messages after sending
    await refreshMessages(eventId);
  };

  const handleClear = () => {
    // Reset any form state if needed
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-800">
          Error loading messaging: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Navigation Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveView('compose')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            activeView === 'compose'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Compose Message
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            activeView === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Message History
        </button>
      </div>

      {/* Content */}
      {activeView === 'compose' ? (
        <MessageComposer
          eventId={eventId}
          guests={guests || []}
          onMessageSent={handleMessageSent}
          onClear={handleClear}
        />
      ) : (
        <RecentMessages
          messages={messages || []}
        />
      )}
    </div>
  );
} 