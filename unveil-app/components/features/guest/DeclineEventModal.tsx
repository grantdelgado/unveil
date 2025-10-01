'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [error, setError] = useState<string | null>(null);

  // Scroll lock effect
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      await onConfirm(reason.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Error declining event:', error);
      setError(error instanceof Error ? error.message : 'Couldn\'t update RSVP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setReason('');
    setError(null);
    onClose();
  }, [isSubmitting, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center min-h-[100dvh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-modal-title"
      aria-describedby="decline-modal-description"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-150"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-[min(92vw,420px)] mx-4 bg-white rounded-2xl shadow-lg',
          'transform transition-all duration-200 ease-out',
          'max-h-[90dvh] flex flex-col',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          // Animation: fade + slight scale
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200">
          <h2 
            id="decline-modal-title"
            className="text-xl font-semibold text-stone-900"
          >
            Decline RSVP?
          </h2>
          <p 
            id="decline-modal-description"
            className="text-sm text-stone-600 mt-1"
          >
            We&apos;ll let the hosts know you can&apos;t make it. You can change this later.
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
          {/* Error Display */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium min-h-[44px]',
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
              'Decline'
            )}
          </button>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium min-h-[44px]',
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

  // Render via portal to ensure proper stacking
  return typeof window !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
