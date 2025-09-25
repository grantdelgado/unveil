import React, { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];
type ScheduledMessage =
  Database['public']['Tables']['scheduled_messages']['Row'];
type ScheduledMessageInsert =
  Database['public']['Tables']['scheduled_messages']['Insert'];

interface SendMessageRequest {
  eventId: string;
  content: string;
  messageType?: 'direct' | 'announcement' | 'channel';
  recipientFilter?: {
    type: 'all' | 'rsvp_status' | 'tags' | 'individual';
    rsvpStatuses?: string[];
    tags?: string[];
    guestIds?: string[];
  };
}

interface UseMessagesReturn {
  // Queries
  messages: Message[] | null;
  scheduledMessages: ScheduledMessage[] | null;
  loading: boolean;
  error: Error | null;

  // Actions
  sendMessage: (request: SendMessageRequest) => Promise<Message>;
  scheduleMessage: (
    messageData: ScheduledMessageInsert,
  ) => Promise<ScheduledMessage>;
  getEventMessages: (eventId: string) => Promise<Message[]>;
  getScheduledMessages: (eventId: string) => Promise<ScheduledMessage[]>;
  deleteMessage: (id: string) => Promise<void>;
  deleteScheduledMessage: (id: string) => Promise<void>;
  refreshMessages: (eventId: string) => Promise<void>;
}

export function useMessages(eventId?: string): UseMessagesReturn {
  const queryClient = useQueryClient();

  // Dev telemetry: Log hook mount/unmount
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[useMessages] Hook mounted for eventId:', eventId, 'at', new Date().toISOString());
      return () => {
        console.log('[useMessages] Hook unmounting for eventId:', eventId, 'at', new Date().toISOString());
      };
    }
  }, [eventId]);

  // Get messages for event
  const {
    data: messages,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: qk.messages.list(eventId || ''),
    queryFn: async () => {
      if (!eventId) {
        console.log('[useMessages] No eventId provided');
        return [];
      }

      console.log('[useMessages] Fetching messages for eventId:', eventId, 'at', new Date().toISOString());
      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          *,
          sender:users!messages_sender_user_id_fkey(*)
        `,
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (error) {
        console.error('[useMessages] Query error:', error);
        throw new Error(error.message);
      }
      console.log('[useMessages] Query result:', { count: data?.length || 0, data });
      return data;
    },
    enabled: !!eventId,
    // Optimized freshness settings - reduce unnecessary refetches
    staleTime: 60000, // 1 minute fresh window to reduce API calls
    refetchOnWindowFocus: false, // Disable to prevent excessive refetches
    refetchOnMount: true, // Refetch on mount but respect staleTime
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: false, // Rely on realtime updates instead of polling
  });

  // Get scheduled messages
  const { data: scheduledMessages } = useQuery({
    queryKey: qk.scheduledMessages.list(eventId || ''),
    queryFn: async () => {
      if (!eventId) {
        console.log('[useMessages] No eventId for scheduled messages');
        return [];
      }

      console.log('[useMessages] Fetching scheduled messages for eventId:', eventId, 'at', new Date().toISOString());
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('send_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.error('[useMessages] Scheduled messages query error:', error);
        throw new Error(error.message);
      }
      console.log('[useMessages] Scheduled messages result:', { count: data?.length || 0, data });
      return data;
    },
    enabled: !!eventId,
    // Optimized freshness settings for scheduled messages
    staleTime: 60000, // 1 minute fresh window to reduce API calls
    refetchOnWindowFocus: false, // Disable to prevent excessive refetches
    refetchOnMount: true, // Refetch on mount but respect staleTime
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: false, // Rely on realtime updates instead of polling
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (request: SendMessageRequest): Promise<Message> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const messageData: MessageInsert = {
        event_id: request.eventId,
        sender_user_id: user.id,
        content: request.content,
        message_type: request.messageType || 'direct',
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      invalidate(queryClient).messages.allLists(variables.eventId);
    },
  });

  // Schedule message mutation
  const scheduleMessageMutation = useMutation({
    mutationFn: async (
      messageData: ScheduledMessageInsert,
    ): Promise<ScheduledMessage> => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert(messageData)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      invalidate(queryClient).scheduledMessages.allLists(variables.event_id);
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('messages').delete().eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Note: We invalidate all message lists since we don't have eventId in this context
      // This is a limitation of the current API - ideally deleteMessage would take eventId
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'messages' 
      });
    },
  });

  // Delete scheduled message mutation
  const deleteScheduledMessageMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Note: We invalidate all scheduled messages since we don't have eventId in this context
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'scheduledMessages' 
      });
    },
  });

  // Helper functions
  const getEventMessages = useCallback(
    async (eventId: string): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },
    [],
  );

  const getScheduledMessages = useCallback(
    async (eventId: string): Promise<ScheduledMessage[]> => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('send_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },
    [],
  );

  const refreshMessages = useCallback(
    async (eventId: string): Promise<void> => {
      const inv = invalidate(queryClient);
      await Promise.all([
        inv.messages.allLists(eventId),
        inv.scheduledMessages.allLists(eventId),
      ]);
    },
    [queryClient],
  );

  return {
    messages: messages || null,
    scheduledMessages: scheduledMessages || null,
    loading,
    error: error as Error | null,
    sendMessage: sendMessageMutation.mutateAsync,
    scheduleMessage: scheduleMessageMutation.mutateAsync,
    getEventMessages,
    getScheduledMessages,
    deleteMessage: deleteMessageMutation.mutateAsync,
    deleteScheduledMessage: deleteScheduledMessageMutation.mutateAsync,
    refreshMessages,
  };
}
