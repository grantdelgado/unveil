'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { RecipientPreviewData } from '@/lib/types/messaging';

interface SendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: SendOptions) => void;
  previewData: RecipientPreviewData | null;
  messageContent: string;
  messageType?: 'announcement' | 'reminder' | 'thank_you';
  isLoading?: boolean;
  className?: string;
}

interface SendOptions {
  sendViaPush: boolean;
  sendViaSms: boolean;
  skipValidation?: boolean;
}

/**
 * Enhanced send confirmation modal - Phase 3 complete
 * Shows comprehensive recipient summary, delivery options, and validation
 */
export function SendConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  previewData,
  messageContent,
  messageType = 'announcement',
  isLoading = false,
  className,
}: SendConfirmationModalProps) {
  const [sendViaPush, setSendViaPush] = useState(true);
  const [sendViaSms, setSendViaSms] = useState(true);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [hasConfirmedLargeGroup, setHasConfirmedLargeGroup] = useState(false);

  const validRecipientCount = previewData?.validRecipientsCount || 0;
  const totalCount = previewData?.totalCount || 0;
  const skippedCount = totalCount - validRecipientCount;
  const isLargeGroup = validRecipientCount > 50;

  // Calculate estimated delivery time
  const estimatedDeliveryMinutes = useMemo(() => {
    if (validRecipientCount <= 10) return '< 1';
    if (validRecipientCount <= 50) return '1-2';
    if (validRecipientCount <= 200) return '2-5';
    return '5-10';
  }, [validRecipientCount]);

  // Validation
  const canSend = useMemo(() => {
    if (validRecipientCount === 0) return false;
    if (messageContent.trim().length === 0) return false;
    if (!sendViaPush && !sendViaSms) return false;
    if (isLargeGroup && !hasConfirmedLargeGroup) return false;
    return true;
  }, [
    validRecipientCount,
    messageContent,
    sendViaPush,
    sendViaSms,
    isLargeGroup,
    hasConfirmedLargeGroup,
  ]);

  // Early return after all hooks have been called
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!canSend) return;
    onConfirm({ sendViaPush, sendViaSms });
  };

  const getMessageTypeEmoji = () => {
    switch (messageType) {
      case 'reminder':
        return '📧';
      case 'thank_you':
        return '🎉';
      default:
        return '📢';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className={cn(
          'bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto',
          className,
        )}
      >
        <div className="p-6 space-y-6">
          {/* Header with Message Type */}
          <div className="text-center">
            <div className="text-3xl mb-2">{getMessageTypeEmoji()}</div>
            <h2 className="text-xl font-semibold text-gray-900">
              Confirm Message Send
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Review your message and recipients before sending
            </p>
          </div>

          {/* Recipient Summary - Enhanced */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-900 mb-3">
              📊 Delivery Summary
            </h3>

            <div className="grid grid-cols-3 gap-4 text-center mb-3">
              <div>
                <div className="text-lg font-bold text-green-700">
                  {validRecipientCount}
                </div>
                <div className="text-xs text-green-600">Will Receive</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-700">
                  {skippedCount}
                </div>
                <div className="text-xs text-orange-600">Excluded</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-700">
                  {totalCount}
                </div>
                <div className="text-xs text-blue-600">Total Selected</div>
              </div>
            </div>

            {skippedCount > 0 && (
              <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mb-3">
                <div className="text-xs text-orange-800">
                  <span className="font-medium">
                    ⚠️ {skippedCount} guest{skippedCount !== 1 ? 's' : ''}{' '}
                    excluded:
                  </span>
                  <br />
                  Missing phone numbers or opted out of messages
                </div>
              </div>
            )}

            <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-800">
                <span className="font-medium">⏱️ Estimated delivery:</span>{' '}
                {estimatedDeliveryMinutes} minute
                {estimatedDeliveryMinutes !== '< 1' ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Large Group Warning */}
          {isLargeGroup && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <span className="text-amber-500 text-xl">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-800">
                    Large Group Alert
                  </h4>
                  <p className="text-xs text-amber-700 mt-1">
                    You&apos;re sending to {validRecipientCount} recipients.
                    This may take several minutes to deliver.
                  </p>
                  <label className="flex items-center mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConfirmedLargeGroup}
                      onChange={(e) =>
                        setHasConfirmedLargeGroup(e.target.checked)
                      }
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-xs text-amber-800">
                      I understand this is a large group message
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Message Preview - Enhanced */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              💬 Message Content
            </h3>
            <div className="bg-gray-50 border rounded-lg p-3">
              <div className="text-sm text-gray-900">
                {showFullMessage
                  ? messageContent
                  : messageContent.substring(0, 150)}
                {messageContent.length > 150 && !showFullMessage && '...'}
              </div>
              {messageContent.length > 150 && (
                <button
                  onClick={() => setShowFullMessage(!showFullMessage)}
                  className="text-xs text-purple-600 hover:text-purple-700 mt-2 font-medium"
                >
                  {showFullMessage ? 'Show Less' : 'View Full Message'}
                </button>
              )}
              <div className="text-xs text-gray-500 mt-2">
                {messageContent.length} characters
              </div>
            </div>
          </div>

          {/* Delivery Channel Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              📱 Delivery Method
            </h3>
            <div className="space-y-3">
              <label
                className={cn(
                  'flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all',
                  sendViaPush
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={sendViaPush}
                  onChange={(e) => setSendViaPush(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Push Notification
                  </div>
                  <div className="text-xs text-gray-500">
                    Instant delivery, works in app
                  </div>
                </div>
                <span className="text-lg">🔔</span>
              </label>

              <label
                className={cn(
                  'flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all',
                  sendViaSms
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={sendViaSms}
                  onChange={(e) => setSendViaSms(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    SMS Text Message
                  </div>
                  <div className="text-xs text-gray-500">
                    Universal delivery, works everywhere
                  </div>
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

          {/* Validation Messages */}
          {validRecipientCount === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm text-red-800">
                <span className="font-medium">❌ Cannot send:</span> No valid
                recipients found
              </div>
            </div>
          )}

          {messageContent.trim().length === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm text-red-800">
                <span className="font-medium">❌ Cannot send:</span> Message
                content is required
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canSend || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Sending...
                </>
              ) : (
                <>
                  <span>Send Message</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs ml-2">
                    {validRecipientCount}
                  </span>
                </>
              )}
            </Button>
          </div>

          {/* Footer Note */}
          <div className="text-center">
            <div className="text-xs text-gray-500">
              Messages respect guest opt-out preferences and privacy settings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
