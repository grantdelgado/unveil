'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui';
import { MessageBubble } from '@/components/features/messaging/common';
// Note: Guest messaging functionality simplified - using useMessages hook instead
// MVP: Guest message input and response indicator removed - read-only announcements
import { SMSNotificationToggle } from './SMSNotificationToggle';
import { MessageCircle, ChevronDown } from 'lucide-react';
// MVP: Logger removed - no error handling needed for read-only component
import { useGuestMessagesRPC } from '@/hooks/messaging/useGuestMessagesRPC';
import { useGuestSMSStatus } from '@/hooks/messaging/useGuestSMSStatus';


// Types - using hook's MessageWithDelivery type directly

interface GuestMessagingProps {
  eventId: string;
  currentUserId: string | null;
  guestId: string;
}

export function GuestMessaging({ eventId, currentUserId, guestId }: GuestMessagingProps) {
  // Use enhanced guest messaging hook with pagination
  const {
    messages,
    loading,
    error,
    hasMore,
    isFetchingOlder,
    fetchOlderMessages,
    refetch,
  } = useGuestMessagesRPC({
    eventId,
    guestId,
  });

  // Get guest's SMS notification status
  const { smsOptOut, loading: smsStatusLoading, refreshStatus } = useGuestSMSStatus({
    eventId,
    userId: currentUserId,
  });

  // MVP: Response functionality removed - guests can only view announcements
  
  const isConnected = !loading;

  // Single authoritative header component - prevents any duplication
  const MessagingHeader = useCallback(() => (
    <div 
      className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-4"
      data-testid="guest-messaging-header"
      role="banner"
      aria-label="Event Messages section"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-stone-400" aria-hidden="true" />
          <h2 className="text-lg font-medium text-stone-800">Event Messages</h2>
          {isConnected && (
            <div className="flex items-center gap-1" aria-live="polite">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          )}
        </div>
        
        {/* SMS Notification Toggle - only show for authenticated guests */}
        {currentUserId && guestId && !smsStatusLoading && (
          <SMSNotificationToggle
            eventId={eventId}
            guestId={guestId}
            initialOptOut={smsOptOut}
            onToggle={refreshStatus}
          />
        )}
      </div>
    </div>
  ), [isConnected, currentUserId, guestId, smsStatusLoading, eventId, smsOptOut, refreshStatus]);

  // MVP: Guest replies disabled - no response state needed
  
  // Scroll management state
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [shouldAutoScroll] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const scrollHeightBeforePrepend = useRef<number>(0);
  const shouldPreserveScroll = useRef<boolean>(false);
  
  // Accessibility state
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>('');

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
    
    // Clear new messages indicator when user reaches bottom
    if (isCurrentlyAtBottom) {
      setNewMessagesCount(0);
      setHasNewMessages(false);
    }
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
    setNewMessagesCount(0);
    setHasNewMessages(false);
  }, [scrollToBottom]);

  /**
   * Auto-scroll logic for new messages with accessibility announcements
   */
  useEffect(() => {
    const messageCountChanged = messages.length !== previousMessageCountRef.current;
    const isNewMessage = messages.length > previousMessageCountRef.current;
    const newMessageCount = messages.length - previousMessageCountRef.current;
    
    if (messageCountChanged) {
      previousMessageCountRef.current = messages.length;
      
      if (isNewMessage) {
        // Announce new messages for screen readers
        const announcement = newMessageCount === 1 
          ? 'New message received' 
          : `${newMessageCount} new messages received`;
        setAriaLiveMessage(announcement);
        
        // Clear the announcement after a brief delay to allow re-announcements
        setTimeout(() => setAriaLiveMessage(''), 3000);
        
        if (isAtBottom || shouldAutoScroll) {
          // Auto-scroll to new messages if user is at bottom or it's their own message
          setTimeout(() => scrollToBottom(true), 100);
        } else {
          // User is scrolled up - update new messages indicator
          setNewMessagesCount(prev => prev + newMessageCount);
          setHasNewMessages(true);
        }
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
   * Preserve scroll position when older messages are prepended
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldPreserveScroll.current) return;

    // Calculate the difference in scroll height and adjust scroll position
    const heightDiff = container.scrollHeight - scrollHeightBeforePrepend.current;
    if (heightDiff > 0) {
      container.scrollTop = container.scrollTop + heightDiff;
    }
    
    shouldPreserveScroll.current = false;
  }, [messages]);

  /**
   * Enhanced fetch older messages with scroll preservation
   */
  const handleFetchOlderMessages = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Store current scroll height before fetching
    scrollHeightBeforePrepend.current = container.scrollHeight;
    shouldPreserveScroll.current = true;
    
    await fetchOlderMessages();
  }, [fetchOlderMessages]);

  // MVP: Response handling removed - guests can only view announcements

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
        <MessagingHeader />
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
         <MessagingHeader />
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
         <MessagingHeader />
         <div className="flex-1 flex items-center justify-center p-6">
           <div className="text-center space-y-4">
             <EmptyState
               variant="messages"
               title="No messages yet"
               description="Your host hasn&apos;t sent any messages for this event yet. Check back later!"
             />
           </div>
         </div>
        <div className="flex-shrink-0 bg-white border-t border-stone-200 py-6 px-5">
          <div className="flex items-center justify-center gap-2 text-xs text-stone-500">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Announcements from your hosts</span>
          </div>
        </div>
       </div>
     );
   }

  return (
    <div className="flex flex-col bg-stone-50 h-[60vh] min-h-[400px] max-h-[600px] md:h-[50vh] md:min-h-[500px] md:max-h-[700px]">
      {/* Header - Consolidated to prevent duplicates */}
      <MessagingHeader />

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
          {/* Load Earlier Messages Button */}
          {hasMore && (
            <div className="flex flex-col items-center py-3 border-b border-stone-100 mb-4 space-y-2">
              <button
                onClick={handleFetchOlderMessages}
                disabled={isFetchingOlder}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                aria-label="Load earlier messages"
              >
                {isFetchingOlder ? (
                  <>
                    <div className="h-4 w-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 rotate-180" />
                    <span>Load earlier messages</span>
                  </>
                )}
              </button>
              
              {/* Pagination Error State */}
              {error && error.includes('older messages') && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-md border border-red-200">
                  Failed to load older messages.{' '}
                  <button
                    onClick={handleFetchOlderMessages}
                    className="underline hover:no-underline font-medium"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => {
            const isOwnMessage = message.is_own_message;
            
            // Transform RPC message format to MessageBubble interface
            const messageWithSender = {
              id: message.message_id,
              content: message.content,
              created_at: message.created_at,
              message_type: (message.message_type === "welcome" || message.message_type === "custom" || message.message_type === "rsvp_reminder") 
                ? "announcement" 
                : message.message_type as "direct" | "announcement" | "channel" | null,
              sender_user_id: isOwnMessage ? currentUserId : null,
              event_id: eventId,
              delivered_at: null,
              delivered_count: null,
              failed_count: null,
              scheduled_message_id: null, // Guest messages are not scheduled messages
              sender: message.sender_name ? {
                id: 'unknown', // We don't have the actual user ID from RPC
                full_name: message.sender_name,
                avatar_url: message.sender_avatar_url,
                phone: '',
                email: null,
                created_at: null,
                updated_at: null,
                onboarding_completed: false,
                intended_redirect: null,
              } : null,
            };
            
            return (
              <MessageBubble
                key={message.message_id}
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
              className={`
                relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full 
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                ${hasNewMessages 
                  ? 'bg-white hover:bg-stone-50 text-stone-700 shadow-lg ring-1 ring-stone-200 focus:ring-rose-500' 
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600 shadow-md focus:ring-stone-400'
                }
                motion-safe:${hasNewMessages ? 'animate-pulse' : ''}
              `}
              aria-label={`Jump to latest message${newMessagesCount > 0 ? ` (${newMessagesCount} new)` : ''}`}
            >
              {/* New message count badge */}
              {newMessagesCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                  {newMessagesCount > 99 ? '99+' : newMessagesCount}
                </span>
              )}
              
              <span className="text-xs">
                {hasNewMessages ? 'New messages' : 'Jump to latest'}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* MVP: Read-only announcements footer - no guest replies */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-t border-stone-200 sticky bottom-0 safe-bottom">
        <div className="flex items-center justify-center gap-2 text-xs text-stone-500 py-5 px-5 min-h-[3rem]">
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Announcements from your hosts</span>
          {/* Build: {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'} */}
          {/* Defensive: Composer intentionally removed for MVP read-only experience */}
        </div>
      </div>


      
      {/* Accessibility: Screen reader announcements for new messages */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {ariaLiveMessage}
      </div>
    </div>
  );
}
