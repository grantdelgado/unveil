'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';
import { sendMessageToEvent } from '@/lib/services/messaging';

type Guest = Database['public']['Tables']['event_guests']['Row'];

interface MessageComposerProps {
  eventId: string;
  guests: Guest[];
  onMessageSent?: () => void;
  onClear?: () => void;
  className?: string;
}

export function MessageComposer({
  eventId,
  guests,
  onMessageSent,
  onClear,
  className
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;

  const handleSend = async () => {
    if (!isValid || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      await sendMessageToEvent({
        eventId,
        content: message.trim(),
        recipientFilter: { type: 'all' },
        messageType: 'announcement',
        sendVia: {
          sms: false,
          email: false,
          push: true
        }
      });

      setMessage('');
      onMessageSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setMessage('');
    setError(null);
    onClear?.();
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-2">
          Message to All Guests ({guests.length} recipients)
        </FieldLabel>
        
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message to all guests..."
          className={cn(
            'w-full min-h-[120px] p-3 border rounded-lg resize-none',
            'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
            'placeholder:text-gray-400',
            error ? 'border-red-300 bg-red-50' : 'border-gray-300'
          )}
          maxLength={maxCharacters}
        />
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-500">
            {characterCount}/{maxCharacters} characters
          </div>
          
          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSend}
          disabled={!isValid || isSending}
          className="flex items-center gap-2"
        >
          {isSending ? (
            <>
              <LoadingSpinner size="sm" />
              Sending...
            </>
          ) : (
            'Send Message'
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
    </div>
  );
}
