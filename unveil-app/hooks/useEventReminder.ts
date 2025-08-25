/**
 * Hook for managing event reminder state
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  upsertEventReminder, 
  getEventReminderStatus, 
  type ReminderStatus 
} from '@/lib/services/messaging-client';
import { canScheduleReminder } from '@/lib/templates/reminders';

interface UseEventReminderOptions {
  eventId: string;
  timelineId: string;
  startAtUtc?: string;
  enabled?: boolean; // Whether the hook should be active (e.g., only for hosts)
}

interface UseEventReminderReturn {
  reminderStatus: ReminderStatus | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  canSchedule: boolean;
  toggleReminder: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEventReminder({
  eventId,
  timelineId,
  startAtUtc,
  enabled = true,
}: UseEventReminderOptions): UseEventReminderReturn {
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if reminder can be scheduled based on timing
  const canSchedule = startAtUtc ? canScheduleReminder(startAtUtc) : false;

  // Load initial reminder status
  const loadReminderStatus = useCallback(async () => {
    if (!enabled || !eventId || !timelineId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getEventReminderStatus(eventId, timelineId);
      
      if (result.success) {
        setReminderStatus(result.status || { enabled: false });
      } else {
        setError(result.error || 'Failed to load reminder status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminder status');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, timelineId, enabled]);

  // Toggle reminder on/off
  const toggleReminder = useCallback(async (reminderEnabled: boolean) => {
    if (!enabled || !eventId || !timelineId) return;

    setIsUpdating(true);
    setError(null);

    try {
      const result = await upsertEventReminder(eventId, timelineId, reminderEnabled);
      
      if (result.success) {
        // Update local state optimistically
        setReminderStatus(prev => ({
          ...prev,
          enabled: reminderEnabled,
          sendAt: reminderEnabled ? result.sendAt : undefined,
        }));
        
        // Refresh to get latest state from server
        await loadReminderStatus();
      } else {
        setError(result.error || 'Failed to update reminder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reminder');
    } finally {
      setIsUpdating(false);
    }
  }, [eventId, timelineId, enabled, loadReminderStatus]);

  // Refresh reminder status
  const refresh = useCallback(async () => {
    await loadReminderStatus();
  }, [loadReminderStatus]);

  // Load initial status on mount
  useEffect(() => {
    if (enabled) {
      loadReminderStatus();
    }
  }, [loadReminderStatus, enabled]);

  return {
    reminderStatus,
    isLoading,
    isUpdating,
    error,
    canSchedule,
    toggleReminder,
    refresh,
  };
}
