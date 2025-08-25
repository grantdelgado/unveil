'use client';

import { useState, useEffect } from 'react';
import { Button, SecondaryButton } from '@/components/ui';
// cn utility removed as it's not used in this component
import { logger } from '@/lib/logger';

interface BulkInviteResult {
  sent: number;
  skipped: number;
  errors: Array<{
    guestId: string;
    reason: string;
  }>;
}

interface ConfirmBulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventId: string;
  eligibleCount: number;
  excludedReasons?: string[]; // Keep for interface compatibility but not used in UI
}

/**
 * Confirmation modal for bulk invitations
 * Shows eligible count and handles the bulk invite API call
 */
export function ConfirmBulkInviteModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  eligibleCount,
  // excludedReasons not used in current UI implementation
}: ConfirmBulkInviteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (eligibleCount === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting bulk invite process', {
        eventId,
        eligibleCount,
      });

      const response = await fetch('/api/guests/invite-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          // Don't provide guestIds - let the API fetch all eligible guests
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to send invitations`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitations');
      }

      logger.info('Bulk invite completed successfully', {
        eventId,
        sent: data.data.sent,
        skipped: data.data.skipped,
        errors: data.data.errors.length,
      });

      setResult(data.data);
      
      // Call onSuccess to refresh the parent component
      onSuccess();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitations';
      
      logger.error('Bulk invite failed', {
        error: errorMessage,
        eventId,
        eligibleCount,
      });

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  // Scroll lock effect
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Show results if we have them
  if (result) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center min-h-[100dvh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-invite-results-title"
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity duration-150"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-[min(92vw,420px)] mx-4 bg-white rounded-2xl shadow-lg transform transition-all duration-200 ease-out max-h-[90dvh] flex flex-col">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">
                {result.errors.length === 0 ? '✅' : result.sent > 0 ? '⚠️' : '❌'}
              </div>
              <h2 id="bulk-invite-results-title" className="text-xl font-semibold text-gray-900 mb-2">
                Invitations Sent
              </h2>
            </div>

            {/* Results Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✅</span>
                  Sent
                </span>
                <span className="font-medium">{result.sent}</span>
              </div>
              
              {result.skipped > 0 && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="flex items-center gap-2">
                    <span className="text-yellow-600">⏭️</span>
                    Skipped
                  </span>
                  <span className="font-medium">{result.skipped}</span>
                </div>
              )}
              
              {result.errors.length > 0 && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="flex items-center gap-2">
                    <span className="text-red-600">⚠️</span>
                    Errors
                  </span>
                  <span className="font-medium">{result.errors.length}</span>
                </div>
              )}
            </div>

            {/* Error Details (if any) */}
            {result.errors.length > 0 && (
              <details className="mb-6">
                <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                  View error details ({Math.min(result.errors.length, 5)} shown)
                </summary>
                <div className="mt-2 space-y-1">
                  {result.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs text-gray-600 bg-red-50 p-2 rounded">
                      {error.reason}
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                      ... and {result.errors.length - 5} more
                    </div>
                  )}
                </div>
              </details>
            )}

            <Button
              onClick={handleClose}
              className="min-h-[44px] w-full"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show confirmation dialog
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center min-h-[100dvh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-invite-confirm-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-150"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[min(92vw,420px)] mx-4 bg-white rounded-2xl shadow-lg transform transition-all duration-200 ease-out max-h-[90dvh] flex flex-col">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">📨</div>
            <h2 id="bulk-invite-confirm-title" className="text-xl font-semibold text-gray-900 mb-2">
              Send Invitations
            </h2>
            
                      {eligibleCount > 0 ? (
            <p className="text-gray-600">
              You&apos;re about to invite <strong>{eligibleCount}</strong> guest{eligibleCount === 1 ? '' : 's'} by SMS.
            </p>
          ) : (
            <p className="text-gray-600">
              No guests are currently eligible for invitations.
            </p>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* No eligible guests message */}
        {eligibleCount === 0 && (
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">No eligible guests.</p>
          </div>
        )}

        {/* Action buttons - responsive layout */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <SecondaryButton
            onClick={handleClose}
            disabled={isLoading}
            className="min-h-[44px] w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </SecondaryButton>
          
          <Button
            onClick={handleConfirm}
            disabled={isLoading || eligibleCount === 0}
            className="min-h-[44px] w-full sm:w-auto bg-pink-600 hover:bg-pink-700 order-1 sm:order-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </div>
            ) : (
              `Send Invitations${eligibleCount > 0 ? ` (${eligibleCount})` : ''}`
            )}
          </Button>
        </div>

        {/* Footnote - always show */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Guests without a valid phone number or who opted out are automatically skipped.
        </p>
        </div>
      </div>
    </div>
  );
}
