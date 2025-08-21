'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

import { fromUTCToEventZone, getTimezoneInfo, isValidTimezone, toUTCFromEventZone, formatScheduledDateTime } from '@/lib/utils/timezone';
import type { RecipientPreviewData } from '@/lib/types/messaging';

// Modal state machine
type ModalState = 'review' | 'sending' | 'result';

interface SendOptions {
  sendViaPush: boolean;
  sendViaSms: boolean;
  skipValidation?: boolean;
}

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  messageId?: string;
  error?: string;
  scheduledData?: {
    id?: string;
    send_at?: string;
    scheduled_tz?: string;
    scheduled_local?: string;
    recipient_count?: number;
  };
}

interface SendFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: SendOptions) => Promise<SendResult>;
  previewData: RecipientPreviewData | null;
  messageContent: string;
  messageType?: 'announcement' | 'reminder' | 'thank_you' | 'invitation';
  // Schedule-aware props
  sendMode?: 'now' | 'schedule';
  scheduledDate?: string;
  scheduledTime?: string;
  eventTimezone?: string;
  className?: string;
}

/**
 * In-modal send flow with state machine: review → sending → result
 * Replaces redirect/URL-param/toast flow with unified modal experience
 */
export function SendFlowModal({
  isOpen,
  onClose,
  onSend,
  previewData,
  messageContent,
  messageType = 'announcement',
  sendMode = 'now',
  scheduledDate,
  scheduledTime,
  eventTimezone,
  className
}: SendFlowModalProps) {
  const [currentState, setCurrentState] = useState<ModalState>('review');
  const [sendOptions, setSendOptions] = useState<SendOptions>({
    sendViaPush: true,
    sendViaSms: true
  });
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [hasConfirmedLargeGroup, setHasConfirmedLargeGroup] = useState(false);

  const validRecipientCount = previewData?.validRecipientsCount || 0;
  const totalCount = previewData?.totalCount || 0;
  const skippedCount = totalCount - validRecipientCount;
  const isLargeGroup = validRecipientCount > 50;
  
  // Calculate delivery time display (immediate vs scheduled)
  const deliveryTimeDisplay = useMemo(() => {
    if (sendMode === 'schedule' && scheduledDate && scheduledTime) {
      // Show scheduled delivery time with timezone awareness
      const eventTimezoneInfo = eventTimezone && isValidTimezone(eventTimezone) 
        ? getTimezoneInfo(eventTimezone) 
        : null;

      if (eventTimezoneInfo) {
        // Convert to UTC for accurate user time calculation
        const utcTime = toUTCFromEventZone(scheduledDate, scheduledTime, eventTimezone!);
        if (utcTime) {
          const eventTime = fromUTCToEventZone(utcTime, eventTimezone!);
          const userTime = new Date(utcTime).toLocaleString([], {
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          return {
            primary: `${eventTime?.formatted} ${eventTimezoneInfo.abbreviation}`,
            secondary: `= ${userTime} your time`,
            type: 'scheduled' as const
          };
        }
      }
      
      // Fallback if timezone conversion fails
      const localTime = new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric', 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return {
        primary: localTime,
        secondary: eventTimezone ? `(${eventTimezone})` : '(Event timezone not set)',
        type: 'scheduled' as const
      };
    }

    // Immediate delivery estimation
    const minutes = validRecipientCount <= 10 ? '< 1' :
                   validRecipientCount <= 50 ? '1-2' :
                   validRecipientCount <= 200 ? '2-5' : '5-10';
    
    return {
      primary: `${minutes} minute${minutes === '< 1' ? '' : 's'}`,
      secondary: 'Messages sent immediately',
      type: 'immediate' as const
    };
  }, [sendMode, scheduledDate, scheduledTime, eventTimezone, validRecipientCount]);

  // Validation for review state
  const canSend = useMemo(() => {
    if (currentState !== 'review') return false;
    if (validRecipientCount === 0) return false;
    if (messageContent.trim().length === 0) return false;
    if (!sendOptions.sendViaPush && !sendOptions.sendViaSms) return false;
    if (isLargeGroup && !hasConfirmedLargeGroup) return false;
    return true;
  }, [currentState, validRecipientCount, messageContent, sendOptions, isLargeGroup, hasConfirmedLargeGroup]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentState('review');
      setSendResult(null);
      setHasConfirmedLargeGroup(false);
      setShowFullMessage(false);
    }
  }, [isOpen]);

  // Handle send action
  const handleSend = async () => {
    if (!canSend) return;
    
    setCurrentState('sending');
    
    try {
      const result = await onSend(sendOptions);
      setSendResult(result);
      setCurrentState('result');
    } catch (error) {
      setSendResult({
        success: false,
        sentCount: 0,
        failedCount: validRecipientCount,
        error: error instanceof Error ? error.message : 'Failed to send message'
      });
      setCurrentState('result');
    }
  };

  // Handle retry from error state
  const handleRetry = () => {
    setCurrentState('review');
    setSendResult(null);
  };

  const getMessageTypeEmoji = () => {
    switch (messageType) {
      case 'reminder': return '📧';
      case 'thank_you': return '🎉';
      case 'invitation': return '💌';
      default: return '📢';
    }
  };

  // Early return if not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-flow-modal-title"
    >
      <div className={cn(
        'bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden',
        className
      )}>
        {/* Review State */}
        {currentState === 'review' && (
          <div className="p-6 space-y-6 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="text-center">
              <div className="text-3xl mb-2">{getMessageTypeEmoji()}</div>
              <h2 id="send-flow-modal-title" className="text-xl font-semibold text-gray-900">
                Confirm Message Send
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Review your message and recipients before sending
              </p>
            </div>

            {/* Recipient Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-purple-900 mb-3">📊 Delivery Summary</h3>
              
              <div className="grid grid-cols-3 gap-4 text-center mb-3">
                <div>
                  <div className="text-lg font-bold text-green-700">{validRecipientCount}</div>
                  <div className="text-xs text-green-600">Will Receive</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-700">{skippedCount}</div>
                  <div className="text-xs text-orange-600">Excluded</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-700">{totalCount}</div>
                  <div className="text-xs text-blue-600">Total Selected</div>
                </div>
              </div>

              {skippedCount > 0 && (
                <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mb-3">
                  <div className="text-xs text-orange-800">
                    <span className="font-medium">⚠️ {skippedCount} guest{skippedCount !== 1 ? 's' : ''} excluded:</span>
                    <br />Missing phone numbers or opted out of messages
                  </div>
                </div>
              )}

              <div className={cn(
                "border rounded-lg p-3",
                deliveryTimeDisplay.type === 'scheduled' 
                  ? "bg-purple-100 border-purple-200" 
                  : "bg-blue-100 border-blue-200"
              )}>
                <div className={cn(
                  "text-xs",
                  deliveryTimeDisplay.type === 'scheduled' ? "text-purple-800" : "text-blue-800"
                )}>
                  {deliveryTimeDisplay.type === 'scheduled' ? (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">📅 Scheduled delivery:</span>
                        <span className="font-semibold">{deliveryTimeDisplay.primary}</span>
                      </div>
                      <div className="text-right text-purple-600" aria-live="polite">
                        {deliveryTimeDisplay.secondary}
                      </div>
                      {eventTimezone && (
                        <div className="flex items-center justify-end gap-1 text-purple-500 mt-1">
                          <span>ℹ️</span>
                          <span>Times are anchored to the event timezone</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="font-medium">⏱️ Estimated delivery:</span>
                      <span className="font-semibold">{deliveryTimeDisplay.primary}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Large Group Warning */}
            {isLargeGroup && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-amber-500 text-xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-800">Large Group Alert</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      You&apos;re sending to {validRecipientCount} recipients. This may take several minutes to deliver.
                    </p>
                    <label className="flex items-center mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasConfirmedLargeGroup}
                        onChange={(e) => setHasConfirmedLargeGroup(e.target.checked)}
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

            {/* Message Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">💬 Message Content</h3>
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="text-sm text-gray-900 whitespace-pre-wrap [overflow-wrap:anywhere] overflow-x-hidden max-h-48 overflow-y-auto messagePreview">
                  {showFullMessage ? messageContent : messageContent.substring(0, 150)}
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
              <h3 className="text-sm font-medium text-gray-700 mb-3">📱 Delivery Method</h3>
              <div className="space-y-3">
                <label className={cn(
                  "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
                  sendOptions.sendViaPush ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
                )}>
                  <input
                    type="checkbox"
                    checked={sendOptions.sendViaPush}
                    onChange={(e) => setSendOptions(prev => ({ ...prev, sendViaPush: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Push Notification</div>
                    <div className="text-xs text-gray-500">Instant delivery, works in app</div>
                  </div>
                  <span className="text-lg">🔔</span>
                </label>

                <label className={cn(
                  "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
                  sendOptions.sendViaSms ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
                )}>
                  <input
                    type="checkbox"
                    checked={sendOptions.sendViaSms}
                    onChange={(e) => setSendOptions(prev => ({ ...prev, sendViaSms: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">SMS Text Message</div>
                    <div className="text-xs text-gray-500">Universal delivery, works everywhere</div>
                  </div>
                  <span className="text-lg">💬</span>
                </label>
              </div>

              {!sendOptions.sendViaPush && !sendOptions.sendViaSms && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  ❌ Please select at least one delivery method
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {validRecipientCount === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-800">
                  <span className="font-medium">❌ Cannot send:</span> No valid recipients found
                </div>
              </div>
            )}

            {messageContent.trim().length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-800">
                  <span className="font-medium">❌ Cannot send:</span> Message content is required
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="flex-1"
              >
                <span>{sendMode === 'schedule' ? 'Schedule Message' : 'Send Now'}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs ml-2">
                  {validRecipientCount}
                </span>
              </Button>
            </div>

            {/* Footer Note */}
            <div className="text-center">
              <div className="text-xs text-gray-500">
                Messages respect guest opt-out preferences and privacy settings
              </div>
            </div>
          </div>
        )}

        {/* Sending State */}
        {currentState === 'sending' && (
          <div className="p-8 text-center space-y-6">
            <div className="text-3xl mb-4">📤</div>
            
            {/* Main status with spinner */}
            <div 
              className="flex items-center justify-center space-x-4"
              role="status"
              aria-live="polite"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Sending to {validRecipientCount} guests...
              </h2>
            </div>
            
            {/* Subtle subtext */}
            <div className="space-y-2">
              <div className="text-sm text-gray-500">
                This may take under a minute.
              </div>
              <div className="text-xs text-gray-400">
                Please keep this window open while sending
              </div>
            </div>
          </div>
        )}

        {/* Result State */}
        {currentState === 'result' && sendResult && (
          <div className="p-6 text-center space-y-6">
            {sendResult.success ? (
              <>
                {/* Success */}
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {sendResult.scheduledData ? 'Message Scheduled' : 'Message Sent Successfully'}
                </h2>
                
                {sendResult.failedCount > 0 ? (
                  // Partial success
                  <div className="space-y-3">
                    <div 
                      className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                      role="alert"
                    >
                      <div className="text-sm text-orange-800">
                        <div className="font-medium">Partial Success</div>
                        <div className="mt-1">
                          Sent to <span className="font-bold">{sendResult.sentCount}</span> guests
                          <br />
                          <span className="font-bold">{sendResult.failedCount}</span> failed to deliver
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Full success - branch between sent and scheduled
                  <div 
                    className={cn(
                      "border rounded-lg p-4",
                      sendResult.scheduledData 
                        ? "bg-purple-50 border-purple-200" 
                        : "bg-green-50 border-green-200"
                    )}
                    role="alert"
                  >
                    <div className={cn(
                      "text-sm",
                      sendResult.scheduledData ? "text-purple-800" : "text-green-800"
                    )}>
                      {sendResult.scheduledData ? (
                        // Scheduled success
                        <>
                          <div className="font-medium">Message Scheduled</div>
                          <div className="mt-2 space-y-1">
                            {/* Scheduled time display */}
                            {(() => {
                              const { scheduledData } = sendResult;
                              const formattedTime = scheduledData.send_at && scheduledData.scheduled_tz 
                                ? formatScheduledDateTime(scheduledData.send_at, scheduledData.scheduled_tz)
                                : null;
                              
                              return (
                                <div>
                                  <div 
                                    className="font-medium"
                                    aria-live="polite"
                                  >
                                    Scheduled for: {formattedTime || 'Time not available'}
                                  </div>
                                  <div className="text-xs text-purple-600 mt-1">
                                    Times are anchored to the event timezone
                                  </div>
                                  <div className="mt-1">
                                    Will send to <span className="font-bold">{sendResult.sentCount}</span> guest{sendResult.sentCount === 1 ? '' : 's'}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      ) : (
                        // Immediate send success
                        <>
                          <div className="font-medium">Complete Success</div>
                          <div className="mt-1">
                            Message sent to <span className="font-bold">{sendResult.sentCount}</span> guest{sendResult.sentCount === 1 ? '' : 's'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {sendResult.scheduledData ? (
                    // Scheduled message buttons
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Navigate to Message History
                          onClose();
                          // TODO: Navigate to Message History with scheduled filter
                          console.log('Navigate to Message History');
                        }}
                        className="flex-1"
                      >
                        View in History
                      </Button>
                      
                      <Button
                        onClick={onClose}
                        className="flex-1"
                      >
                        Done
                      </Button>
                    </>
                  ) : (
                    // Immediate send buttons
                    <>
                      {sendResult.messageId && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Navigate to message deliveries if available
                            console.log('View deliveries:', sendResult.messageId);
                          }}
                          className="flex-1"
                        >
                          View Deliveries
                        </Button>
                      )}
                      <Button
                        onClick={onClose}
                        className="flex-1"
                      >
                        Done
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Error */}
                <div className="text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Send Failed
                </h2>
                <div 
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                  role="alert"
                >
                  <div className="text-sm text-red-800">
                    <div className="font-medium">Error</div>
                    <div className="mt-1">
                      {sendResult.error || 'Failed to send message'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={onClose}
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
