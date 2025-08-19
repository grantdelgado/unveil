'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { GuestSelectionList } from './GuestSelectionList';
import { SendFlowModal } from './SendFlowModal';
import { useGuestSelection } from '@/hooks/messaging/useGuestSelection';
import { sendMessageToEvent } from '@/lib/services/messaging';
import { supabase } from '@/lib/supabase/client';
import { formatEventDate } from '@/lib/utils/date';

// Type for the enhanced API response that includes SMS delivery counts
interface SendMessageResult {
  message: Record<string, unknown>;
  recipientCount: number;
  guestIds: string[];
  deliveryChannels: string[];
  smsDelivered?: number;
  smsFailed?: number;
}

interface MessageComposerProps {
  eventId: string;
  onMessageSent?: () => void;
  onClear?: () => void;
  className?: string;
  preselectionPreset?: string | null;
  preselectedGuestIds?: string[];
}

export function MessageComposer({
  eventId,
  onMessageSent,
  onClear,
  className,
  preselectionPreset,
  preselectedGuestIds
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [eventDetails, setEventDetails] = useState<{title: string, event_date: string, hostName: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSendFlowModal, setShowSendFlowModal] = useState(false);

  // Use new guest selection hook instead of RSVP filters
  const {
    filteredGuests,
    selectedGuestIds,
    totalSelected,
    willReceiveMessage,
    toggleGuestSelection,
    selectAllEligible,
    clearAllSelection,
    setSearchQuery,
    loading: guestsLoading,
    error: guestsError
  } = useGuestSelection({ 
    eventId,
    preselectionPreset,
    preselectedGuestIds
  });

  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;
  const canSend = isValid && selectedGuestIds.length > 0;

  // Create preview data for confirmation modal
  const previewData = {
    guests: filteredGuests
      .filter(guest => selectedGuestIds.includes(guest.id))
      .map(guest => ({
        id: guest.id,
        displayName: guest.displayName,
        tags: guest.guest_tags || [],
        rsvpStatus: guest.declined_at ? 'declined' : 'pending',
        hasPhone: guest.hasValidPhone
      })),
    totalCount: totalSelected,
    validRecipientsCount: willReceiveMessage,
    tagCounts: {},
    rsvpStatusCounts: {}
  };

  // Fetch event details for invitation template
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) return;
      
      try {
        const { data, error } = await supabase
          .from('events')
          .select('title, event_date, host:users!events_host_user_id_fkey(full_name)')
          .eq('id', eventId)
          .single();
        
        if (error) throw error;
        setEventDetails({
          ...data,
          hostName: (data.host as { full_name?: string } | null)?.full_name || 'Your host'
        });
      } catch (err) {
        console.error('Failed to fetch event details:', err);
      }
    };
    
    fetchEventDetails();
  }, [eventId]);

  // Set default invitation message based on preselection
  useEffect(() => {
    if (preselectionPreset === 'not_invited' && eventDetails && !message) {
      const eventTitle = eventDetails.title || 'our event';
      const eventDate = eventDetails.event_date 
        ? formatEventDate(eventDetails.event_date) // Use timezone-safe date formatting
        : 'soon';
      const hostName = eventDetails.hostName || 'Your host';
      
      // Use environment-aware APP_URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'app.sendunveil.com';
      
      const defaultMessage = `Hi there! You are invited to ${eventTitle} on ${eventDate}!\n\nView the wedding details here: ${appUrl}/select-event.\n\nHosted by ${hostName} via Unveil\n\nReply STOP to opt out.`;
      setMessage(defaultMessage);
    }
  }, [preselectionPreset, eventDetails, eventId, message]);

  const getPlaceholderText = () => {
    return "Write your message to guests...";
  };

  const handleSend = () => {
    if (!canSend) return;
    setShowSendFlowModal(true);
  };

  const handleSendFlowSend = async (options: { sendViaPush: boolean; sendViaSms: boolean }) => {
    try {
      // Check authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('You must be logged in to send messages. Please refresh the page and try again.');
      }

      console.log('Sending message with explicit recipient selection:', {
        userId: user.id,
        selectedCount: selectedGuestIds.length,
        willReceive: willReceiveMessage,
        sendOptions: options
      });

      // Determine message type based on preselection
      const messageType = preselectionPreset === 'not_invited' ? 'invitation' : 'announcement';
      
      // Use explicit recipient list instead of filters
      const result = await sendMessageToEvent({
        eventId,
        content: message.trim(),
        recipientFilter: { type: 'explicit_selection' }, // Placeholder - server will use recipientEventGuestIds
        recipientEventGuestIds: selectedGuestIds, // NEW: Explicit guest selection
        messageType,
        sendVia: {
          sms: options.sendViaSms,
          email: false,
          push: options.sendViaPush
        }
      });

      if (!result.success) {
        const errorMessage = result.error && typeof result.error === 'object' && 'message' in result.error 
          ? (result.error as { message: string }).message 
          : 'Failed to send message';
        return {
          success: false,
          sentCount: 0,
          failedCount: willReceiveMessage,
          error: errorMessage
        };
      }

      console.log('Message sent successfully:', result.data);
      
      // Clear form state on success
      setMessage('');
      setError(null);
      
      // Trigger data refresh
      onMessageSent?.();
      
      // Return success result
      return {
        success: true,
        sentCount: result.data?.recipientCount || 0,
        failedCount: (result.data as SendMessageResult)?.smsFailed || 0,
        messageId: result.data?.message?.id ? String(result.data.message.id) : undefined
      };
      
    } catch (err) {
      console.error('Message send error:', err);
      return {
        success: false,
        sentCount: 0,
        failedCount: willReceiveMessage,
        error: err instanceof Error ? err.message : 'Failed to send message'
      };
    }
  };

  const handleCloseSendFlowModal = () => {
    setShowSendFlowModal(false);
  };

  const handleClear = () => {
    setMessage('');
    clearAllSelection(); // Clear guest selection
    setError(null);
    onClear?.();
  };



  return (
    <div className={cn('min-h-screen bg-gray-50', className)} style={{ minHeight: '100svh' }}>
      {/* Mobile-optimized container */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        


        {/* Guest Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {guestsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800">
                ❌ {guestsError}
              </div>
            </div>
          ) : (
            <GuestSelectionList
              guests={filteredGuests}
              selectedGuestIds={selectedGuestIds}
              onToggleGuest={toggleGuestSelection}
              onSelectAll={selectAllEligible}
              onClearAll={clearAllSelection}
              onSearchChange={setSearchQuery}
              totalSelected={totalSelected}
              willReceiveMessage={willReceiveMessage}
              loading={guestsLoading}
            />
          )}
        </div>

        {/* Guest Tags - Coming Soon */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <FieldLabel className="text-gray-700 font-medium">
              Guest Tags
            </FieldLabel>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Coming Soon
            </span>
          </div>
          <div className="text-sm text-gray-500 mb-3">
            Tag-based targeting coming soon
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Select tags to target specific groups..."
              disabled
              className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed text-base"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Message Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <FieldLabel className="text-gray-700 font-medium mb-3">
            Message Content
          </FieldLabel>


          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={getPlaceholderText()}
            className={cn(
              'w-full min-h-[120px] p-4 border rounded-lg resize-none transition-all duration-200 text-base',
              'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
              'placeholder:text-gray-400',
              error && error.includes('❌') ? 'border-red-300 bg-red-50' : 'border-gray-300'
            )}
            maxLength={maxCharacters}
          />
          
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-500">
              {characterCount}/{maxCharacters} characters
            </div>
            
            {error && (
              <div className={cn(
                "text-sm",
                error.includes('✅') ? 'text-green-600' : 'text-red-600'
              )}>
                {error}
              </div>
            )}
          </div>
        </div>



        {/* Send Actions - Sticky bottom on mobile */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 -mb-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-base"
              size="lg"
            >
              <span>Send Now</span>
              {willReceiveMessage > 0 && (
                <span className="bg-white/20 px-2 py-1 rounded text-sm">
                  {willReceiveMessage}
                </span>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClear}
              className="px-4 py-3"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Send Flow Modal */}
        <SendFlowModal
          isOpen={showSendFlowModal}
          onClose={handleCloseSendFlowModal}
          onSend={handleSendFlowSend}
          previewData={previewData}
          messageContent={message}
          messageType={preselectionPreset === 'not_invited' ? 'invitation' : 'announcement'}
        />
      </div>
    </div>
  );
}
