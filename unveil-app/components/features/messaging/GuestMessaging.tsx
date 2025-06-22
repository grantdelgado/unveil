'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/app/reference/supabase.types';
import { useRealtimeSubscription } from '@/hooks/realtime';
import { EmptyState, SkeletonLoader } from '@/components/ui';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Send, MessageCircle } from 'lucide-react';

type Message = Database['public']['Tables']['messages']['Row'];
type PublicUserProfile =
  Database['public']['Views']['public_user_profiles']['Row'];

interface MessageWithSender extends Message {
  sender: PublicUserProfile | null;
}

interface GuestMessagingProps {
  eventId: string;
  currentUserId: string | null;
}

function GuestMessaging({ eventId, currentUserId }: GuestMessagingProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showCharCount, setShowCharCount] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const messageCountRef = useRef<number>(0);

  const fetchMessages = useCallback(async () => {
    try {
      // First, try to fetch messages without the join to avoid RLS issues
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('❌ Error fetching messages:', messagesError);
        setMessages([]);
        setLoading(false);
        return;
      }

      // Then try to fetch sender info for each unique sender
      const uniqueSenderIds = Array.from(
        new Set(
          messagesData
            ?.map((m) => m.sender_user_id)
            .filter((id): id is string => Boolean(id)) || [],
        ),
      );

      const sendersMap = new Map<string, PublicUserProfile>();

      // Fetch sender profiles separately to handle RLS gracefully
      for (const senderId of uniqueSenderIds) {
        try {
          const { data: senderData, error: senderError } = await supabase
            .from('public_user_profiles')
            .select('*')
            .eq('id', senderId)
            .single();

          if (!senderError && senderData) {
            sendersMap.set(senderId, senderData);
          }
        } catch {
          // Silently handle individual sender fetch failures
        }
      }

      // Combine messages with sender info
      const messagesWithSenders: MessageWithSender[] = (messagesData || []).map(
        (message) => ({
          ...message,
          sender: message.sender_user_id
            ? sendersMap.get(message.sender_user_id) || null
            : null,
        }),
      );

      setMessages(messagesWithSenders);
    } catch (err) {
      console.error('❌ Unexpected error fetching messages:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Handle real-time message updates
  const handleMessageChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      console.log('📨 Real-time message update:', payload);

      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new;
        
        // Fetch sender info for the new message
        if (newMessage.sender_user_id) {
          supabase
            .from('public_user_profiles')
            .select('*')
            .eq('id', newMessage.sender_user_id)
            .single()
            .then(({ data: senderData }) => {
            const messageWithSender: MessageWithSender = {
              ...newMessage,
              sender: senderData || null,
            };

            setMessages((prev) => {
              // Avoid duplicates
              const exists = prev.some((m) => m.id === newMessage.id);
              if (exists) return prev;
              return [...prev, messageWithSender];
            });

            // Scroll to bottom
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.new.id ? { ...msg, ...payload.new } : msg,
          ),
        );
      } else if (payload.eventType === 'DELETE') {
        setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
      }
    },
    [],
  );

  // Real-time subscription for messages
  const { isConnected } = useRealtimeSubscription({
    subscriptionId: `messages-${eventId}`,
    table: 'messages',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: !!eventId,
    onDataChange: handleMessageChange,
    onError: (error) => {
      console.error('❌ Message subscription error:', error);
    },
    onStatusChange: (status) => {
      console.log(`📡 Message subscription status: ${status}`);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Message validation
  const validateMessage = useCallback((content: string): { isValid: boolean; error?: string } => {
    const trimmedContent = content.trim();
    
    if (!trimmedContent) {
      return { isValid: false, error: 'Message cannot be empty' };
    }
    
    if (trimmedContent.length > 500) {
      return { isValid: false, error: 'Message too long (max 500 characters)' };
    }
    
    // Check for spam patterns
    const spamPatterns = [
      /(.)\1{10,}/i, // Repeated characters
      /[A-Z]{20,}/, // Too many caps
      /(https?:\/\/[^\s]+)/gi, // URLs (optional restriction)
    ];
    
    for (const pattern of spamPatterns) {
      if (pattern.test(trimmedContent)) {
        return { isValid: false, error: 'Message appears to be spam' };
      }
    }
    
    return { isValid: true };
  }, []);

  // Rate limiting
  const checkRateLimit = useCallback((): { canSend: boolean; error?: string } => {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTimeRef.current;
    
    // Minimum 2 seconds between messages
    if (timeSinceLastMessage < 2000) {
      return { 
        canSend: false, 
        error: `Please wait ${Math.ceil((2000 - timeSinceLastMessage) / 1000)} seconds before sending another message` 
      };
    }
    
    // Reset counter every minute
    if (timeSinceLastMessage > 60000) {
      messageCountRef.current = 0;
    }
    
    // Max 10 messages per minute
    if (messageCountRef.current >= 10) {
      return { 
        canSend: false, 
        error: 'Too many messages. Please wait a minute before sending more.' 
      };
    }
    
    return { canSend: true };
  }, []);

  // Typing indicator logic
  const handleTyping = useCallback(() => {
    if (!currentUserId || !eventId) return;

    setIsTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  }, [currentUserId, eventId]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentUserId || sending) return;

    // Validate message content
    const messageValidation = validateMessage(newMessage);
    if (!messageValidation.isValid) {
      alert(messageValidation.error);
      return;
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.canSend) {
      alert(rateLimitCheck.error);
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        event_id: eventId,
        sender_user_id: currentUserId,
        content: newMessage.trim(),
        message_type: 'channel',
      });

      if (error) {
        console.error('❌ Error sending message:', error);
        alert('Failed to send message. Please try again.');
        return;
      }

      // Update rate limiting counters
      lastMessageTimeRef.current = Date.now();
      messageCountRef.current += 1;

      setNewMessage('');
      setIsTyping(false);
      setShowCharCount(false);
      
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Focus back to input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      // Real-time subscription will handle adding the message to the list
    } catch (err) {
      console.error('❌ Unexpected error sending message:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [newMessage, currentUserId, sending, eventId, validateMessage, checkRateLimit]);

  const formatMessageTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  }, []);

  const getMessageTypeStyle = useCallback(
    (type: string, isOwnMessage: boolean) => {
      if (type === 'announcement') {
        return 'bg-gradient-to-r from-purple-50 to-rose-50 border border-purple-200 text-purple-900 shadow-sm';
      }

      if (isOwnMessage) {
        return 'bg-gradient-to-r from-rose-500 to-purple-500 text-white shadow-sm';
      }

      return 'bg-white border border-gray-200 text-gray-900 shadow-sm';
    },
    [],
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    handleTyping();
    
    // Show character count when approaching limit
    setShowCharCount(value.length > 400);
  }, [handleTyping]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <SkeletonLoader variant="text" count={3} />
        <div className="mt-4 flex space-x-3">
          <div className="flex-1 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="w-16 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-rose-100 to-purple-100 rounded-lg">
            <MessageCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Event Chat</h2>
            <p className="text-sm text-gray-600">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </p>
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              isConnected ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500 font-medium">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div className="px-4 py-4 space-y-4 max-h-96 overflow-y-auto scroll-smooth bg-gradient-to-b from-gray-50 to-white">
        {messages.length > 0 ? (
          messages.map((message, index) => {
            const isOwnMessage = message.sender_user_id === currentUserId;
            const isAnnouncement = message.message_type === 'announcement';
            const showAvatar = index === 0 || messages[index - 1]?.sender_user_id !== message.sender_user_id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage && !isAnnouncement ? 'justify-end' : 'justify-start'} group`}
              >
                <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-[85%]`}>
                  {/* Avatar for others' messages */}
                  {!isOwnMessage && showAvatar && (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                      <span className="text-sm font-medium text-blue-600">
                        {message.sender?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`relative ${isOwnMessage ? 'mr-2' : 'ml-2'}`}>
                    {/* Sender name for group messages */}
                    {!isOwnMessage && showAvatar && (
                      <div className="mb-1 ml-3">
                        <span className="text-xs font-medium text-gray-600">
                          {message.sender?.full_name || 'Someone'}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`px-4 py-3 rounded-2xl transition-all duration-200 group-hover:shadow-md ${getMessageTypeStyle(message.message_type || 'direct', isOwnMessage)} ${
                        isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">{message.content}</p>
                      <p
                        className={`text-xs mt-2 opacity-75 ${
                          isOwnMessage ? 'text-right' : 'text-left'
                        }`}
                      >
                        {message.created_at
                          ? formatMessageTime(message.created_at)
                          : 'Just now'}
                      </p>
                    </div>
                  </div>

                  {/* Spacer for own messages */}
                  {isOwnMessage && <div className="w-8 flex-shrink-0" />}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8">
            <EmptyState
              variant="messages"
              title="No messages yet"
              description="Be the first to share something with everyone!"
              className="border-0 bg-transparent"
            />
          </div>
        )}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        {/* Character count */}
        {showCharCount && (
          <div className="mb-2 text-right">
            <span className={`text-xs ${newMessage.length > 480 ? 'text-red-500' : 'text-gray-500'}`}>
              {newMessage.length}/500
            </span>
          </div>
        )}
        
        <div className="flex space-x-3 items-end">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all text-base bg-gray-50 hover:bg-white hover:border-gray-300" // text-base prevents zoom on iOS
              disabled={sending || !currentUserId}
              maxLength={500}
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
              inputMode="text"
              style={{ fontSize: '16px' }} // Prevent iOS zoom
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || !currentUserId}
            className="min-h-[44px] min-w-[44px] p-3 bg-gradient-to-r from-rose-500 to-purple-500 text-white rounded-full hover:from-rose-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Helper text */}
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            Share updates, ask questions, or just say hello! ✨
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(GuestMessaging);
