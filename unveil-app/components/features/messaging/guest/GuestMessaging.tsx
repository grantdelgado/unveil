'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui';
import { MessageBubble } from '@/components/features/messaging/common';
// Note: Guest messaging functionality simplified - using useMessages hook instead
import { GuestMessageInput } from './GuestMessageInput';
import { ResponseIndicator } from './ResponseIndicator';
import { MessageCircle, Send, ChevronDown } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useGuestMessages } from '@/hooks/messaging/useGuestMessages';

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
    sendMessage,
  } = useGuestMessages({
    eventId,
    guestId,
  });

  // Simple stub implementations for removed functionality
  const respondToMessage = useCallback(async (messageId: string, content: string) => {
    await sendMessage(content);
  }, [sendMessage]);
  
  const isConnected = !loading;
  const refetch = () => {
    // Refetch would trigger a reload in the real implementation
    console.log('Refetch requested');
  };

  // Response UI state
  const [showResponseInput, setShowResponseInput] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [canRespond] = useState(true); // For now, assume guests can respond
  
  // Scroll management state
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);

  /**
   * Check if user is at the bottom of the scroll container
   */
  const checkIsAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    
    const threshold = 50; // 50px threshold for "at bottom"
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;
    return isAtBottom;
  }, []);

  /**
   * Handle scroll events to track position
   */
  const handleScroll = useCallback(() => {
    const isCurrentlyAtBottom = checkIsAtBottom();
    setIsAtBottom(isCurrentlyAtBottom);
    setShowJumpToLatest(!isCurrentlyAtBottom && messages.length > 0);
  }, [checkIsAtBottom, messages.length]);

  /**
   * Scroll to bottom smoothly
   */
  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    }
  }, []);

  /**
   * Handle jump to latest button click
   */
  const handleJumpToLatest = useCallback(() => {
    scrollToBottom(true);
    setShowJumpToLatest(false);
    setIsAtBottom(true);
  }, [scrollToBottom]);

  /**
   * Auto-scroll logic for new messages
   */
  useEffect(() => {
    const messageCountChanged = messages.length !== previousMessageCountRef.current;
    const isNewMessage = messages.length > previousMessageCountRef.current;
    
    if (messageCountChanged) {
      previousMessageCountRef.current = messages.length;
      
      if (isNewMessage && (isAtBottom || shouldAutoScroll)) {
        // Auto-scroll to new messages if user is at bottom or it's their own message
        setTimeout(() => scrollToBottom(true), 100);
      }
    }
  }, [messages.length, isAtBottom, shouldAutoScroll, scrollToBottom]);

  /**
   * Initial scroll to bottom when messages first load
   */
  useEffect(() => {
    if (messages.length > 0 && previousMessageCountRef.current === 0) {
      // Scroll to bottom on initial load (without animation for better UX)
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [messages.length, scrollToBottom]);

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
      
      // Enable auto-scroll for user's own message
      setShouldAutoScroll(true);
      
      await respondToMessage(latestMessage.id, content);
      setShowResponseInput(false);
      
      // Ensure we scroll to the user's new message
      setTimeout(() => scrollToBottom(true), 200);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send response';
      setResponseError(error);
      logger.smsError('Response send failed', err);
    } finally {
      setShouldAutoScroll(false);
    }
  }, [respondToMessage, messages, validateResponse, scrollToBottom]);

  const handleResponseCancel = useCallback(() => {
    setShowResponseInput(false);
    setResponseError(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
        <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-stone-400" />
            <h2 className="text-lg font-medium text-stone-800">Event Messages</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="md" />
          <span className="ml-3 text-sm text-gray-600">Loading messages...</span>
        </div>
      </div>
    );
  }

   // Error state
   if (error) {
     return (
       <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
         <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-4">
           <div className="flex items-center gap-3">
             <MessageCircle className="h-5 w-5 text-stone-400" />
             <h2 className="text-lg font-medium text-stone-800">Event Messages</h2>
           </div>
         </div>
         <div className="flex-1 flex items-center justify-center p-6">
           <EmptyState
             variant="messages"
             title="Unable to load messages"
             description={error || 'Failed to load messages'}
             actionText="Try Again"
             onAction={refetch}
           />
         </div>
       </div>
     );
   }

   // Empty state
   if (messages.length === 0) {
     return (
       <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
         <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-4">
           <div className="flex items-center gap-3">
             <MessageCircle className="h-5 w-5 text-stone-400" />
             <h2 className="text-lg font-medium text-stone-800">Event Messages</h2>
             {isConnected && (
               <div className="flex items-center gap-1">
                 <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                 <span className="text-xs text-green-600">Live</span>
               </div>
             )}
           </div>
         </div>
         <div className="flex-1 flex items-center justify-center p-6">
           <EmptyState
             variant="messages"
             title="No messages yet"
             description="Your host hasn&apos;t sent any messages for this event yet. Check back later!"
           />
         </div>
         <div className="flex-shrink-0 bg-white border-t border-stone-200 p-5">
           <ResponseIndicator canRespond={canRespond} />
         </div>
       </div>
     );
   }

  return (
    <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-stone-400" />
          <h2 className="text-lg font-medium text-stone-800">Event Messages</h2>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Message Thread - Scrollable Area */}
      <div className="flex-1 relative">
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth"
          role="log"
          aria-label="Event messages"
          aria-live="polite"
        >
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

        {/* Jump to Latest Button */}
        {showJumpToLatest && (
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={handleJumpToLatest}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              aria-label="Jump to latest message"
            >
              <span>Jump to latest</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Response UI - Pinned to Bottom */}
      <div className="flex-shrink-0 bg-white border-t border-stone-200 p-5 space-y-3">
        {/* Response status indicator */}
        <ResponseIndicator canRespond={canRespond} variant="compact" />
        
        {!showResponseInput ? (
          // Response toggle button
          <button
            onClick={() => setShowResponseInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
