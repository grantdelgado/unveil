'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMessages } from '@/hooks/useMessages';
import { useGuests } from '@/hooks/useGuests';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageTemplates } from './MessageTemplates';
import { RecipientPresets } from './RecipientPresets';
import { MessageComposer } from './MessageComposer';
import { RecentMessages } from './RecentMessages';

interface MessageCenterProps {
  eventId: string;
  className?: string;
}

export function MessageCenter({ eventId, className }: MessageCenterProps) {
  // State
  const [activeView, setActiveView] = useState<'compose' | 'history'>('compose');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedRecipientFilter, setSelectedRecipientFilter] = useState({
    type: 'all' as const,
  });

  // Domain hooks - direct data access
  const { messages, sendMessage, loading: messagesLoading, error: messagesError, refreshMessages } = useMessages(eventId);
  const { guests, loading: guestsLoading, error: guestsError } = useGuests(eventId);

  // Combined loading state
  const loading = messagesLoading || guestsLoading;
  const error = messagesError || guestsError;

  // Event handlers
  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template);
  };

  const handleRecipientFilterChange = (filter: { type: string; [key: string]: unknown }) => {
    setSelectedRecipientFilter(filter);
  };

  const handleMessageSent = async (content: string) => {
    try {
      await sendMessage({
        eventId,
        content,
        messageType: 'announcement',
        recipientFilter: selectedRecipientFilter,
      });
      
      // Reset form
      setSelectedTemplate(null);
      setSelectedRecipientFilter({ type: 'all' });
      
      // Refresh messages
      await refreshMessages(eventId);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDuplicateMessage = (messageContent: string) => {
    setActiveView('compose');
    setSelectedTemplate(messageContent);
  };

  const handleClear = () => {
    setSelectedTemplate(null);
    setSelectedRecipientFilter({ type: 'all' });
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-center p-8 text-red-600', className)}>
        <p>Failed to load message center: {error.message}</p>
        <button 
          onClick={() => refreshMessages(eventId)}
          className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with view toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setActiveView('compose')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeView === 'compose'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Compose
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              activeView === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            History ({messages?.length || 0})
          </button>
        </div>
      </div>

      {/* Compose View */}
      {activeView === 'compose' && (
        <div className="space-y-6">
          {/* Recipient Selection */}
          <RecipientPresets
            eventId={eventId}
            guests={guests || []}
            selectedFilter={selectedRecipientFilter}
            onFilterChange={handleRecipientFilterChange}
          />

          {/* Message Templates */}
          <MessageTemplates onTemplateSelect={handleTemplateSelect} />

          {/* Message Composer */}
          <MessageComposer
            eventId={eventId}
            guests={guests || []}
            selectedTemplate={selectedTemplate}
            selectedRecipientFilter={selectedRecipientFilter}
            onMessageSent={handleMessageSent}
            onClear={handleClear}
          />
        </div>
      )}

      {/* History View */}
      {activeView === 'history' && (
        <div className="space-y-6">
          {/* Recent Messages */}
          <RecentMessages
            messages={messages || []}
            onDuplicateMessage={handleDuplicateMessage}
          />
          
          {/* Quick compose button */}
          <div className="text-center">
            <button
              onClick={() => setActiveView('compose')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#ff5252] transition-colors duration-200"
            >
              <span role="img" aria-hidden="true">✍️</span>
              <span className="text-sm font-medium">Compose New Message</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 