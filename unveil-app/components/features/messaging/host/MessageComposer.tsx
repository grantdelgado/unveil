'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { GuestSelectionList } from './GuestSelectionList';
import { SendFlowModal } from './SendFlowModal';
import { MessageTypeSegmented } from './MessageTypeSegmented';
// HostInclusionToggle removed - hosts are always included now
import { useGuestSelection } from '@/hooks/messaging/useGuestSelection';
import {
  sendMessageToEvent,
  createScheduledMessage,
} from '@/lib/services/messaging';
import { supabase } from '@/lib/supabase/client';
import { formatEventDate } from '@/lib/utils/date';
import {
  toUTCFromEventZone,
  getTimezoneInfo,
  isValidTimezone,
} from '@/lib/utils/timezone';
import type { CreateScheduledMessageData } from '@/lib/types/messaging';

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
  onMessageScheduled?: () => void;
  onClear?: () => void;
  className?: string;
  preselectionPreset?: string | null;
  preselectedGuestIds?: string[];
}

export function MessageComposer({
  eventId,
  onMessageSent,
  onMessageScheduled,
  onClear,
  className,
  preselectionPreset,
  preselectedGuestIds,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [eventDetails, setEventDetails] = useState<{
    title: string;
    event_date: string;
    hostName: string;
    time_zone?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSendFlowModal, setShowSendFlowModal] = useState(false);

  // Message type selector state
  const [messageType, setMessageType] = useState<
    'announcement' | 'channel' | 'direct'
  >(() => {
    // Session-sticky default: Announcement on first load, then last used
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('unveil_last_message_type');
      if (stored && ['announcement', 'channel', 'direct'].includes(stored)) {
        return stored as 'announcement' | 'channel' | 'direct';
      }
    }
    return 'announcement'; // Default
  });

  // Selected tags for channel type
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Delivery mode state
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // includeHosts state removed - hosts are always included now

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
    error: guestsError,
    refresh: refreshGuests,
  } = useGuestSelection({
    eventId,
    preselectionPreset,
    preselectedGuestIds,
    // includeHosts removed - hosts are always included now
  });

  // TODO(grant): Removed useScheduledMessages hook from composer to eliminate unnecessary scheduled message fetches and realtime subscriptions.
  // Only History tab should load scheduled messages. Composer uses direct createScheduledMessage service call.

  const characterCount = message.length;
  const maxCharacters = 1000;
  const isValid = message.trim().length > 0 && characterCount <= maxCharacters;

  // Calculate minimum date/time (now + 5 minutes)
  const minDateTime = React.useMemo(() => {
    const now = new Date();
    const minTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
    return {
      date: minTime.toISOString().split('T')[0],
      time: minTime.toTimeString().slice(0, 5),
      datetime: minTime.toISOString(),
    };
  }, []);

  // Get event timezone info for display and validation
  const eventTimezoneInfo = React.useMemo(() => {
    if (!eventDetails?.time_zone || !isValidTimezone(eventDetails.time_zone)) {
      return null;
    }
    return getTimezoneInfo(eventDetails.time_zone);
  }, [eventDetails?.time_zone]);

  // Validation for scheduling
  const canSchedule = React.useMemo(() => {
    if (!isValid || selectedGuestIds.length === 0) return false;
    if (sendMode === 'now') return true;

    if (!scheduledDate || !scheduledTime) return false;

    // Check if scheduled time is in the future using event timezone
    if (eventDetails?.time_zone) {
      const utcTime = toUTCFromEventZone(
        scheduledDate,
        scheduledTime,
        eventDetails.time_zone,
      );
      if (!utcTime) return false;
      return new Date(utcTime) > new Date();
    } else {
      // Fallback to local time validation if no event timezone
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const now = new Date();
      return scheduledDateTime > now;
    }
  }, [
    isValid,
    selectedGuestIds.length,
    sendMode,
    scheduledDate,
    scheduledTime,
    eventDetails?.time_zone,
  ]);

  // Message type change handler with session storage
  const handleMessageTypeChange = (
    newType: 'announcement' | 'channel' | 'direct',
  ) => {
    setMessageType(newType);
    // Clear selections when switching types
    if (newType === 'announcement') {
      // For announcements, select all guests
      selectAllEligible();
    } else if (newType === 'channel') {
      // For channels, clear guest selection and reset tags
      clearAllSelection();
      setSelectedTags([]);
    } else {
      // For direct, clear selections to force manual selection
      clearAllSelection();
    }

    // Store in session for sticky behavior
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('unveil_last_message_type', newType);
    }
  };

  // Enhanced validation based on message type
  const canSend = useMemo(() => {
    if (!canSchedule) return false;

    switch (messageType) {
      case 'announcement':
        return true; // Always valid - targets everyone
      case 'channel':
        return selectedTags.length > 0; // Requires at least one tag
      case 'direct':
        return selectedGuestIds.length > 0; // Requires selected recipients
      default:
        return false;
    }
  }, [canSchedule, messageType, selectedTags.length, selectedGuestIds.length]);

  // Create preview data for confirmation modal
  const previewData = {
    guests: filteredGuests
      .filter((guest) => selectedGuestIds.includes(guest.id))
      .map((guest) => ({
        id: guest.id,
        displayName: guest.displayName,
        tags: guest.guest_tags || [],
        rsvpStatus: guest.declined_at ? 'declined' : 'pending',
        hasPhone: guest.hasValidPhone,
      })),
    totalCount: totalSelected,
    validRecipientsCount: willReceiveMessage,
    tagCounts: {},
    rsvpStatusCounts: {},
  };

  // Fetch event details for invitation template
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) return;

      try {
        const { data, error } = await supabase
          .from('events')
          .select(
            'title, event_date, time_zone, host:users!events_host_user_id_fkey(full_name)',
          )
          .eq('id', eventId)
          .single();

        if (error) throw error;
        setEventDetails({
          ...data,
          hostName:
            (data.host as { full_name?: string } | null)?.full_name ||
            'Your host',
          time_zone: data.time_zone || undefined,
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
    return 'Write your message to guests...';
  };

  const handleSend = () => {
    if (!canSend) return;
    setShowSendFlowModal(true);
  };

  const handleSendFlowSend = async (options: {
    sendViaPush: boolean;
    sendViaSms: boolean;
  }) => {
    if (sendMode === 'schedule') {
      return handleScheduleMessage(options);
    }
    return handleImmediateSend(options);
  };

  const handleImmediateSend = async (options: {
    sendViaPush: boolean;
    sendViaSms: boolean;
  }) => {
    try {
      // Check authentication first
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error(
          'You must be logged in to send messages. Please refresh the page and try again.',
        );
      }

      console.log('Sending message with explicit recipient selection:', {
        userId: user.id,
        selectedCount: selectedGuestIds.length,
        willReceive: willReceiveMessage,
        sendOptions: options,
      });

      // Use selected message type (server will validate/coerce)
      const finalMessageType =
        preselectionPreset === 'not_invited' ? 'invitation' : messageType;

      // Build request based on message type
      const sendRequest: Parameters<typeof sendMessageToEvent>[0] = {
        eventId,
        content: message.trim(),
        messageType: finalMessageType,
        sendVia: {
          sms: options.sendViaSms,
          email: false,
          push: options.sendViaPush,
        },
        // Type-specific recipient handling
        ...(messageType === 'announcement'
          ? {
              recipientFilter: { type: 'all' },
              recipientEventGuestIds: undefined,
            }
          : messageType === 'channel'
            ? {
                recipientFilter: { type: 'tags', tags: selectedTags },
                recipientEventGuestIds: undefined,
              }
            : {
                recipientFilter: { type: 'explicit_selection' },
                recipientEventGuestIds: selectedGuestIds,
              }),
      };

      const result = await sendMessageToEvent(sendRequest);

      if (!result.success) {
        const errorMessage =
          result.error &&
          typeof result.error === 'object' &&
          'message' in result.error
            ? (result.error as { message: string }).message
            : 'Failed to send message';
        return {
          success: false,
          sentCount: 0,
          failedCount: willReceiveMessage,
          error: errorMessage,
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
        messageId: result.data?.message?.id
          ? String(result.data.message.id)
          : undefined,
      };
    } catch (err) {
      console.error('Message send error:', err);
      return {
        success: false,
        sentCount: 0,
        failedCount: willReceiveMessage,
        error: err instanceof Error ? err.message : 'Failed to send message',
      };
    }
  };

  const handleScheduleMessage = async (options: {
    sendViaPush: boolean;
    sendViaSms: boolean;
  }) => {
    try {
      setIsScheduling(true);
      setError(null);

      const eventTimeZone = eventDetails?.time_zone;
      let scheduledAtUTC: string;
      const scheduledLocal = `${scheduledDate}T${scheduledTime}:00`;

      // Convert to UTC using event timezone if available
      if (eventTimeZone && isValidTimezone(eventTimeZone)) {
        const utcTime = toUTCFromEventZone(
          scheduledDate,
          scheduledTime,
          eventTimeZone,
        );
        if (!utcTime) {
          throw new Error(
            'Invalid scheduled time. Please check the date and time.',
          );
        }
        scheduledAtUTC = utcTime;
      } else {
        // Fallback to treating input as local time (not ideal but safe)
        scheduledAtUTC = new Date(scheduledLocal).toISOString();
      }

      // Generate idempotency key to prevent duplicate schedules
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `${eventId}_${selectedGuestIds.sort().join(',')}_${message.trim()}_${scheduledLocal}_${eventTimeZone || 'local'}`,
        ),
      );
      const idempotencyKey = Array.from(new Uint8Array(contentHash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const scheduleData: CreateScheduledMessageData = {
        eventId,
        content: message.trim(),
        sendAt: scheduledAtUTC,
        scheduledTz: eventTimeZone || undefined,
        scheduledLocal,
        idempotencyKey,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: selectedGuestIds,
        },
        messageType:
          preselectionPreset === 'not_invited'
            ? 'announcement'
            : 'announcement',
        sendViaSms: options.sendViaSms,
        sendViaPush: options.sendViaPush,
      };

      const result = await createScheduledMessage(scheduleData);

      if (!result.success) {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : 'Failed to schedule message';
        throw new Error(errorMessage);
      }

      // Success - clear form and notify parent
      setMessage('');
      setSendMode('now');
      setScheduledDate('');
      setScheduledTime('');
      clearAllSelection();
      setError(null);
      onMessageScheduled?.();

      return {
        success: true,
        sentCount: willReceiveMessage,
        failedCount: 0,
        messageId: undefined,
        // Include scheduled message data for success UI
        scheduledData: {
          id: result.data?.id,
          send_at: result.data?.send_at,
          scheduled_tz: result.data?.scheduled_tz,
          scheduled_local: result.data?.scheduled_local,
          recipient_count: result.data?.recipient_count,
        },
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to schedule message';
      setError(errorMessage);
      return {
        success: false,
        sentCount: 0,
        failedCount: willReceiveMessage,
        error: errorMessage,
      };
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCloseSendFlowModal = () => {
    setShowSendFlowModal(false);
  };

  const handleClear = () => {
    setMessage('');
    setSendMode('now');
    setScheduledDate('');
    setScheduledTime('');
    clearAllSelection(); // Clear guest selection
    setError(null);
    onClear?.();
  };

  return (
    <div
      className={cn('min-h-screen bg-gray-50', className)}
      style={{ minHeight: '100svh' }}
    >
      {/* Wider container for better desktop experience */}
      <div className="mx-auto max-w-[840px] sm:max-w-[960px] px-4 sm:px-6 py-6 space-y-4 sm:space-y-6">
        {/* Message Type Selector - Sticky at top */}
        <div className="sticky top-0 z-10 bg-gray-50 pb-4 px-2">
          <div className="bg-white rounded-lg border border-gray-200 p-4 w-full">
            <FieldLabel className="text-gray-700 font-medium mb-3">
              Message Type
            </FieldLabel>

            <MessageTypeSegmented
              value={messageType}
              onChange={handleMessageTypeChange}
            />
          </div>
        </div>

        {/* Audience Controls - Switch based on message type */}
        {messageType === 'announcement' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 w-full">
            <FieldLabel className="text-gray-700 font-medium mb-3">
              Audience
            </FieldLabel>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-800">
                <div className="font-medium mb-2">
                  📢 Everyone in this event
                </div>
                <div className="text-purple-700">
                  This announcement will be visible to all current guests and
                  anyone who joins later.
                </div>
                <div className="mt-2 font-medium">
                  Notified now (SMS): {willReceiveMessage} guests
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              No retro texts will be sent later.
            </div>
          </div>
        )}

        {messageType === 'channel' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 w-full">
            <FieldLabel className="text-gray-700 font-medium mb-3">
              Channel Tags
            </FieldLabel>

            {/* Tag Selector - Placeholder for now */}
            <div className="space-y-3">
              <div className="text-sm text-gray-600 mb-3">
                Select tags to target specific guest groups
              </div>

              {/* Simple tag input for now - can be enhanced later */}
              <div className="flex flex-wrap gap-2 mb-3">
                {['vip', 'family', 'friends', 'vendors'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags((prev) =>
                          prev.filter((t) => t !== tag),
                        );
                      } else {
                        setSelectedTags((prev) => [...prev, tag]);
                      }
                    }}
                    className={cn(
                      'px-3 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] touch-manipulation',
                      selectedTags.includes(tag)
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {selectedTags.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">
                      Selected tags: {selectedTags.join(', ')}
                    </div>
                    <div className="text-blue-700">
                      Currently notified via SMS: {willReceiveMessage} guests
                      with these tags
                    </div>
                    <div className="mt-1 text-blue-600">
                      Visibility in app will follow tags - adding a tag later
                      makes past channel messages visible.
                    </div>
                  </div>
                </div>
              )}

              {selectedTags.length === 0 && (
                <div className="text-sm text-gray-500 italic">
                  Select at least one tag to enable sending
                </div>
              )}
            </div>
          </div>
        )}

        {messageType === 'direct' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 w-full">
            {guestsError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-red-800 mb-2">
                      ❌ {guestsError}
                    </div>
                  </div>
                  <button
                    onClick={refreshGuests}
                    className="ml-3 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <>
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

                {selectedGuestIds.length > 50 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-sm text-amber-800">
                      💡 For large audiences, consider{' '}
                      <strong>Announcement</strong> or <strong>Channel</strong>{' '}
                      instead.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Advanced Options removed - hosts are always included now */}

        {/* Delivery Options */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <FieldLabel className="text-gray-700 font-medium mb-3">
            Delivery Options
          </FieldLabel>

          {/* Send Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setSendMode('now')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                sendMode === 'now'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              Send Now
            </button>
            <button
              type="button"
              onClick={() => setSendMode('schedule')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                sendMode === 'schedule'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              Schedule for Later
            </button>
          </div>

          {/* Schedule Date/Time Picker */}
          {sendMode === 'schedule' && (
            <div className="space-y-4">
              {eventTimezoneInfo && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">🌍 Event timezone:</span>{' '}
                  {eventTimezoneInfo.displayName} (
                  {eventTimezoneInfo.abbreviation})
                </div>
              )}

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base"
                  />
                </div>
              </div>

              {scheduledDate && scheduledTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">📅 Scheduled for:</div>
                    {eventTimezoneInfo ? (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium">Event time:</span>{' '}
                          {new Date(
                            `${scheduledDate}T${scheduledTime}`,
                          ).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}{' '}
                          {eventTimezoneInfo.abbreviation}
                        </div>
                        <div className="text-blue-600">
                          <span className="font-medium">Your time:</span>{' '}
                          {(() => {
                            const eventTimeZone = eventDetails?.time_zone;
                            if (eventTimeZone) {
                              const utcTime = toUTCFromEventZone(
                                scheduledDate,
                                scheduledTime,
                                eventTimeZone,
                              );
                              if (utcTime) {
                                return new Date(utcTime).toLocaleString([], {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                });
                              }
                            }
                            return new Date(
                              `${scheduledDate}T${scheduledTime}`,
                            ).toLocaleString();
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {new Date(
                          `${scheduledDate}T${scheduledTime}`,
                        ).toLocaleString()}
                        {!eventDetails?.time_zone && (
                          <span className="text-orange-600 ml-2">
                            (Event timezone not set)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
              error && error.includes('❌')
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300',
            )}
            maxLength={maxCharacters}
          />

          <div className="flex items-center justify-between mt-3">
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

        {/* Send Actions - Sticky bottom on mobile */}
        <div
          className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 -mb-6"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={!canSend || isScheduling}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-base"
              size="lg"
            >
              {isScheduling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <span>
                    {sendMode === 'now' ? 'Send Now' : 'Schedule Message'}
                  </span>
                  {willReceiveMessage > 0 && (
                    <span className="bg-white/20 px-2 py-1 rounded text-sm">
                      {willReceiveMessage}{' '}
                      {messageType === 'announcement'
                        ? 'guests'
                        : messageType === 'channel'
                          ? 'tag members'
                          : 'people'}
                    </span>
                  )}
                </>
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
          messageType={
            preselectionPreset === 'not_invited'
              ? 'invitation'
              : (messageType as 'announcement' | 'channel' | 'direct')
          }
          sendMode={sendMode}
          scheduledDate={scheduledDate}
          scheduledTime={scheduledTime}
          eventTimezone={eventDetails?.time_zone}
        />
      </div>
    </div>
  );
}
