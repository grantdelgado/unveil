'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { sendMessageToEvent } from '@/lib/services/messaging';
import {
  useRecipientPreview,
  useAvailableTags,
} from '@/hooks/messaging/useRecipientPreview';
import { SendFlowModal } from './SendFlowModal';
import type { RecipientFilter } from '@/lib/types/messaging';

// Type for the enhanced API response that includes SMS delivery counts
interface SendMessageResult {
  message: Record<string, unknown>;
  recipientCount: number;
  guestIds: string[];
  deliveryChannels: string[];
  smsDelivered?: number;
  smsFailed?: number;
}

interface MessageCenterMVPProps {
  eventId: string;
  onMessageSent?: () => void;
  className?: string;
}

/**
 * Simplified MVP message center for host messaging
 * Mobile-first design with essential functionality only
 */
export function MessageCenterMVP({
  eventId,
  onMessageSent,
  className,
}: MessageCenterMVPProps) {
  // Message state
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Recipient filtering state - default to eligible guests only (declined excluded)
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>({
    type: 'all',
    includeDeclined: false,
  });

  // Send flow modal state
  const [showSendFlowModal, setShowSendFlowModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use the recipient preview hook for real-time filtering
  const {
    previewData,
    loading: previewLoading,
    error: previewError,
  } = useRecipientPreview({
    eventId,
    filter: recipientFilter,
    debounceMs: 300,
  });

  // Get available tags for filtering
  const { tags: availableTags, loading: tagsLoading } =
    useAvailableTags(eventId);

  // Validation and counts
  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;
  const validRecipientCount = previewData?.validRecipientsCount || 0;
  const canSend = isValid && validRecipientCount > 0;

  /**
   * Handle recipient filter changes
   */
  const handleFilterChange = useCallback((newFilter: RecipientFilter) => {
    setRecipientFilter(newFilter);
    setError(null);
  }, []);

  /**
   * Handle send button click - shows send flow modal
   */
  const handleSend = () => {
    if (!canSend) return;
    setShowSendFlowModal(true);
  };

  /**
   * Handle send via modal flow
   */
  const handleSendFlowSend = async (options: {
    sendViaPush: boolean;
    sendViaSms: boolean;
  }) => {
    try {
      const result = await sendMessageToEvent({
        eventId,
        content: message.trim(),
        recipientFilter,
        messageType: 'announcement',
        sendVia: {
          sms: options.sendViaSms,
          email: false,
          push: options.sendViaPush,
        },
      });

      if (!result.success) {
        const errorMessage =
          result.error instanceof Error
            ? result.error.message
            : 'Failed to send message';
        return {
          success: false,
          sentCount: 0,
          failedCount: validRecipientCount,
          error: errorMessage,
        };
      }

      // Clear form state on success
      setMessage('');
      setError(null);
      setRecipientFilter({ type: 'all', includeDeclined: false });

      // Trigger data refresh
      onMessageSent?.();

      // Return success result
      return {
        success: true,
        sentCount: result.data?.recipientCount || 0,
        failedCount: (result.data as SendMessageResult)?.smsFailed || 0,
        messageId: result.data?.message?.id
          ? String(result.data.message.id)
          : undefined,
      };
    } catch (err) {
      return {
        success: false,
        sentCount: 0,
        failedCount: validRecipientCount,
        error: err instanceof Error ? err.message : 'Failed to send message',
      };
    }
  };

  /**
   * Handle modal close
   */
  const handleCloseSendFlowModal = () => {
    setShowSendFlowModal(false);
  };

  return (
    <div className={cn('space-y-6 max-w-2xl mx-auto px-4 py-6', className)}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Send Message to Guests
        </h1>
        <p className="text-sm text-gray-600">
          Compose and send messages to your event guests
        </p>
      </div>

      {/* Filter Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Select Recipients</h2>

        {/* Guest Selection replaced RSVP Status Filter */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Select Recipients
          </h3>
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <div className="text-xs text-stone-600">
              Individual guest selection now available in the new composer
              interface. This MVP version defaults to all eligible guests
              (declined guests excluded).
            </div>
          </div>
        </div>

        {/* Guest Tags Filter */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Guest Tags</h3>
          {tagsLoading ? (
            <div className="text-center py-4">
              <div className="text-xs text-gray-500">Loading tags...</div>
            </div>
          ) : availableTags && availableTags.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {availableTags.map((tag) => (
                <label
                  key={tag}
                  className={cn(
                    'flex items-center space-x-3 p-2 cursor-pointer rounded transition-all',
                    'hover:bg-purple-50',
                    recipientFilter.tags?.includes(tag)
                      ? 'bg-purple-50'
                      : 'bg-white',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={recipientFilter.tags?.includes(tag) || false}
                    onChange={(e) => {
                      const currentTags = recipientFilter.tags || [];
                      let newTags: string[];

                      if (e.target.checked) {
                        newTags = [...currentTags, tag];
                      } else {
                        newTags = currentTags.filter((t) => t !== tag);
                      }

                      const newFilter: RecipientFilter = {
                        ...recipientFilter,
                        type:
                          newTags.length === 0 &&
                          !recipientFilter.rsvpStatuses?.length
                            ? 'all'
                            : 'combined',
                        tags: newTags.length > 0 ? newTags : undefined,
                      };

                      handleFilterChange(newFilter);
                    }}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {tag}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-xs text-gray-500">No tags available yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Recipient Preview */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Recipient Preview</h2>

        {previewLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : previewError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">❌ {previewError}</div>
          </div>
        ) : previewData ? (
          <>
            {/* Summary */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-purple-700">
                    {previewData.totalCount}
                  </div>
                  <div className="text-xs text-purple-600">Total Selected</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">
                    {previewData.validRecipientsCount}
                  </div>
                  <div className="text-xs text-green-600">
                    Will Receive Message
                  </div>
                </div>
              </div>
            </div>

            {/* Guest List */}
            {previewData.guests.length > 0 ? (
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {previewData.guests.slice(0, 6).map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-900">
                        {guest.displayName}
                      </span>
                    </div>

                    {/* Guest Tags */}
                    {guest.tags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        {guest.tags.slice(0, 2).map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {guest.tags.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{guest.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {previewData.guests.length > 6 && (
                  <div className="bg-gray-50 p-3 text-center text-xs text-gray-500">
                    +{previewData.guests.length - 6} more guests
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">🤷‍♂️</div>
                <p className="text-sm text-gray-500">
                  No guests match your filter criteria
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-sm text-gray-500">
              Loading recipient preview...
            </p>
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Message Content</h2>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message to guests..."
          className={cn(
            'w-full min-h-[120px] p-4 border rounded-lg resize-none transition-all',
            'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
            'placeholder:text-gray-400',
            error && error.includes('❌')
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300',
          )}
          maxLength={maxCharacters}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {characterCount}/{maxCharacters} characters
          </div>

          {error && (
            <div
              className={cn(
                'text-sm',
                error.includes('✅') ? 'text-green-600' : 'text-red-600',
              )}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Send Button */}
      <div className="pt-4">
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="w-full flex items-center justify-center gap-2 py-3"
          size="lg"
        >
          <span>Send Now</span>
          {validRecipientCount > 0 && (
            <span className="bg-white/20 px-2 py-1 rounded text-sm">
              {validRecipientCount}
            </span>
          )}
        </Button>
      </div>

      {/* Send Flow Modal */}
      <SendFlowModal
        isOpen={showSendFlowModal}
        onClose={handleCloseSendFlowModal}
        onSend={handleSendFlowSend}
        previewData={previewData}
        messageContent={message}
        messageType="announcement"
      />
    </div>
  );
}
