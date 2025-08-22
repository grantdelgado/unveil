'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DeclineEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  eventTitle: string;
}

export function DeclineEventModal({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
}: DeclineEventModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Error declining event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md mx-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl',
          'transform transition-transform duration-300',
          'max-h-[85vh] flex flex-col',
        )}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200">
          <h2 className="text-xl font-semibold text-stone-900">
            Can&apos;t make it to this event?
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            You&apos;ll stop receiving day-of logistics unless the host includes
            you.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
              <h3 className="font-medium text-stone-800 mb-1">Event</h3>
              <p className="text-stone-700 break-words">{eventTitle}</p>
            </div>

            <div>
              <label
                htmlFor="decline-reason"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Share a brief reason (optional)
              </label>
              <textarea
                id="decline-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional: Share a brief reason (private to hosts)"
                className={cn(
                  'w-full px-4 py-3 rounded-xl border border-stone-300',
                  'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                  'resize-none text-stone-900 placeholder-stone-500',
                  'disabled:bg-stone-50 disabled:text-stone-500',
                )}
                rows={3}
                maxLength={200}
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-stone-500">
                  This will only be visible to the event hosts
                </p>
                <span className="text-xs text-stone-400">
                  {reason.length}/200
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-stone-200 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium',
              'bg-stone-900 text-white',
              'hover:bg-stone-800 active:bg-stone-950',
              'focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200',
            )}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Updating...
              </div>
            ) : (
              'Mark as not attending'
            )}
          </button>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium',
              'bg-stone-100 text-stone-700',
              'hover:bg-stone-200 active:bg-stone-300',
              'focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200',
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
