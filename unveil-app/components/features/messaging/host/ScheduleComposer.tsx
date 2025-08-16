'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { RecipientSelector } from './RecipientSelector';
import { RecipientPreview } from './RecipientPreview';
import { useRecipientPreview } from '@/hooks/messaging/useRecipientPreview';
import { useScheduledMessages } from '@/hooks/messaging/useScheduledMessages';
import type { RecipientFilter, CreateScheduledMessageData } from '@/lib/types/messaging';

type MessageType = 'announcement' | 'reminder' | 'thank_you';

interface ScheduleComposerProps {
  eventId: string;
  onMessageScheduled?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Component for composing and scheduling messages for future delivery
 */
export function ScheduleComposer({
  eventId,
  onMessageScheduled,
  onCancel,
  className
}: ScheduleComposerProps) {
  // Message composition state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('announcement');
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>({ type: 'all' });
  
  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [sendViaPush, setSendViaPush] = useState(true);
  const [sendViaSms, setSendViaSms] = useState(false);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Hooks
  const { previewData, loading: previewLoading } = useRecipientPreview({
    eventId,
    filter: recipientFilter,
    debounceMs: 300
  });

  const { createScheduledMessage } = useScheduledMessages({ eventId });

  // Calculate minimum date/time (now + 5 minutes)
  const minDateTime = useMemo(() => {
    const now = new Date();
    const minTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    return {
      date: minTime.toISOString().split('T')[0],
      time: minTime.toTimeString().slice(0, 5),
      datetime: minTime.toISOString()
    };
  }, []);

  // Validation
  const canSchedule = useMemo(() => {
    if (!message.trim()) return false;
    if (!scheduledDate || !scheduledTime) return false;
    if (!sendViaPush && !sendViaSms) return false;
    if ((previewData?.validRecipientsCount || 0) === 0) return false;
    
    // Check if scheduled time is in the future
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    if (scheduledDateTime <= now) return false;
    
    return true;
  }, [message, scheduledDate, scheduledTime, sendViaPush, sendViaSms, previewData]);

  const validRecipientCount = previewData?.validRecipientsCount || 0;
  const totalCount = previewData?.totalCount || 0;
  const skippedCount = totalCount - validRecipientCount;

  const getMessageTypeEmoji = () => {
    switch (messageType) {
      case 'reminder': return '📧';
      case 'thank_you': return '🎉';
      default: return '📢';
    }
  };

  const getScheduledDateTime = () => {
    if (!scheduledDate || !scheduledTime) return null;
    return new Date(`${scheduledDate}T${scheduledTime}`);
  };

  const getTimeUntilSend = () => {
    const scheduledDateTime = getScheduledDateTime();
    if (!scheduledDateTime) return null;
    
    const now = new Date();
    const diffMs = scheduledDateTime.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Past time';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}, ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffHours > 0) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}, ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  };

  const handleSchedule = async () => {
    if (!canSchedule) return;

    setIsScheduling(true);
    setError(null);

    try {
      const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`;
      
      const scheduleData: CreateScheduledMessageData = {
        eventId,
        content: message.trim(),
        sendAt: scheduledDateTime,
        recipientFilter,
        messageType: messageType === 'reminder' ? 'announcement' : messageType as any,
        sendViaSms,
        sendViaEmail: false,
        sendViaPush
      };

      const result = await createScheduledMessage(scheduleData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to schedule message');
      }

      // Success - clear form and notify parent
      setMessage('');
      setScheduledDate('');
      setScheduledTime('');
      setRecipientFilter({ type: 'all' });
      setError(null);
      onMessageScheduled?.();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule message');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleClear = () => {
    setMessage('');
    setMessageType('announcement');
    setRecipientFilter({ type: 'all' });
    setScheduledDate('');
    setScheduledTime('');
    setError(null);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <div className="text-3xl mb-2">⏰</div>
        <h2 className="text-xl font-semibold text-gray-900">
          Schedule Message
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Compose and schedule a message for future delivery
        </p>
      </div>

      {/* Message Type Selection */}
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-2">
          Message Type
        </FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setMessageType('announcement')}
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
            onClick={() => setMessageType('reminder')}
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
            onClick={() => setMessageType('thank_you')}
            className={cn(
              'p-3 text-left border rounded-lg transition-colors',
              messageType === 'thank_you'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <div className="text-lg mb-1">🎉</div>
            <div className="text-sm font-medium">Thank You</div>
            <div className="text-xs text-gray-500">Post-event thanks</div>
          </button>
        </div>
      </div>

      {/* Recipient Selection */}
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-2">
          Recipients
        </FieldLabel>
        <RecipientSelector
          eventId={eventId}
          filter={recipientFilter}
          onFilterChange={setRecipientFilter}
        />
      </div>

      {/* Recipient Preview */}
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-2">
          Message Recipients
        </FieldLabel>
        <RecipientPreview
          previewData={previewData}
          loading={previewLoading}
          error={null}
        />
      </div>

      {/* Delivery Schedule */}
      <div className="space-y-4">
        <FieldLabel className="text-gray-700 font-medium">
          ⏰ Schedule Delivery
        </FieldLabel>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={minDateTime.date}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        {scheduledDate && scheduledTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-800">
              <span className="font-medium">📅 Scheduled for:</span> {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
              <br />
              <span className="font-medium">⏳ Delivery:</span> {getTimeUntilSend()}
            </div>
          </div>
        )}
      </div>

      {/* Delivery Method Selection */}
      <div>
        <FieldLabel className="text-gray-700 font-medium mb-3">
          📱 Delivery Method
        </FieldLabel>
        <div className="space-y-3">
          <label className={cn(
            "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
            sendViaPush ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
          )}>
            <input
              type="checkbox"
              checked={sendViaPush}
              onChange={(e) => setSendViaPush(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Push Notification</div>
              <div className="text-xs text-gray-500">Instant delivery, works in app</div>
            </div>
            <span className="text-lg">🔔</span>
          </label>

          <label className={cn(
            "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
            sendViaSms ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
          )}>
            <input
              type="checkbox"
              checked={sendViaSms}
              onChange={(e) => setSendViaSms(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">SMS Text Message</div>
              <div className="text-xs text-gray-500">Universal delivery, works everywhere</div>
            </div>
            <span className="text-lg">💬</span>
          </label>
        </div>

        {!sendViaPush && !sendViaSms && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            ❌ Please select at least one delivery method
          </div>
        )}
      </div>

      {/* Message Content */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel className="text-gray-700 font-medium">
            💬 Message Content
          </FieldLabel>
          <span className={cn(
            'text-xs',
            message.length > 900 ? 'text-red-600' : 'text-gray-500'
          )}>
            {message.length}/1000
          </span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Write your scheduled message here..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
        />
      </div>

      {/* Summary */}
      {validRecipientCount > 0 && scheduledDate && scheduledTime && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-900 mb-2">📊 Scheduling Summary</h3>
          <div className="space-y-1 text-sm text-purple-800">
            <div className="flex justify-between">
              <span>Message type:</span>
              <span className="font-medium">{getMessageTypeEmoji()} {messageType}</span>
            </div>
            <div className="flex justify-between">
              <span>Recipients:</span>
              <span className="font-medium">{validRecipientCount} guests</span>
            </div>
            {skippedCount > 0 && (
              <div className="flex justify-between text-orange-700">
                <span>Excluded:</span>
                <span className="font-medium">{skippedCount} guests</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Delivery:</span>
              <span className="font-medium">{getTimeUntilSend()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">
            <span className="font-medium">❌ Error:</span> {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel || handleClear}
          disabled={isScheduling}
          className="flex-1"
        >
          {onCancel ? 'Cancel' : 'Clear'}
        </Button>
        
        <Button
          onClick={handleSchedule}
          disabled={!canSchedule || isScheduling}
          className="flex-1"
        >
          {isScheduling ? (
            <>
              <LoadingSpinner size="sm" />
              Scheduling...
            </>
          ) : (
            <>
              <span>Schedule Message</span>
              {validRecipientCount > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs ml-2">
                  {validRecipientCount}
                </span>
              )}
            </>
          )}
        </Button>
      </div>

      {/* Footer Note */}
      <div className="text-center">
        <div className="text-xs text-gray-500">
          Scheduled messages will be delivered automatically at the specified time
        </div>
      </div>
    </div>
  );
}
