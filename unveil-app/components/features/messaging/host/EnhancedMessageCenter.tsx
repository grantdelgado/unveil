'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageTemplates, type MessageTemplate } from './MessageTemplates';
import { RecipientPresets, type RecipientFilter, type AdvancedRecipientFilter } from './RecipientPresets';
import { MessageComposer } from './MessageComposer';
import { RecentMessages } from './RecentMessages';
import type { Database } from '@/app/reference/supabase.types';

type Participant = Database['public']['Tables']['event_participants']['Row'] & {
  user: Database['public']['Views']['public_user_profiles']['Row'];
};

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: Database['public']['Views']['public_user_profiles']['Row'] | null;
};

interface EnhancedMessageCenterProps {
  eventId: string;
  className?: string;
}

export function EnhancedMessageCenter({ eventId, className }: EnhancedMessageCenterProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedRecipientFilter, setSelectedRecipientFilter] = useState<RecipientFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'compose' | 'history'>('compose');

  // Fetch participants and messages
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('event_participants')
          .select(`
            *,
            user:public_user_profiles(*)
          `)
          .eq('event_id', eventId);

        if (participantsError) throw participantsError;

        // Fetch recent messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:public_user_profiles(*)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (messagesError) throw messagesError;

        setParticipants(participantsData || []);
        setMessages(messagesData || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load messaging data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [eventId]);

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

  const handleRecipientFilterChange = (filter: RecipientFilter, advancedFilter?: AdvancedRecipientFilter) => {
    setSelectedRecipientFilter(filter);
    // TODO: Handle advanced filter in future iterations
    // Currently unused but preserved for API compatibility
    console.debug('Advanced filter:', advancedFilter);
  };

  // Convert participants to guests format for compatibility
  const mockGuests = participants.map(participant => ({
    id: participant.id,
    event_id: eventId,
    phone: participant.user?.full_name || '', // Using full_name as phone placeholder
    guest_name: participant.user?.full_name || '',
    guest_tags: null as string[] | null,
    rsvp_status: participant.rsvp_status || 'pending',
    guest_email: null,
    invited_at: null,
    notes: null,
    phone_number_verified: false,
    communication_preferences: null,
    user_id: participant.user?.id || null,
    created_at: participant.created_at,
    preferred_communication: 'sms' as const,
    role: 'guest' as const,
    sms_opt_out: false,
    updated_at: participant.created_at
  }));

  const handleMessageSent = () => {
    // Refresh messages after sending
    const refreshMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:public_user_profiles(*)
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
      } catch (err) {
        console.error('Error refreshing messages:', err);
      }
    };

    refreshMessages();
  };

  const handleClear = () => {
    setSelectedTemplate(null);
    setSelectedRecipientFilter('all');
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

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h2 className="text-lg font-medium text-gray-900">Messaging Center</h2>
        </div>
        
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('compose')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
              activeView === 'compose'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Compose
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
              activeView === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            History ({messages.length})
          </button>
        </div>
      </div>

      {activeView === 'compose' ? (
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
            participants={participants}
            selectedTemplate={selectedTemplate}
            selectedRecipientFilter={selectedRecipientFilter}
            onMessageSent={handleMessageSent}
            onClear={handleClear}
          />
        </div>
      ) : (
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
            <div className="text-lg font-semibold text-gray-900">{participants.length}</div>
            <div className="text-xs text-gray-600">Total Guests</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{messages.length}</div>
            <div className="text-xs text-gray-600">Messages Sent</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {participants.filter(p => p.rsvp_status === 'pending').length}
            </div>
            <div className="text-xs text-gray-600">Pending RSVPs</div>
          </div>
        </div>
      </div>
    </div>
  );
} 