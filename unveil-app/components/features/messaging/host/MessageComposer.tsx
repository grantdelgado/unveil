'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';
import { sendMessageToEvent } from '@/lib/services/messaging';

type Guest = Database['public']['Tables']['event_guests']['Row'];

type MessageType = 'announcement' | 'reminder';
type RecipientFilterType = 'all' | 'pending_rsvp';

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
  const [messageType, setMessageType] = useState<MessageType>('announcement');
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilterType>('all');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRichTextMode, setIsRichTextMode] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;

  // Calculate recipient count based on filter
  const recipientCount = useMemo(() => {
    if (recipientFilter === 'pending_rsvp') {
      return guests.filter(guest => !guest.rsvp_status || guest.rsvp_status === 'pending').length;
    }
    return guests.length;
  }, [guests, recipientFilter]);

  // Message templates based on type
  const getPlaceholderText = () => {
    if (messageType === 'reminder') {
      return "Hi! Just a friendly reminder to RSVP for our upcoming event. We're excited to celebrate with you!";
    }
    return "Write your message to guests...";
  };

  const handleSend = async () => {
    if (!isValid || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      // Convert our UI filter to the service format
      const serviceRecipientFilter = recipientFilter === 'pending_rsvp' 
        ? { type: 'rsvp_status' as const, rsvpStatuses: ['pending'] }
        : { type: 'all' as const };

      await sendMessageToEvent({
        eventId,
        content: message.trim(),
        recipientFilter: serviceRecipientFilter,
        messageType: messageType === 'reminder' ? 'announcement' : messageType,
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
    setMessageType('announcement');
    setRecipientFilter('all');
    setIsScheduled(false);
    setScheduledDate('');
    setScheduledTime('');
    setIsRichTextMode(false);
    setError(null);
    onClear?.();
  };

  const handleUseTemplate = () => {
    setMessage(getPlaceholderText());
  };

  // Rich text formatting functions
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
    <div className={cn('space-y-4', className)}>
      {/* Message Type and Recipient Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel className="text-gray-700 font-medium mb-2">
            Message Type
          </FieldLabel>
          <select
            value={messageType}
            onChange={(e) => {
              const newType = e.target.value as MessageType;
              setMessageType(newType);
              // Auto-select pending RSVPs for reminders
              if (newType === 'reminder') {
                setRecipientFilter('pending_rsvp');
              }
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="announcement">📢 Announcement</option>
            <option value="reminder">📧 RSVP Reminder</option>
          </select>
        </div>
        
        <div>
          <FieldLabel className="text-gray-700 font-medium mb-2">
            Send To
          </FieldLabel>
          <select
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value as RecipientFilterType)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">👥 All Guests ({guests.length})</option>
            <option value="pending_rsvp">
              ⏰ Pending RSVPs ({guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length})
            </option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel className="text-gray-700 font-medium">
            Message ({recipientCount} recipients)
          </FieldLabel>
          <div className="flex items-center gap-2">
            {messageType === 'reminder' && (
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
            error ? 'border-red-300 bg-red-50' : 'border-gray-300',
            isRichTextMode && 'font-mono text-sm'
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

              {/* Delivery Scheduling - Optional Feature */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              id="schedule-message"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="schedule-message" className="text-sm font-medium text-gray-700">
              📅 Schedule for later
            </label>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              MVP Feature
            </span>
          </div>
          
          {isScheduled && (
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full p-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="col-span-2 text-xs text-purple-700">
                💡 Scheduled messages will be sent automatically at the specified time
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSend}
            disabled={!isValid || isSending || (isScheduled && (!scheduledDate || !scheduledTime))}
            className="flex items-center gap-2"
          >
            {isSending ? (
              <>
                <LoadingSpinner size="sm" />
                {isScheduled ? 'Scheduling...' : 'Sending...'}
              </>
            ) : (
              isScheduled ? 'Schedule Message' : 'Send Now'
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
