/**
 * MessageCenterView Component
 * 
 * Pure UI component for rendering the Message Center interface.
 * Receives all props and renders content based on active view.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageTemplates } from '../MessageTemplates';
import { RecipientPresets } from '../RecipientPresets';
import { MessageComposer } from '../MessageComposer';
import { RecentMessages } from '../RecentMessages';
import { MessageCenterTabs } from './MessageCenterTabs';
import type { UseMessageCenterReturn } from './useMessageCenter';

interface MessageCenterViewProps extends UseMessageCenterReturn {
  eventId: string;
  className?: string;
}

/**
 * Pure UI component for the Message Center
 * 
 * This component is responsible only for rendering the UI based on the provided state.
 * All business logic and state management is handled by the useMessageCenter hook.
 */
export function MessageCenterView({
  // State
  guests,
  messages,
  selectedTemplate,
  selectedRecipientFilter,
  activeView,
  loading,
  error,
  mockGuests,
  
  // Actions
  handleTemplateSelect,
  handleRecipientFilterChange,
  handleMessageSent,
  handleDuplicateMessage,
  handleClear,
  setActiveView,
  
  // Additional props
  eventId,
  className
}: MessageCenterViewProps) {
  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-600">Loading messaging center...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">❌</span>
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">
                Unable to load messaging center
              </p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main interface
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with view toggle */}
      <MessageCenterTabs
        activeView={activeView}
        messagesCount={messages.length}
        onActiveViewChange={setActiveView}
      />

      {/* Compose View */}
      {activeView === 'compose' && (
        <div className="space-y-6">
          {/* Recipient Selection */}
          <RecipientPresets
            eventId={eventId}
            guests={mockGuests}
            selectedFilter={selectedRecipientFilter}
            onFilterChange={handleRecipientFilterChange}
          />

          {/* Message Templates */}
          <MessageTemplates
            onTemplateSelect={handleTemplateSelect}
          />

          {/* Message Composer */}
          <MessageComposer
            eventId={eventId}
            guests={guests}
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
            messages={messages}
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

      {/* Quick stats footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">{guests.length}</div>
            <div className="text-xs text-gray-600">Total Guests</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{messages.length}</div>
            <div className="text-xs text-gray-600">Messages Sent</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {guests.filter(p => p.rsvp_status === 'pending').length}
            </div>
            <div className="text-xs text-gray-600">Pending RSVPs</div>
          </div>
        </div>
      </div>
    </div>
  );
} 