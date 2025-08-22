'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';

interface SMSNotificationToggleProps {
  eventId: string;
  guestId: string;
  initialOptOut?: boolean;
  onToggle?: (optedOut: boolean) => void;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  currentState: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ConfirmationModal({
  isOpen,
  currentState,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const willOptOut = !currentState;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">
          Text message updates
        </h3>

        <p className="text-sm text-stone-600 mb-6">
          {willOptOut
            ? 'Turn off SMS updates from your hosts?'
            : 'Turn on SMS updates from your hosts?'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-stone-800 hover:bg-stone-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : willOptOut ? (
              'Turn Off'
            ) : (
              'Turn On'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SMSNotificationToggle({
  eventId,
  guestId,
  initialOptOut = false,
  onToggle,
}: SMSNotificationToggleProps) {
  const { user } = useAuth();
  const [smsOptOut, setSmsOptOut] = useState(initialOptOut);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update state when initialOptOut changes
  useEffect(() => {
    setSmsOptOut(initialOptOut);
  }, [initialOptOut]);

  const handleToggleClick = () => {
    if (isLoading) return;
    setShowConfirmation(true);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!user || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const newOptOutValue = !smsOptOut;

      // Optimistic update
      setSmsOptOut(newOptOutValue);
      onToggle?.(newOptOutValue);

      // Update the database
      const { error: updateError } = await supabase
        .from('event_guests')
        .update({
          sms_opt_out: newOptOutValue,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Success - close modal and show success toast
      setShowConfirmation(false);
      setSuccessMessage(
        newOptOutValue ? 'SMS updates turned off.' : 'SMS updates turned on.',
      );

      logger.info('SMS notification preference updated', {
        eventId,
        guestId,
        smsOptOut: newOptOutValue,
      });
    } catch (err) {
      // Revert optimistic update on error
      setSmsOptOut(!smsOptOut);
      onToggle?.(!smsOptOut);

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Couldn't update SMS settings. Please try again.";
      setError(errorMessage);

      logger.error('Failed to update SMS notification preference', {
        error: err,
        eventId,
        guestId,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setError(null);
  };

  // Show error toast briefly
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Show success toast briefly
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const isOptedIn = !smsOptOut;
  const IconComponent = isOptedIn ? Bell : BellOff;
  const ariaLabel = `Text message updates: ${isOptedIn ? 'On' : 'Off'}. Click to ${isOptedIn ? 'turn off' : 'turn on'} SMS notifications`;

  return (
    <>
      <button
        onClick={handleToggleClick}
        disabled={isLoading}
        className={`
          relative p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400
          ${
            isOptedIn
              ? 'text-stone-600 hover:text-stone-700 hover:bg-stone-100'
              : 'text-stone-400 hover:text-stone-500 hover:bg-stone-50'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <IconComponent className="h-5 w-5" />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Success toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        currentState={smsOptOut}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </>
  );
}
