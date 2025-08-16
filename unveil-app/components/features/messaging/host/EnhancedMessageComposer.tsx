'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { sendMessageToEvent } from '@/lib/services/messaging';
import { useRecipientPreview } from '@/hooks/messaging/useRecipientPreview';
import { RecipientSelector } from './RecipientSelector';
import { RecipientPreview } from './RecipientPreview';
import { SendConfirmationModal } from './SendConfirmationModal';
import { TemplateSelector } from './TemplateSelector';
import type { RecipientFilter } from '@/lib/types/messaging';

type MessageType = 'announcement' | 'reminder' | 'thank_you';

interface EnhancedMessageComposerProps {
  eventId: string;
  onMessageSent?: () => void;
  onClear?: () => void;
  className?: string;
}

/**
 * Enhanced message composer with advanced recipient filtering and preview
 * Supports tag-based filtering, RSVP status filtering, and real-time recipient preview
 */
export function EnhancedMessageComposer({
  eventId,
  onMessageSent,
  onClear,
  className
}: EnhancedMessageComposerProps) {
  // Message state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('announcement');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Rich text and scheduling state
  const [isRichTextMode, setIsRichTextMode] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Recipient filtering state
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>({ type: 'all' });
  
  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use the recipient preview hook for real-time filtering
  const { previewData, loading: previewLoading, error: previewError } = useRecipientPreview({
    eventId,
    filter: recipientFilter,
    debounceMs: 300
  });

  // Validation and counts
  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;
  const validRecipientCount = previewData?.validRecipientsCount || 0;
  const canSend = isValid && validRecipientCount > 0 && !isSending;

  /**
   * Handle recipient filter changes
   */
  const handleFilterChange = useCallback((newFilter: RecipientFilter) => {
    setRecipientFilter(newFilter);
    setError(null); // Clear any previous errors
  }, []);

  /**
   * Get placeholder text based on message type
   */
  const getPlaceholderText = () => {
    switch (messageType) {
      case 'reminder':
        return "Hi! Just a friendly reminder to RSVP for our upcoming event. We're excited to celebrate with you!";
      case 'thank_you':
        return "Thank you so much for celebrating with us! Your presence made our event truly special.";
      default:
        return "Write your message to guests...";
    }
  };

  /**
   * Auto-suggest filter based on message type
   */
  const handleMessageTypeChange = (newType: MessageType) => {
    setMessageType(newType);
    
    // Auto-suggest filters for certain message types
    if (newType === 'reminder') {
      setRecipientFilter({ 
        type: 'rsvp_status', 
        rsvpStatuses: ['pending'] 
      });
    } else if (newType === 'thank_you') {
      setRecipientFilter({ 
        type: 'rsvp_status', 
        rsvpStatuses: ['attending'] 
      });
    }
  };

  /**
   * Handle send button click - shows confirmation modal
   */
  const handleSend = () => {
    if (!canSend) return;
    setShowConfirmationModal(true);
  };

  /**
   * Handle confirmed send after modal confirmation
   */
  const handleConfirmedSend = async (options: { sendViaPush: boolean; sendViaSms: boolean }) => {
    if (!canSend) return;

    setIsSending(true);
    setError(null);
    setShowConfirmationModal(false);

    try {
      const result = await sendMessageToEvent({
        eventId,
        content: message.trim(),
        recipientFilter,
        messageType: messageType === 'reminder' ? 'announcement' : messageType as any,
        sendVia: {
          sms: options.sendViaSms,
          email: false,
          push: options.sendViaPush
        }
      });

      if (!result.success) {
        throw new Error(result.error instanceof Error ? result.error.message : 'Failed to send message');
      }

      // Success - clear form and notify parent
      setMessage('');
      setError(null);
      setRecipientFilter({ type: 'all' }); // Reset filters
      onMessageSent?.();
      
      // Show success message briefly with enhanced feedback
      setError(`✅ Message sent successfully to ${validRecipientCount} recipients!`);
      setTimeout(() => setError(null), 5000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
  };

  /**
   * Clear all form state
   */
  const handleClear = () => {
    setMessage('');
    setMessageType('announcement');
    setRecipientFilter({ type: 'all' });
    setIsScheduled(false);
    setScheduledDate('');
    setScheduledTime('');
    setIsRichTextMode(false);
    setError(null);
    onClear?.();
  };

  /**
   * Use template text
   */
  const handleUseTemplate = () => {
    setMessage(getPlaceholderText());
  };

  /**
   * Rich text formatting functions
   */
  const insertFormatting = (format: 'bold' | 'italic' | 'linebreak') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    
    let formattedText = '';
    let newCursorPos = start;

    switch (format) {
      case 'bold':
        formattedText = selectedText ? `**${selectedText}**` : '**text**';
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'italic':
        formattedText = selectedText ? `*${selectedText}*` : '*text*';
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'linebreak':
        formattedText = '\n\n';
        newCursorPos = start + 2;
        break;
    }

    const newMessage = message.substring(0, start) + formattedText + message.substring(end);
    setMessage(newMessage);
    
    // Set cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Message Type Selection */}
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-2">
          Message Type
        </FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleMessageTypeChange('announcement')}
            className={cn(
              'p-3 text-left border rounded-lg transition-colors',
              messageType === 'announcement'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="text-lg mb-1">📢</div>
            <div className="text-sm font-medium">Announcement</div>
            <div className="text-xs text-gray-500">General updates</div>
          </button>
          
          <button
            onClick={() => handleMessageTypeChange('reminder')}
            className={cn(
              'p-3 text-left border rounded-lg transition-colors',
              messageType === 'reminder'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="text-lg mb-1">📧</div>
            <div className="text-sm font-medium">RSVP Reminder</div>
            <div className="text-xs text-gray-500">Follow-up RSVPs</div>
          </button>
          
          <button
            onClick={() => handleMessageTypeChange('thank_you')}
            className={cn(
              'p-3 text-left border rounded-lg transition-colors',
              messageType === 'thank_you'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="text-lg mb-1">🎉</div>
            <div className="text-sm font-medium">Thank You</div>
            <div className="text-xs text-gray-500">Post-event</div>
          </button>
        </div>
      </div>

      {/* Enhanced Recipient Selector */}
      <RecipientSelector
        eventId={eventId}
        filter={recipientFilter}
        onFilterChange={handleFilterChange}
        recipientCount={previewData?.totalCount || 0}
      />

      {/* Recipient Preview Panel */}
      <RecipientPreview
        previewData={previewData}
        loading={previewLoading}
        error={previewError}
      />

      {/* Template Selector */}
      <TemplateSelector
        eventId={eventId}
        messageType={messageType}
        onTemplateSelect={setMessage}
        currentContent={message}
      />

      {/* Message Composition */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel className="text-gray-700 font-medium">
            Message Content
          </FieldLabel>
          <div className="flex items-center gap-2">
            {(messageType === 'reminder' || messageType === 'thank_you') && (
              <button
                type="button"
                onClick={handleUseTemplate}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Use Template
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsRichTextMode(!isRichTextMode)}
              className={cn(
                "text-xs px-2 py-1 rounded border transition-colors duration-200",
                isRichTextMode 
                  ? "bg-purple-100 text-purple-700 border-purple-300" 
                  : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
              )}
            >
              {isRichTextMode ? 'Plain Text' : 'Rich Text'}
            </button>
          </div>
        </div>

        {/* Rich Text Formatting Toolbar */}
        {isRichTextMode && (
          <div className="flex items-center gap-1 mb-2 p-2 bg-gray-50 rounded-lg border">
            <button
              type="button"
              onClick={() => insertFormatting('bold')}
              className="px-2 py-1 text-sm font-bold rounded hover:bg-gray-200 transition-colors duration-200"
              title="Bold (**text**)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('italic')}
              className="px-2 py-1 text-sm italic rounded hover:bg-gray-200 transition-colors duration-200"
              title="Italic (*text*)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('linebreak')}
              className="px-2 py-1 text-sm rounded hover:bg-gray-200 transition-colors duration-200"
              title="Line break"
            >
              ¶
            </button>
            <div className="text-xs text-gray-500 ml-2">
              Use **bold** and *italic* for emphasis
            </div>
          </div>
        )}
        
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isRichTextMode 
            ? `${getPlaceholderText()}\n\nTip: Use **bold** for emphasis` 
            : getPlaceholderText()
          }
          className={cn(
            'w-full min-h-[120px] p-3 border rounded-lg resize-none transition-all duration-200',
            'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
            'placeholder:text-gray-400',
            error && error.includes('❌') ? 'border-red-300 bg-red-50' : 'border-gray-300',
            isRichTextMode && 'font-mono text-sm'
          )}
          maxLength={maxCharacters}
        />
        
        <div className="flex items-center justify-between mt-2">
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

      {/* Delivery Scheduling - MVP Placeholder */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            id="schedule-message"
            checked={isScheduled}
            onChange={(e) => setIsScheduled(e.target.checked)}
            disabled={true} // Disabled for MVP
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded opacity-50"
          />
          <label htmlFor="schedule-message" className="text-sm font-medium text-gray-500">
            📅 Schedule for later
          </label>
          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center gap-2"
        >
          {isSending ? (
            <>
              <LoadingSpinner size="sm" />
              Sending...
            </>
          ) : (
            <>
              <span>Send Now</span>
              {validRecipientCount > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">
                  {validRecipientCount}
                </span>
              )}
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isSending}
        >
          Clear
        </Button>
      </div>

      {/* Send Confirmation Modal */}
      <SendConfirmationModal
        isOpen={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        onConfirm={handleConfirmedSend}
        previewData={previewData}
        messageContent={message}
        messageType={messageType}
        isLoading={isSending}
      />
    </div>
  );
}
