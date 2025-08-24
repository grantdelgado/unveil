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
import { updateScheduledMessage } from '@/lib/services/messaging-client';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];
import { supabase } from '@/lib/supabase/client';
import { formatEventDate } from '@/lib/utils/date';
import { logger } from '@/lib/logger';
import {
  toUTCFromEventZone,
  getTimezoneInfo,
  isValidTimezone,
  fromUTCToEventZone,
} from '@/lib/utils/timezone';
import {
  getNextValidScheduleTime,
  formatMinLeadTime,
} from '@/config/schedule';
import {
  MIN_SCHEDULE_BUFFER_MINUTES,
  QUICK_SET_BUFFER_MINUTES,
  addMinutes,
  roundUpToMinute,
} from '@/lib/constants/scheduling';
import { scheduledMessageSchema } from '@/lib/validations';
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
  onMessageUpdated?: () => void;
  onClear?: () => void;
  className?: string;
  preselectionPreset?: string | null;
  preselectedGuestIds?: string[];
  editingMessage?: ScheduledMessage | null;
}

export function MessageComposer({
  eventId,
  onMessageSent,
  onMessageScheduled,
  onMessageUpdated,
  onClear,
  className,
  preselectionPreset,
  preselectedGuestIds,
  editingMessage,
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
  
  // Track unsaved changes in edit mode (for future navigation guard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showTypeChangeConfirm, setShowTypeChangeConfirm] = useState(false);
  const [pendingMessageType, setPendingMessageType] = useState<'announcement' | 'channel' | 'direct' | null>(null);

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

  // Real-time clock for continuous validation
  const [nowUtc, setNowUtc] = useState(() => new Date());
  
  useEffect(() => {
    // Only run the clock when scheduler is visible
    if (sendMode !== 'schedule') return;
    
    const id = setInterval(() => setNowUtc(new Date()), 1000);
    const onVis = () => document.visibilityState === 'visible' && setNowUtc(new Date());
    document.addEventListener('visibilitychange', onVis);
    
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sendMode]);

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
    setSelectedGuestIds,
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

  // Calculate minimum date/time (now + buffer) in event timezone
  const minDateTime = React.useMemo(() => {
    const now = new Date();
    const minTime = new Date(now.getTime() + MIN_SCHEDULE_BUFFER_MINUTES * 60000);
    
    // Use event timezone for date calculation if available, otherwise fall back to local time
    let minDate: string;
    if (eventDetails?.time_zone && isValidTimezone(eventDetails.time_zone)) {
      // Get current date in event timezone
      const eventTimeFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: eventDetails.time_zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      minDate = eventTimeFormatter.format(now);
    } else {
      // Fallback to local timezone
      minDate = minTime.toISOString().split('T')[0];
    }
    
    return {
      date: minDate,
      time: minTime.toTimeString().slice(0, 5),
      datetime: minTime.toISOString(),
    };
  }, [eventDetails?.time_zone]);

  // Get event timezone info for display and validation
  const eventTimezoneInfo = React.useMemo(() => {
    if (!eventDetails?.time_zone || !isValidTimezone(eventDetails.time_zone)) {
      return null;
    }
    return getTimezoneInfo(eventDetails.time_zone);
  }, [eventDetails?.time_zone]);

  // Compute minimum allowed UTC time (now + MIN_SCHEDULE_BUFFER_MINUTES)
  const minAllowedUtc = React.useMemo(() => {
    return addMinutes(nowUtc, MIN_SCHEDULE_BUFFER_MINUTES);
  }, [nowUtc]);

  // Derive scheduledAtUtc from inputs using existing helpers
  const scheduledAtUtc = React.useMemo(() => {
    if (!scheduledDate || !scheduledTime) return null;

    // Convert to UTC using event timezone if available
    if (eventDetails?.time_zone && isValidTimezone(eventDetails.time_zone)) {
      const utcTime = toUTCFromEventZone(
        scheduledDate,
        scheduledTime,
        eventDetails.time_zone,
      );
      return utcTime ? new Date(utcTime) : null;
    } else {
      // Fallback to treating input as local time
      return new Date(`${scheduledDate}T${scheduledTime}:00`);
    }
  }, [scheduledDate, scheduledTime, eventDetails?.time_zone]);

  // Real-time validation that updates as time passes
  const scheduleValidation = React.useMemo(() => {
    if (sendMode === 'now') {
      // For "Send Now", just check basic message validity - recipient validation is handled in canSend
      return { canSchedule: isValid, error: null, isTooSoon: false };
    }

    if (!isValid) {
      return { canSchedule: false, error: null, isTooSoon: false };
    }

    // Check recipient requirements based on message type
    const hasValidRecipients = 
      messageType === 'announcement' || // Announcements don't need selected recipients
      (messageType === 'direct' && selectedGuestIds.length > 0) ||
      (messageType === 'channel' && selectedTags.length > 0);

    if (!hasValidRecipients) {
      return { canSchedule: false, error: null, isTooSoon: false };
    }

    if (!scheduledDate || !scheduledTime || !scheduledAtUtc) {
      return { canSchedule: false, error: null, isTooSoon: false };
    }

    // Real-time check: is the scheduled time too soon?
    const isTooSoon = scheduledAtUtc < minAllowedUtc;
    
    if (isTooSoon) {
      return { 
        canSchedule: false, 
        error: 'too_soon',
        isTooSoon: true,
        minLeadTime: formatMinLeadTime(),
        nextValidTime: getNextValidScheduleTime(nowUtc),
        scheduledAtUtc,
        minAllowedUtc
      };
    }

    return { canSchedule: true, error: null, isTooSoon: false, scheduledAtUtc };
  }, [
    isValid,
    selectedGuestIds.length,
    sendMode,
    scheduledDate,
    scheduledTime,
    scheduledAtUtc,
    minAllowedUtc,
    nowUtc,
    messageType,
    selectedTags.length,
  ]);

  const canSchedule = scheduleValidation.canSchedule;

  // Message type change handler with edit mode confirmation
  const handleMessageTypeChange = (newType: 'announcement' | 'channel' | 'direct') => {
    if (editingMessage && messageType !== newType) {
      // Show confirmation for type change in edit mode
      setPendingMessageType(newType);
      setShowTypeChangeConfirm(true);
    } else {
      // Normal type change for new messages
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

  // Prefill composer when editing a scheduled message
  useEffect(() => {
    if (editingMessage && eventDetails) {
      setMessage(editingMessage.content);
      setMessageType(editingMessage.message_type as 'announcement' | 'channel' | 'direct');
      setSendMode('schedule');
      
      // Convert UTC send_at back to local timezone
      const sendTime = new Date(editingMessage.send_at);
      const eventTimezone = eventDetails.time_zone || 'UTC';
      
      // Format date and time for inputs
      const localDateTime = sendTime.toLocaleString('sv-SE', { 
        timeZone: eventTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const [datePart, timePart] = localDateTime.split(' ');
      setScheduledDate(datePart);
      setScheduledTime(timePart);
      
      // Restore audience selection based on message targeting (idempotent)
      if (editingMessage.target_all_guests) {
        selectAllEligible();
      } else if (editingMessage.target_guest_ids && editingMessage.target_guest_ids.length > 0) {
        // For Direct messages, restore exact recipient selection (no async/toggle)
        setSelectedGuestIds(editingMessage.target_guest_ids);
      } else {
        // Empty target_guest_ids means empty selection (no auto-expand to "all")
        clearAllSelection();
      }
      
      // Set tags for channel messages
      if (editingMessage.message_type === 'channel' && editingMessage.target_guest_tags) {
        setSelectedTags(editingMessage.target_guest_tags);
      }
    }
  }, [editingMessage, eventDetails, selectAllEligible, setSelectedGuestIds, clearAllSelection]);

  // Set default invitation message based on preselection
  useEffect(() => {
    if (preselectionPreset === 'not_invited' && eventDetails && !message && !editingMessage) {
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
  }, [preselectionPreset, eventDetails, eventId, message, editingMessage]);

  // Track unsaved changes in edit mode
  useEffect(() => {
    if (editingMessage) {
      const hasContentChanged = message.trim() !== editingMessage.content.trim();
      const hasTypeChanged = messageType !== editingMessage.message_type;
      const hasTimingChanged = scheduledDate !== '' || scheduledTime !== '';
      const hasAudienceChanged = 
        (messageType === 'direct' && JSON.stringify(selectedGuestIds.sort()) !== JSON.stringify(editingMessage.target_guest_ids?.sort() || [])) ||
        (messageType === 'channel' && JSON.stringify(selectedTags.sort()) !== JSON.stringify(editingMessage.target_guest_tags?.sort() || [])) ||
        (messageType === 'announcement' && !editingMessage.target_all_guests);
      
      setHasUnsavedChanges(hasContentChanged || hasTypeChanged || hasTimingChanged || hasAudienceChanged);
    }
  }, [editingMessage, message, messageType, scheduledDate, scheduledTime, selectedGuestIds, selectedTags]);



  const confirmTypeChange = () => {
    if (pendingMessageType) {
      setMessageType(pendingMessageType);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('unveil_last_message_type', pendingMessageType);
      }
      
      // Reset audience selection based on new type
      if (pendingMessageType === 'announcement') {
        selectAllEligible();
      } else {
        clearAllSelection();
      }
      
      setPendingMessageType(null);
      setShowTypeChangeConfirm(false);
    }
  };

  const cancelTypeChange = () => {
    setPendingMessageType(null);
    setShowTypeChangeConfirm(false);
  };

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

      // Defense in UI: early return if time is too soon
      if (scheduleValidation.isTooSoon) {
        throw new Error(`Cannot schedule messages less than ${MIN_SCHEDULE_BUFFER_MINUTES} minutes from now. Please select a later time.`);
      }

      // If editing an existing message, use update flow
      if (editingMessage) {
        return handleUpdateMessage(options);
      }

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

      // Debug log for observability (dev-only)
      if (process.env.NODE_ENV === 'development') {
        console.log('Schedule Debug Info:', {
          eventTimezone: eventTimeZone,
          localNow: new Date().toISOString(),
          selectedDateTime: scheduledLocal,
          selectedDateTimeUTC: scheduledAtUTC,
          minAllowedUTC: minAllowedUtc.toISOString(),
        });
      }

      // Client-side Zod validation
      const validationResult = scheduledMessageSchema.safeParse({
        content: message.trim(),
        scheduledAtUtc: scheduledAtUTC,
        eventId,
        messageType: preselectionPreset === 'not_invited' ? 'announcement' : 'announcement',
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
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
        // Type-specific recipient handling (same as Send Now path)
        recipientFilter:
          messageType === 'announcement'
            ? { type: 'all' }
            : messageType === 'channel'
              ? { type: 'tags', tags: selectedTags }
              : { type: 'explicit_selection', selectedGuestIds: selectedGuestIds },
        messageType:
          preselectionPreset === 'not_invited'
            ? 'announcement'
            : messageType,
        sendViaSms: options.sendViaSms,
        sendViaPush: options.sendViaPush,
      };

      const result = await createScheduledMessage(scheduleData);

      if (!result.success) {
        // Handle SCHEDULE_TOO_SOON error from server
        if (result.error && typeof result.error === 'object' && 'code' in result.error && result.error.code === 'SCHEDULE_TOO_SOON') {
          throw new Error(`Cannot schedule messages less than ${MIN_SCHEDULE_BUFFER_MINUTES} minutes from now. Please select a later time.`);
        }
        
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : typeof result.error === 'object' && result.error && 'message' in result.error
            ? String(result.error.message)
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

  const handleUpdateMessage = async (options: {
    sendViaPush: boolean;
    sendViaSms: boolean;
  }) => {
    if (!editingMessage) {
      throw new Error('No message to update');
    }

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
      // Fallback to treating input as local time
      scheduledAtUTC = new Date(scheduledLocal).toISOString();
    }

    // Log audience counts before update (PII-safe)
    const audienceCountBefore = editingMessage.target_all_guests 
      ? -1 // Special marker for "all guests"
      : (editingMessage.target_guest_ids?.length || 0);
    const audienceCountAfter = messageType === 'announcement' 
      ? -1 // Special marker for "all guests"
      : (messageType === 'direct' ? selectedGuestIds.length : selectedTags.length);

    const updateData = {
      content: message.trim(),
      sendAt: scheduledAtUTC,
      messageType: messageType,
      targetAllGuests: messageType === 'announcement',
      targetGuestIds: messageType === 'direct' ? selectedGuestIds : undefined,
      targetGuestTags: messageType === 'channel' ? selectedTags : undefined,
      sendViaSms: options.sendViaSms,
      sendViaPush: options.sendViaPush,
    };

    const result = await updateScheduledMessage(editingMessage.id, updateData);

    if (!result.success) {
      const errorMsg = typeof result.error === 'object' && result.error && 'message' in result.error 
        ? (result.error as { message: string }).message 
        : 'Failed to update message';
      throw new Error(errorMsg);
    }

    // Log successful modify (PII-safe)
    const now = new Date();
    const newSendTime = new Date(scheduledAtUTC);
    const sendAtDeltaSeconds = Math.floor((newSendTime.getTime() - now.getTime()) / 1000);
    const originalSendTime = new Date(editingMessage.send_at);
    const timingChanged = Math.abs(newSendTime.getTime() - originalSendTime.getTime()) > 60000; // 1 minute threshold
    
    logger.sms('Schedule modify succeeded', {
      event_id: eventId,
      scheduled_id: editingMessage.id,
      composer_mode: 'editScheduled',
      audience_selected_count_before: audienceCountBefore,
      audience_selected_count_after: audienceCountAfter,
      send_at_delta_seconds: sendAtDeltaSeconds,
      content_length: message.trim().length,
      content_changed: message.trim() !== editingMessage.content,
      timing_changed: timingChanged,
      audience_changed: JSON.stringify(updateData.targetGuestIds) !== JSON.stringify(editingMessage.target_guest_ids),
      message_type: updateData.messageType,
      action: 'updateSchedule',
      qa_hardening_completed: true, // One-time breadcrumb for QA hardening
    });

    // Clear form and notify parent
    setMessage('');
    setSendMode('now');
    setScheduledDate('');
    setScheduledTime('');
    clearAllSelection();
    setError(null);
    onMessageUpdated?.();

    return {
      success: true,
      sentCount: willReceiveMessage,
      failedCount: 0,
      messageId: editingMessage.id,
    };
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
                  isEditMode={!!editingMessage}
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

          {/* Send Mode Toggle - Hidden in edit mode */}
          {!editingMessage && (
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
          )}

          {/* Edit mode indicator */}
          {editingMessage && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800 font-medium">
                📝 Editing scheduled message
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Delivery mode is locked to scheduled time
              </div>
            </div>
          )}

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

              {/* Helper message for minimum lead time validation */}
              {scheduleValidation.isTooSoon && scheduledDate && scheduledTime && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3" aria-live="polite">
                  <div className="text-sm text-orange-800">
                    <div className="font-medium mb-2">⏰ Pick a time at least {MIN_SCHEDULE_BUFFER_MINUTES} minutes from now.</div>
                    <div className="space-y-1 text-orange-700">
                      <div>
                        <span className="font-medium">Event time:</span>{' '}
                        {eventTimezoneInfo ? (
                          <>
                            {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}{' '}
                            {eventTimezoneInfo.abbreviation}
                          </>
                        ) : (
                          new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()
                        )}
                      </div>
                      <div>
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
                          return new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString();
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          // Compute target time: round up to next minute after adding QUICK_SET_BUFFER_MINUTES
                          const targetUtc = roundUpToMinute(addMinutes(nowUtc, QUICK_SET_BUFFER_MINUTES));
                          
                          if (eventDetails?.time_zone) {
                            const eventTime = fromUTCToEventZone(
                              targetUtc.toISOString(),
                              eventDetails.time_zone
                            );
                            if (eventTime) {
                              setScheduledDate(eventTime.date);
                              setScheduledTime(eventTime.time);
                            }
                          } else {
                            // Fallback to local time
                            const localDate = targetUtc.toISOString().split('T')[0];
                            const localTime = targetUtc.toTimeString().slice(0, 5);
                            setScheduledDate(localDate);
                            setScheduledTime(localTime);
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-md transition-colors"
                      >
                        Use 5 minutes from now
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendMode('now')}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                      >
                        Send now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {scheduledDate && scheduledTime && !scheduleValidation.isTooSoon && scheduledAtUtc && (
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
                          {scheduledAtUtc.toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </div>
                        <div className="text-blue-500 text-xs">
                          {(() => {
                            const diffMs = scheduledAtUtc.getTime() - nowUtc.getTime();
                            const diffMinutes = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMinutes / 60);
                            const remainingMinutes = diffMinutes % 60;
                            
                            if (diffHours > 0) {
                              return `in ${diffHours}h ${remainingMinutes}m`;
                            } else if (diffMinutes > 0) {
                              return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
                            } else {
                              return 'sending soon';
                            }
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div>
                          {scheduledAtUtc.toLocaleString()}
                          {!eventDetails?.time_zone && (
                            <span className="text-orange-600 ml-2">
                              (Event timezone not set)
                            </span>
                          )}
                        </div>
                        <div className="text-blue-500 text-xs mt-1">
                          {(() => {
                            const diffMs = scheduledAtUtc.getTime() - nowUtc.getTime();
                            const diffMinutes = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMinutes / 60);
                            const remainingMinutes = diffMinutes % 60;
                            
                            if (diffHours > 0) {
                              return `in ${diffHours}h ${remainingMinutes}m`;
                            } else if (diffMinutes > 0) {
                              return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
                            } else {
                              return 'sending soon';
                            }
                          })()}
                        </div>
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
                    {editingMessage
                      ? 'Update Scheduled Message'
                      : sendMode === 'now'
                      ? 'Send Now'
                      : 'Schedule Message'}
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
          isEditMode={!!editingMessage}
          onScheduleUpdate={(date: string, time: string) => {
            setScheduledDate(date);
            setScheduledTime(time);
          }}
          onEditSchedule={() => {
            // Focus the date/time controls - we'll scroll to them
            const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
            if (dateInput) {
              dateInput.focus();
              dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
        />

        {/* Type Change Confirmation Modal */}
        {showTypeChangeConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Change Message Type?
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Switching from <strong>{messageType}</strong> to <strong>{pendingMessageType}</strong> will change how your audience is selected. Your current selection will be reset.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={cancelTypeChange}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmTypeChange}
                  className="flex-1"
                >
                  Change Type
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
