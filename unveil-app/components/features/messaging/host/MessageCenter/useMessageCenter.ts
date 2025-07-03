/**
 * useMessageCenter Hook
 * 
 * Business logic hook for the Message Center feature.
 * Handles data fetching, state management, and business operations
 * for messaging functionality.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
import type { MessageTemplate } from '../MessageTemplates';
import type { RecipientFilter, AdvancedRecipientFilter } from '../RecipientPresets';

export type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

export type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: Database['public']['Tables']['users']['Row'] | null;
};

export type ActiveView = 'compose' | 'history';

export interface MessageCenterState {
  // Data
  guests: Guest[];
  messages: Message[];
  
  // UI State
  selectedTemplate: MessageTemplate | null;
  selectedRecipientFilter: RecipientFilter;
  activeView: ActiveView;
  loading: boolean;
  error: string | null;
  
  // Computed
  mockGuests: Array<{
    id: string;
    event_id: string;
    phone: string;
    guest_name: string;
    guest_tags: string[] | null;
    rsvp_status: string;
    guest_email: string | null;
    invited_at: string | null;
    notes: string | null;
    phone_number_verified: boolean;
    communication_preferences: unknown | null;
    user_id: string | null;
    created_at: string;
    preferred_communication: 'sms';
    role: 'guest';
    sms_opt_out: boolean;
    updated_at: string;
  }>;
}

export interface MessageCenterActions {
  // Template actions
  handleTemplateSelect: (template: MessageTemplate) => void;
  
  // Filter actions
  handleRecipientFilterChange: (filter: RecipientFilter, advancedFilter?: AdvancedRecipientFilter) => void;
  
  // Message actions
  handleMessageSent: () => Promise<void>;
  handleDuplicateMessage: (message: Message) => void;
  handleClear: () => void;
  
  // View actions
  setActiveView: (view: ActiveView) => void;
}

export interface UseMessageCenterReturn extends MessageCenterState, MessageCenterActions {}

/**
 * Custom hook for managing message center state and operations
 */
export function useMessageCenter(eventId: string): UseMessageCenterReturn {
  // State
  const [guests, setGuests] = useState<Guest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedRecipientFilter, setSelectedRecipientFilter] = useState<RecipientFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('compose');

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch guests
        const { data: guestsData, error: guestsError } = await supabase
          .from('event_guests')
          .select(`
            *,
            users:user_id(*)
          `)
          .eq('event_id', eventId);

        if (guestsError) throw guestsError;

        // Fetch recent messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users(*)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (messagesError) throw messagesError;

        setGuests(guestsData || []);
        setMessages(messagesData || []);
      } catch {
        setError('Failed to load messaging data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [eventId]);

  // Convert guests to compatible format for existing components
  const mockGuests = guests.map(guest => ({
    id: guest.id,
    event_id: eventId,
    phone: guest.users?.phone || '', 
    guest_name: guest.users?.full_name || guest.guest_name || '',
    guest_tags: null as string[] | null,
    rsvp_status: guest.rsvp_status || 'pending',
    guest_email: null as string | null,
    invited_at: null as string | null,
    notes: null as string | null,
    phone_number_verified: false,
    communication_preferences: null,
    user_id: guest.users?.id || null,
    created_at: guest.created_at || new Date().toISOString(),
    preferred_communication: 'sms' as const,
    role: 'guest' as const,
    sms_opt_out: false,
    updated_at: guest.created_at || new Date().toISOString()
  }));

  // Business logic handlers
  const handleTemplateSelect = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    
    // Auto-select appropriate recipient filter based on template
    if (template.id === 'rsvp-reminder') {
      setSelectedRecipientFilter('pending');
    } else if (template.id === 'welcome-attending') {
      setSelectedRecipientFilter('attending');
    } else {
      setSelectedRecipientFilter('all');
    }
  };

  const handleRecipientFilterChange = (
    filter: RecipientFilter, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    advancedFilter?: AdvancedRecipientFilter
  ) => {
    setSelectedRecipientFilter(filter);
    // Advanced filter preserved for future iterations - currently unused but maintains API compatibility
  };

  const handleMessageSent = async () => {
    // Refresh messages after sending
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users(*)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMessages(data || []);
      
      // Clear template selection after sending
      setSelectedTemplate(null);
      
      // Switch to history view briefly to show sent message
      setActiveView('history');
      setTimeout(() => setActiveView('compose'), 2000);
    } catch {
      // Message refresh failed - user will see stale data
    }
  };

  const handleDuplicateMessage = (message: Message) => {
    // Create a template from the existing message
    const duplicateTemplate: MessageTemplate = {
      id: `duplicate-${message.id}`,
      name: 'Duplicate Message',
      icon: '📋',
      category: 'update',
      content: message.content || '',
      description: 'Duplicated from previous message'
    };
    
    setSelectedTemplate(duplicateTemplate);
    setActiveView('compose');
  };

  const handleClear = () => {
    setSelectedTemplate(null);
    setSelectedRecipientFilter('all');
  };

  return {
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
  };
} 