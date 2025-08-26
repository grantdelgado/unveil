'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/hooks/useMessages';
import { useGuests } from '@/hooks/guests';
import { useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageComposer } from './MessageComposer';
import { RecentMessages } from './RecentMessages';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

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
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);

  // Check subscription manager readiness for realtime features
  const { isReady: subscriptionReady } = useSubscriptionManager();

  // Domain hooks - direct data access
  const {
    messages,
    scheduledMessages,
    loading: messagesLoading,
    error: messagesError,
    refreshMessages,
  } = useMessages(eventId);
  const { loading: guestsLoading, error: guestsError } = useGuests({ eventId });

  // Combined loading state including subscription readiness
  const loading = messagesLoading || guestsLoading || !subscriptionReady;
  const error = messagesError || guestsError;

  // Hotfix: Dev observability - log hook registration and data state
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MessageCenter] Hook state:', {
        eventId,
        messagesData: messages,
        messagesCount: messages?.length || 0,
        messagesLoading,
        messagesError: messagesError?.message,
        subscriptionReady,
        loading,
        error: error?.message
      });
    }
  }, [eventId, messages, messagesLoading, messagesError, subscriptionReady, loading, error]);

  const handleMessageSent = async () => {
    // Refresh messages after sending
    await refreshMessages(eventId);
  };

  const handleClear = () => {
    // Reset any form state if needed
  };

  const handleMessageScheduled = async () => {
    // Refresh messages after scheduling with proper invalidation
    await refreshMessages(eventId);
    
    // Dev observability - log invalidation success
    if (process.env.NODE_ENV === 'development') {
      console.log('[MessageCenter] Schedule success invalidation:', {
        phase: 'schedule:success',
        invalidateKeys: ['messages', 'scheduled-messages'],
        eventId
      });
    }
  };

  const handleModifyMessage = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setActiveView('compose'); // Switch to composer tab
  };

  const handleMessageUpdated = async () => {
    setEditingMessage(null);
    setActiveView('history'); // Return to history view
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
          onMessageUpdated={handleMessageUpdated}
          onClear={handleClear}
          preselectionPreset={preselectionPreset}
          preselectedGuestIds={preselectedGuestIds}
          editingMessage={editingMessage}
        />
      </div>
      <div style={{ display: activeView === 'history' ? 'block' : 'none' }}>
        <RecentMessages 
          messages={messages || []} 
          scheduledMessages={scheduledMessages || []} 
          eventId={eventId}
          onModifyMessage={handleModifyMessage}
        />
      </div>
    </div>
  );
}
