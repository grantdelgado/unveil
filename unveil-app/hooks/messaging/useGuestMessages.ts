import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Message } from '@/lib/types/messaging';

interface UseGuestMessagesProps {
  eventId: string;
  guestId?: string;
}

export function useGuestMessages({ eventId, guestId }: UseGuestMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    async function fetchMessages() {
      try {
        setLoading(true);
        
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_user_id_fkey(*)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch messages');
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`messages:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId]);

  const sendMessage = async (content: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          event_id: eventId,
          content,
          sender_user_id: user.user.id,
          message_type: 'direct',
        });

      if (sendError) throw sendError;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
  };
} 