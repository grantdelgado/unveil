'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui';
import { MessageBubble } from '@/components/features/messaging/common';
// Note: Guest messaging functionality simplified - using useMessages hook instead
import { GuestMessageInput } from './GuestMessageInput';
import { ResponseIndicator } from './ResponseIndicator';
import { MessageCircle, Send } from 'lucide-react';
import { logger } from '@/lib/logger';

// Types - using hook's MessageWithDelivery type directly

interface GuestMessagingProps {
  eventId: string;
  currentUserId: string | null;
  guestId: string;
}

export function GuestMessaging({ eventId, currentUserId, guestId }: GuestMessagingProps) {
  // Use enhanced guest messaging hook
  const {
    messages,
    loading,
    error,
    respondToMessage,
    isConnected,
    refetch,
  } = useGuestMessages({
    eventId,
    guestId,
    enabled: !!eventId && !!guestId,
  });

  // Response UI state
  const [showResponseInput, setShowResponseInput] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [canRespond] = useState(true); // For now, assume guests can respond
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll to bottom on new messages
   */
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  /**
   * Simple response validation
   */
  const validateResponse = useCallback((content: string) => {
    if (!content.trim()) {
      return { isValid: false, error: 'Response cannot be empty' };
    }
    if (content.length > 500) {
      return { isValid: false, error: 'Response must be 500 characters or less' };
    }
    return { isValid: true };
  }, []);

  /**
   * Response handlers using the hook
   */
  const handleResponseSubmit = useCallback(async (content: string) => {
    try {
      setResponseError(null);
      
      // Validate content first
      const validation = validateResponse(content);
      if (!validation.isValid) {
        setResponseError(validation.error || 'Invalid response');
        return;
      }
      
      // For functional responses, we need a message to reply to
      // Using the most recent message as the target
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage) {
        throw new Error('No message to reply to');
      }
      
      await respondToMessage(latestMessage.id, content);
      setShowResponseInput(false);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send response';
      setResponseError(error);
      logger.smsError('Response send failed', err);
    }
  }, [respondToMessage, messages, validateResponse]);

  const handleResponseCancel = useCallback(() => {
    setShowResponseInput(false);
    setResponseError(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" />
        <span className="ml-3 text-sm text-gray-600">Loading messages...</span>
      </div>
    );
  }

   // Error state
   if (error) {
     return (
       <div className="p-6">
         <EmptyState
           variant="messages"
           title="Unable to load messages"
           description={error instanceof Error ? error.message : 'Failed to load messages'}
           actionText="Try Again"
           onAction={refetch}
         />
       </div>
     );
   }

   // Empty state
   if (messages.length === 0) {
     return (
       <div className="p-6 space-y-4">
         <EmptyState
           variant="messages"
           title="No messages yet"
           description="Your host hasn&apos;t sent any messages for this event yet. Check back later!"
         />
         <ResponseIndicator canRespond={canRespond} />
       </div>
     );
   }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-rose-500" />
          <h2 className="text-lg font-semibold text-gray-900">Event Messages</h2>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.sender_user_id === currentUserId;
          
          // Transform message to match MessageBubble interface
          const messageWithSender = {
            ...message,
            sender: null, // For guest view, we don't show sender details
          };
          
          return (
            <MessageBubble
              key={message.id}
              message={messageWithSender}
              isOwnMessage={isOwnMessage}
              showSender={!isOwnMessage}
              className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
            />
          );
        })}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Response UI */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-3">
        {/* Response status indicator */}
        <ResponseIndicator canRespond={canRespond} variant="compact" />
        
        {!showResponseInput ? (
          // Response toggle button
          <button
            onClick={() => setShowResponseInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canRespond}
          >
            <Send className="h-4 w-4" />
            <span>{canRespond ? 'Send a response' : 'Responses disabled'}</span>
          </button>
        ) : (
          // Functional response input
          <GuestMessageInput
            onSend={handleResponseSubmit}
            onCancel={handleResponseCancel}
            validateContent={validateResponse}
            error={responseError}
            disabled={!canRespond}
            previewMode={!canRespond}
          />
        )}
      </div>
    </div>
  );
}
