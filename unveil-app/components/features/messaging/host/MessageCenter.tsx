'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/hooks/useMessages';
import { useGuests } from '@/hooks/guests';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageComposer } from './MessageComposer';
import { RecentMessages } from './RecentMessages';

interface MessageCenterProps {
  eventId: string;
  className?: string;
  preselectionPreset?: string | null;
  preselectedGuestIds?: string[];
}

export function MessageCenter({
  eventId,
  className,
  preselectionPreset,
  preselectedGuestIds,
}: MessageCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'history'>(
    'compose',
  );

  // Check subscription manager readiness for realtime features
  const { isReady: subscriptionReady } = useSubscriptionManager();

  // Domain hooks - direct data access
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refreshMessages,
  } = useMessages(eventId);
  const { loading: guestsLoading, error: guestsError } = useGuests({ eventId });

  // Combined loading state including subscription readiness
  const loading = messagesLoading || guestsLoading || !subscriptionReady;
  const error = messagesError || guestsError;

  const handleMessageSent = async () => {
    // Refresh messages after sending
    await refreshMessages(eventId);
  };

  const handleClear = () => {
    // Reset any form state if needed
  };

  const handleMessageScheduled = async () => {
    // Refresh messages after scheduling
    await refreshMessages(eventId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">
          {!subscriptionReady
            ? 'Connecting to realtime...'
            : 'Loading messaging...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-800">
          Error loading messaging:{' '}
          {error instanceof Error ? error.message : String(error)}
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
              : 'text-gray-600 hover:text-gray-900',
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
              : 'text-gray-600 hover:text-gray-900',
          )}
        >
          Message History
        </button>
      </div>

      {/* Content - Keep both mounted to prevent state loss */}
      <div style={{ display: activeView === 'compose' ? 'block' : 'none' }}>
        <MessageComposer
          eventId={eventId}
          onMessageSent={handleMessageSent}
          onMessageScheduled={handleMessageScheduled}
          onClear={handleClear}
          preselectionPreset={preselectionPreset}
          preselectedGuestIds={preselectedGuestIds}
        />
      </div>
      <div style={{ display: activeView === 'history' ? 'block' : 'none' }}>
        <RecentMessages messages={messages || []} eventId={eventId} />
      </div>
    </div>
  );
}
