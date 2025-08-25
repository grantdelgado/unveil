'use client';

import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useEventReminder } from '@/hooks/useEventReminder';
import { formatTimeWithAbbreviation } from '@/lib/utils/timezone';

interface ReminderToggleProps {
  eventId: string;
  timelineId: string;
  startAtUtc: string;
  eventTimeZone?: string;
  className?: string;
}

export function ReminderToggle({
  eventId,
  timelineId,
  startAtUtc,
  eventTimeZone,
  className = '',
}: ReminderToggleProps) {
  const [showError, setShowError] = useState(false);
  
  const {
    reminderStatus,
    isLoading,
    isUpdating,
    error,
    canSchedule,
    toggleReminder,
  } = useEventReminder({
    eventId,
    timelineId,
    startAtUtc,
    enabled: true,
  });

  const handleToggle = async (checked: boolean) => {
    setShowError(false);
    
    try {
      await toggleReminder(checked);
    } catch {
      setShowError(true);
      // Error is already handled by the hook
    }
  };

  const isEnabled = reminderStatus?.enabled || false;
  const isDisabled = !canSchedule || isLoading || isUpdating;

  // Format the reminder send time for display (time only, no timezone abbreviation)
  const formattedReminderTime = 
    isEnabled && reminderStatus?.sendAt && eventTimeZone
      ? formatTimeWithAbbreviation(reminderStatus.sendAt, eventTimeZone)
      : null;

  // Caption text based on state
  const getCaptionText = () => {
    if (!canSchedule) {
      return 'Too close to start to schedule';
    }
    if (isEnabled && formattedReminderTime) {
      return `Scheduled for ${formattedReminderTime}`;
    }
    return null;
  };

  // Error text for display
  const getErrorText = () => {
    if (error || showError) {
      return error || 'Failed to update reminder';
    }
    return null;
  };

  const captionText = getCaptionText();
  const errorText = getErrorText();

  return (
    <div className={className}>
      {/* Main row: label (left) · switch (right) */}
      <div className="flex items-center justify-between min-h-[44px] py-2">
        {/* Label with disabled state indicator */}
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span className={`text-sm font-medium ${
            isDisabled && !canSchedule 
              ? 'text-gray-400 dark:text-gray-500' 
              : 'text-gray-700 dark:text-gray-300'
          }`}>
            1-hour reminder
          </span>
          
          {/* Lock icon when disabled due to timing */}
          {!canSchedule && (
            <div title="Too close to start to schedule">
              <Lock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            </div>
          )}
        </div>

        {/* iOS-style switch */}
        <button
          role="switch"
          aria-checked={isEnabled}
          aria-label={`${isEnabled ? 'Disable' : 'Enable'} 1-hour SMS reminder`}
          onClick={() => handleToggle(!isEnabled)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleToggle(!isEnabled);
            }
          }}
          disabled={isDisabled}
          className={`
            relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-150 ease-out
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
            min-w-[56px] min-h-[32px]
            ${isEnabled 
              ? 'bg-green-500 dark:bg-green-600' 
              : isDisabled 
                ? 'bg-gray-200 dark:bg-gray-700' 
                : 'bg-gray-300 dark:bg-gray-600'
            }
            ${isDisabled 
              ? 'cursor-not-allowed opacity-60' 
              : 'cursor-pointer hover:shadow-sm dark:hover:shadow-md'
            }
          `}
        >
          {/* Switch thumb */}
          <span
            className={`
              relative inline-flex h-6 w-6 items-center justify-center transform rounded-full bg-white 
              transition-transform duration-150 ease-out shadow-md
              ${isEnabled ? 'translate-x-7' : 'translate-x-1'}
            `}
          >
            {/* Loading spinner inside thumb when updating */}
            {isUpdating && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
            )}
          </span>
        </button>
      </div>

      {/* Caption and error area (fixed height to prevent layout jumps) */}
      <div className="min-h-[1.25rem] mt-1">
        {errorText && (
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">
            {errorText}
          </div>
        )}
        {!errorText && captionText && (
          <div className={`text-xs ${
            !canSchedule 
              ? 'text-amber-600 dark:text-amber-500 font-medium' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {captionText}
          </div>
        )}
      </div>
    </div>
  );
}
