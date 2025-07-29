'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/common';
import { Calendar, Clock, Users, Send, Plus } from 'lucide-react';
// Note: Message scheduling now handled via useMessages domain hook
import type { Database } from '@/app/reference/supabase.types';

type MessageType = Database['public']['Enums']['message_type_enum'];
type EventGuest = Database['public']['Tables']['event_guests']['Row'];

interface MessageSchedulerProps {
  eventId: string;
  guests: EventGuest[];
  onScheduleSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface RecipientTarget {
  type: 'all' | 'specific' | 'tags';
  guestIds?: string[];
  tags?: string[];
}

interface DeliveryMethods {
  sms: boolean;
  push: boolean;
  email: boolean;
}

export function MessageScheduler({
  eventId,
  guests,
  onScheduleSuccess,
  onCancel,
  className
}: MessageSchedulerProps) {
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('announcement');
  const [sendDate, setSendDate] = useState('');
  const [sendTime, setSendTime] = useState('');
  const [recipientTarget, setRecipientTarget] = useState<RecipientTarget>({ type: 'all' });
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethods>({
    sms: true,
    push: true,
    email: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { triggerHaptic } = useHapticFeedback();

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSendDate(tomorrow.toISOString().split('T')[0]);
    setSendTime('10:00');
  }, []);

  // Get available tags from guests
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    guests.forEach(guest => {
      guest.guest_tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [guests]);

  // Calculate recipient count
  const recipientCount = useMemo(() => {
    switch (recipientTarget.type) {
      case 'all':
        return guests.length;
      case 'specific':
        return recipientTarget.guestIds?.length || 0;
      case 'tags':
        if (!recipientTarget.tags?.length) return 0;
        return guests.filter(guest => 
          guest.guest_tags?.some(tag => recipientTarget.tags?.includes(tag))
        ).length;
      default:
        return 0;
    }
  }, [recipientTarget, guests]);

  const handleScheduleMessage = useCallback(async () => {
    // Validation
    if (!content.trim()) {
      setError('Please enter a message');
      triggerHaptic('warning');
      return;
    }

    if (!sendDate || !sendTime) {
      setError('Please select a date and time');
      triggerHaptic('warning');
      return;
    }

    if (recipientCount === 0) {
      setError('Please select at least one recipient');
      triggerHaptic('warning');
      return;
    }

    if (!deliveryMethods.sms && !deliveryMethods.push && !deliveryMethods.email) {
      setError('Please select at least one delivery method');
      triggerHaptic('warning');
      return;
    }

    // Combine date and time
    const sendDateTime = new Date(`${sendDate}T${sendTime}`);
    if (sendDateTime <= new Date()) {
      setError('Please select a future date and time');
      triggerHaptic('warning');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scheduledMessageData: CreateScheduledMessageData = {
        eventId,
        content: content.trim(),
        subject: subject.trim() || undefined,
        messageType,
        sendAt: sendDateTime,
        targetAllGuests: recipientTarget.type === 'all',
        targetGuestIds: recipientTarget.type === 'specific' ? recipientTarget.guestIds : undefined,
        targetGuestTags: recipientTarget.type === 'tags' ? recipientTarget.tags : undefined,
        sendViaSms: deliveryMethods.sms,
        sendViaPush: deliveryMethods.push,
        sendViaEmail: deliveryMethods.email
      };

      await createScheduledMessage(scheduledMessageData);

      // Reset form
      setContent('');
      setSubject('');
      setRecipientTarget({ type: 'all' });
      setError(null);
      
      triggerHaptic('success');
      onScheduleSuccess?.();

    } catch (err) {
      console.error('Error scheduling message:', err);
      setError('Failed to schedule message. Please try again.');
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  }, [
    content, subject, messageType, sendDate, sendTime, 
    recipientTarget, deliveryMethods, recipientCount, 
    eventId, onScheduleSuccess, triggerHaptic
  ]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Schedule Message</h2>
          <p className="text-sm text-gray-600">Send a message at a specific date and time</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">❌</span>
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="subject">
            Subject (Optional)
          </FieldLabel>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter message subject..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={100}
          />
        </div>

        <div>
          <FieldLabel htmlFor="content" required>
            Message Content
          </FieldLabel>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your message..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-gray-500">
              Maximum 500 characters
            </div>
            <div className={cn(
              'text-xs',
              content.length > 400 ? 'text-red-600' : 'text-gray-500'
            )}>
              {content.length}/500
            </div>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="messageType">
            Message Type
          </FieldLabel>
          <select
            id="messageType"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as MessageType)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="announcement">Announcement</option>
            <option value="direct">Direct Message</option>
            <option value="channel">Channel Message</option>
          </select>
        </div>
      </div>

      {/* Scheduling */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-600" />
          <FieldLabel className="mb-0">Send Date & Time</FieldLabel>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sendDate" className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              id="sendDate"
              type="date"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="sendTime" className="block text-sm font-medium text-gray-700 mb-2">
              Time
            </label>
            <input
              id="sendTime"
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-gray-600" />
          <FieldLabel className="mb-0">Recipients ({recipientCount} guests)</FieldLabel>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="recipientType"
              checked={recipientTarget.type === 'all'}
              onChange={() => setRecipientTarget({ type: 'all' })}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium">All Guests ({guests.length})</span>
          </label>

          {availableTags.length > 0 && (
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="recipientType"
                checked={recipientTarget.type === 'tags'}
                onChange={() => setRecipientTarget({ type: 'tags', tags: [] })}
                className="w-4 h-4 text-blue-600 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">By Tags</span>
                {recipientTarget.type === 'tags' && (
                  <div className="mt-2 space-y-2">
                    {availableTags.map(tag => (
                      <label key={tag} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={recipientTarget.tags?.includes(tag) || false}
                          onChange={(e) => {
                            const tags = recipientTarget.tags || [];
                            if (e.target.checked) {
                              setRecipientTarget({ 
                                type: 'tags', 
                                tags: [...tags, tag] 
                              });
                            } else {
                              setRecipientTarget({ 
                                type: 'tags', 
                                tags: tags.filter(t => t !== tag) 
                              });
                            }
                          }}
                          className="w-3 h-3 text-blue-600"
                        />
                        <span className="text-xs text-gray-600">{tag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Delivery Methods */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-gray-600" />
          <FieldLabel className="mb-0">Delivery Methods</FieldLabel>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={deliveryMethods.sms}
              onChange={(e) => setDeliveryMethods(prev => ({
                ...prev, 
                sms: e.target.checked
              }))}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium">SMS</span>
            <span className="text-xs text-gray-500">(Recommended)</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={deliveryMethods.push}
              onChange={(e) => setDeliveryMethods(prev => ({
                ...prev, 
                push: e.target.checked
              }))}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium">Push Notification</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={deliveryMethods.email}
              onChange={(e) => setDeliveryMethods(prev => ({
                ...prev, 
                email: e.target.checked
              }))}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium">Email</span>
            <span className="text-xs text-gray-500">(Coming soon)</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleScheduleMessage}
          disabled={loading || !content.trim() || recipientCount === 0}
          className="flex-1"
        >
          {loading ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Schedule Message
        </Button>

        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
} 