'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/common';
import { sendMessageToEvent, type SendMessageRequest } from '@/services/messaging';
import type { Database } from '@/app/reference/supabase.types';
import type { MessageTemplate } from './MessageTemplates';
import type { RecipientFilter } from './RecipientPresets';

type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

interface MessageComposerProps {
  eventId: string;
  guests: Guest[];
  selectedTemplate?: MessageTemplate | null;
  selectedRecipientFilter?: RecipientFilter;
  onMessageSent?: () => void;
  onClear?: () => void;
  className?: string;
}

function MessageComposerComponent({
  eventId,
  guests,
  selectedTemplate,
  selectedRecipientFilter = 'all',
  onMessageSent,
  onClear,
  className
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const maxCharacters = useMemo(() => 160, []); // SMS standard
  const { triggerHaptic } = useHapticFeedback();

  // Auto-fill message when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setMessage(selectedTemplate.content);
      setCharacterCount(selectedTemplate.content.length);
      // Focus the textarea after setting the message
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(selectedTemplate.content.length, selectedTemplate.content.length);
      }, 100);
    }
  }, [selectedTemplate]);

  // Update character count when message changes
  useEffect(() => {
    setCharacterCount(message.length);
  }, [message]);

  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      switch (selectedRecipientFilter) {
        case 'attending':
          return guest.rsvp_status === 'attending';
        case 'pending':
          return guest.rsvp_status === 'pending';
        case 'maybe':
          return guest.rsvp_status === 'maybe';
        case 'declined':
          return guest.rsvp_status === 'declined';
        default:
          return true;
      }
    });
  }, [guests, selectedRecipientFilter]);

  const isCharacterLimitExceeded = useMemo(() => 
    characterCount > maxCharacters, [characterCount, maxCharacters]
  );
  
  const isNearLimit = useMemo(() => 
    characterCount > maxCharacters * 0.8, [characterCount, maxCharacters]
  );

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || loading || isCharacterLimitExceeded || filteredGuests.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: SendMessageRequest = {
        eventId,
        content: message.trim(),
        type: 'announcement',
        recipientFilter: selectedRecipientFilter
      };

      const result = await sendMessageToEvent(request);

      if (result.error) {
        throw result.error;
      }

      // Reset form
      setMessage('');
      setCharacterCount(0);
      setSuccess(true);
      triggerHaptic('success');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

      onMessageSent?.();
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      setError(errorMessage);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  }, [message, loading, isCharacterLimitExceeded, filteredGuests.length, selectedRecipientFilter, eventId, onMessageSent, triggerHaptic]);

  const handleClear = useCallback(() => {
    setMessage('');
    setCharacterCount(0);
    setError(null);
    setSuccess(false);
    onClear?.();
  }, [onClear]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">❌</span>
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-success-bounce">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5 animate-success-bounce" role="img" aria-hidden="true">✅</span>
            <div className="text-sm text-green-800 font-medium">Message sent successfully!</div>
          </div>
        </div>
      )}

      {/* Template Context */}
      {selectedTemplate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">{selectedTemplate.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Using template: {selectedTemplate.name}
              </p>
              <p className="text-xs text-blue-700">
                {selectedTemplate.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="space-y-3">
        <FieldLabel htmlFor="message" required>
          Your Message
        </FieldLabel>
        
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="message"
            value={message}
            onChange={handleMessageChange}
            placeholder={selectedTemplate 
              ? "Customize your message..." 
              : "Type your message here..."
            }
            rows={4}
            className={cn(
              'w-full px-4 py-3 border rounded-lg transition-all duration-200',
              'focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent resize-none',
              'text-sm leading-relaxed',
              isCharacterLimitExceeded
                ? 'border-red-300 bg-red-50 focus:ring-red-500'
                : 'border-gray-300 bg-white'
            )}
            maxLength={maxCharacters + 50}
          />
          
          {/* Character Counter */}
          <div className={cn(
            'flex items-center justify-between mt-2 text-xs',
            isCharacterLimitExceeded
              ? 'text-red-600'
              : isNearLimit
              ? 'text-amber-600'
              : 'text-gray-500'
          )}>
            <span>
              {characterCount}/{maxCharacters} characters
            </span>
            {isCharacterLimitExceeded && (
              <span className="font-medium">
                {characterCount - maxCharacters} over limit
              </span>
            )}
          </div>
        </div>

        {/* Recipient Context */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base" role="img" aria-hidden="true">🎯</span>
            <span className="font-medium text-gray-900">
              Sending to {filteredGuests.length} {filteredGuests.length === 1 ? 'guest' : 'guests'}
            </span>
            {selectedRecipientFilter !== 'all' && (
              <span className="text-gray-600">
                ({selectedRecipientFilter} only)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button 
          onClick={handleClear}
          variant="outline"
          className="flex-1 h-12 border-gray-300 text-gray-700 hover:bg-gray-50"
          disabled={loading}
        >
          Clear
        </Button>
        <Button 
          onClick={handleSendMessage}
          disabled={!message.trim() || loading || isCharacterLimitExceeded || filteredGuests.length === 0}
          className={cn(
            'flex-1 h-12 min-w-[120px] bg-[#FF6B6B] hover:bg-[#ff5252] transition-all duration-150 ease-out',
            'hover:scale-[0.98] active:scale-[0.96] hover:shadow-lg',
            'disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none'
          )}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span>Sending...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span role="img" aria-hidden="true">📤</span>
              <span>Send Message</span>
            </div>
          )}
        </Button>
      </div>

      {/* Mobile tip */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:hidden">
        <div className="flex items-start gap-2">
          <span className="text-sm" role="img" aria-hidden="true">💡</span>
          <p className="text-xs text-blue-700">
            Tip: Tap templates above to quickly fill common messages, then customize as needed.
          </p>
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const MessageComposer = memo(MessageComposerComponent);
