/**
 * useScheduledMessagesCache Hook
 * 
 * Handles cache operations for scheduled messages.
 * Extracted from the original useScheduledMessages hook for better separation of concerns.
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

export interface UseScheduledMessagesCacheOptions {
  queryKey: (string | any)[];
}

export interface UseScheduledMessagesCacheReturn {
  addMessage: (message: ScheduledMessage) => void;
  updateMessage: (id: string, updates: Partial<ScheduledMessage>) => void;
  removeMessage: (id: string) => void;
  handleRealtimeInsert: (newMessage: ScheduledMessage) => boolean;
  handleRealtimeUpdate: (updatedMessage: ScheduledMessage) => void;
  handleRealtimeDelete: (deletedMessage: ScheduledMessage) => void;
  invalidateQueries: () => void;
  processedMessageIds: React.MutableRefObject<Set<string>>;
}

/**
 * Hook for cache operations of scheduled messages
 * 
 * Responsibilities:
 * - Optimistic cache updates
 * - Duplicate prevention
 * - Manual cache management functions
 * - Real-time event processing
 */
export function useScheduledMessagesCache({
  queryKey
}: UseScheduledMessagesCacheOptions): UseScheduledMessagesCacheReturn {
  
  const queryClient = useQueryClient();
  
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef(new Set<string>());

  // Helper function to sort messages chronologically
  const sortMessagesByDate = (messages: ScheduledMessage[]): ScheduledMessage[] => {
    return messages.sort((a, b) => 
      new Date(a.send_at).getTime() - new Date(b.send_at).getTime()
    );
  };

  // Manual cache management functions
  const addMessage = useCallback((message: ScheduledMessage) => {
    // Check if already processed
    if (processedMessageIds.current.has(message.id)) {
      console.log(`🔄 Skipping duplicate manual add for message ${message.id}`);
      return;
    }
    
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return [message];
      
      const exists = old.find(m => m.id === message.id);
      if (exists) return old;
      
      // Add to processed set
      processedMessageIds.current.add(message.id);
      
      const newMessages = [...old, message];
      return sortMessagesByDate(newMessages);
    });
  }, [queryClient, queryKey]);

  const updateMessage = useCallback((id: string, updates: Partial<ScheduledMessage>) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.map(message => 
        message.id === id ? { ...message, ...updates } : message
      );
    });
    
    // Ensure it's in processed set
    processedMessageIds.current.add(id);
  }, [queryClient, queryKey]);

  const removeMessage = useCallback((id: string) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.filter(message => message.id !== id);
    });
    
    // Remove from processed set
    processedMessageIds.current.delete(id);
  }, [queryClient, queryKey]);

  // Real-time event handlers
  const handleRealtimeInsert = useCallback((newMessage: ScheduledMessage): boolean => {
    // Check for duplicates
    if (processedMessageIds.current.has(newMessage.id)) {
      console.log(`🔄 Skipping duplicate INSERT for message ${newMessage.id}`);
      return false;
    }
    
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return [newMessage];
      
      // Double-check if message already exists
      const exists = old.find(m => m.id === newMessage.id);
      if (exists) {
        console.log(`🔄 Message ${newMessage.id} already exists in cache`);
        return old;
      }
      
      // Add to processed set
      processedMessageIds.current.add(newMessage.id);
      
      // Add new message in chronological order by send_at
      const newMessages = [...old, newMessage];
      return sortMessagesByDate(newMessages);
    });
    
    return true;
  }, [queryClient, queryKey]);

  const handleRealtimeUpdate = useCallback((updatedMessage: ScheduledMessage) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.map(message => 
        message.id === updatedMessage.id ? updatedMessage : message
      );
    });
    
    // Ensure it's in processed set
    processedMessageIds.current.add(updatedMessage.id);
  }, [queryClient, queryKey]);

  const handleRealtimeDelete = useCallback((deletedMessage: ScheduledMessage) => {
    // Optimistically update React Query cache
    queryClient.setQueryData(queryKey, (old: ScheduledMessage[] | undefined) => {
      if (!old) return old;
      return old.filter(message => message.id !== deletedMessage.id);
    });
    
    // Remove from processed set
    processedMessageIds.current.delete(deletedMessage.id);
  }, [queryClient, queryKey]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    addMessage,
    updateMessage,
    removeMessage,
    handleRealtimeInsert,
    handleRealtimeUpdate,
    handleRealtimeDelete,
    invalidateQueries,
    processedMessageIds,
  };
} 