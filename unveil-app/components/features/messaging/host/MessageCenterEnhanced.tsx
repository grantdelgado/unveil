'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/hooks/useMessages';
import { useGuests } from '@/hooks/useGuests';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EnhancedMessageComposer } from './EnhancedMessageComposer';
import { ScheduleComposer } from './ScheduleComposer';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { RecentMessages } from './RecentMessages';
import { useUpcomingScheduledMessagesCount } from '@/hooks/messaging/useScheduledMessages';

interface MessageCenterEnhancedProps {
  eventId: string;
  className?: string;
}

/**
 * Enhanced Message Center with advanced recipient filtering
 * Drop-in replacement for the basic MessageCenter component
 */
export function MessageCenterEnhanced({ eventId, className }: MessageCenterEnhancedProps) {
  const [activeView, setActiveView] = useState<'compose' | 'schedule' | 'scheduled' | 'history'>('compose');

  // Domain hooks - direct data access
  const { messages, loading: messagesLoading, error: messagesError, refreshMessages } = useMessages(eventId);
  const { guests, loading: guestsLoading, error: guestsError } = useGuests(eventId);
  const { count: upcomingCount, loading: countLoading } = useUpcomingScheduledMessagesCount(eventId);

  // Combined loading state
  const loading = messagesLoading || guestsLoading;
  const error = messagesError || guestsError;

  const handleMessageSent = async () => {
    // Refresh messages after sending
    await refreshMessages(eventId);
  };

  const handleMessageScheduled = () => {
    // Switch to scheduled messages view after scheduling
    setActiveView('scheduled');
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
          {String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-gray-100 rounded-lg p-1 gap-1 flex-1">
        <button
          onClick={() => setActiveView('compose')}
          className={cn(
            'py-2 px-3 rounded-md text-sm font-medium transition-colors',
            activeView === 'compose'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="block sm:inline">📝</span>
          <span className="block sm:inline sm:ml-1">Send Now</span>
        </button>
        
        <button
          onClick={() => setActiveView('schedule')}
          className={cn(
            'py-2 px-3 rounded-md text-sm font-medium transition-colors',
            activeView === 'schedule'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="block sm:inline">⏰</span>
          <span className="block sm:inline sm:ml-1">Schedule</span>
        </button>
        
        <button
          onClick={() => setActiveView('scheduled')}
          className={cn(
            'py-2 px-3 rounded-md text-sm font-medium transition-colors relative',
            activeView === 'scheduled'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="block sm:inline">📅</span>
          <span className="block sm:inline sm:ml-1">Upcoming</span>
          {upcomingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {upcomingCount > 9 ? '9+' : upcomingCount}
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveView('history')}
          className={cn(
            'py-2 px-3 rounded-md text-sm font-medium transition-colors',
            activeView === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="block sm:inline">📋</span>
          <span className="block sm:inline sm:ml-1">History</span>
        </button>
        </div>
        
        {/* Analytics Link */}
        <a
          href={`/host/events/${eventId}/messages/analytics`}
          className="ml-4 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
        >
          📊 Analytics
        </a>
      </div>

      {/* Content */}
      {activeView === 'compose' && (
        <EnhancedMessageComposer
          eventId={eventId}
          onMessageSent={handleMessageSent}
          onClear={handleClear}
        />
      )}
      
      {activeView === 'schedule' && (
        <ScheduleComposer
          eventId={eventId}
          onMessageScheduled={handleMessageScheduled}
          onCancel={() => setActiveView('compose')}
        />
      )}
      
      {activeView === 'scheduled' && (
        <ScheduledMessagesList
          eventId={eventId}
        />
      )}
      
      {activeView === 'history' && (
        <RecentMessages
          messages={messages || []}
        />
      )}
    </div>
  );
}
