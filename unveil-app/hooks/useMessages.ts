import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

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

  // Get messages for event
  const {
    data: messages,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['messages', eventId],
    queryFn: async () => {
      if (!eventId) {
        console.log('[useMessages] No eventId provided');
        return [];
      }

      console.log('[useMessages] Fetching messages for eventId:', eventId);
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
    // Instant freshness settings for messages
    staleTime: 0, // Always consider stale for immediate updates
    refetchOnWindowFocus: true, // Enable for immediate freshness
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: typeof window !== 'undefined' && document.visibilityState === 'visible' ? 15000 : false, // 15s when focused
  });

  // Get scheduled messages
  const { data: scheduledMessages } = useQuery({
    queryKey: ['scheduled-messages', eventId],
    queryFn: async () => {
      if (!eventId) {
        console.log('[useMessages] No eventId for scheduled messages');
        return [];
      }

      console.log('[useMessages] Fetching scheduled messages for eventId:', eventId);
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
    // Instant freshness settings for scheduled messages
    staleTime: 0, // Always consider stale for immediate updates
    refetchOnWindowFocus: true, // Enable for immediate freshness
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchInterval: typeof window !== 'undefined' && document.visibilityState === 'visible' ? 15000 : false, // 15s when focused
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
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.eventId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ['scheduled-messages', variables.event_id],
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('messages').delete().eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
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
      // Invalidate all message-related queries with consistent keys
      await queryClient.invalidateQueries({ queryKey: ['messages', eventId] });
      await queryClient.invalidateQueries({
        queryKey: ['scheduled-messages', eventId],
      });
      // Also invalidate queries with filters (from useScheduledMessagesQuery)
      await queryClient.invalidateQueries({
        queryKey: ['scheduled-messages'],
        predicate: (query) => {
          const [table, id] = query.queryKey;
          return table === 'scheduled-messages' && id === eventId;
        }
      });
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
