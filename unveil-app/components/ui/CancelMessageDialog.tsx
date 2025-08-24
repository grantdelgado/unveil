'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

interface CancelMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: ScheduledMessage | null;
  isLoading?: boolean;
}

export function CancelMessageDialog({
  isOpen,
  onClose,
  onConfirm,
  message,
  isLoading = false,
}: CancelMessageDialogProps) {
  if (!message) return null;

  const sendTime = new Date(message.send_at);
  const now = new Date();
  const timeUntilSend = sendTime.getTime() - now.getTime();
  const hoursUntilSend = Math.floor(timeUntilSend / (1000 * 60 * 60));
  const minutesUntilSend = Math.floor((timeUntilSend % (1000 * 60 * 60)) / (1000 * 60));

  const formatTimeUntilSend = () => {
    if (timeUntilSend <= 0) return 'Overdue';
    if (hoursUntilSend > 0) {
      return `${hoursUntilSend}h ${minutesUntilSend}m`;
    }
    return `${minutesUntilSend}m`;
  };

  const getDeliveryMethods = () => {
    const methods = [];
    if (message.send_via_push) methods.push('Push notification');
    if (message.send_via_sms) methods.push('SMS');
    return methods.join(' and ');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-message-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 id="cancel-message-dialog-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="text-amber-500">⚠️</span>
            Cancel Scheduled Message
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Message preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-900 line-clamp-3">
              {message.content}
            </p>
          </div>

          {/* Message details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-blue-500">🕒</span>
              <span>Scheduled for {sendTime.toLocaleString()}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {formatTimeUntilSend()}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-gray-500">👥</span>
              <span>
                {message.recipient_count || 0} recipients via {getDeliveryMethods()}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5 flex-shrink-0">⚠️</span>
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  This message will not be sent
                </p>
                <p className="text-amber-700 mt-1">
                  Guests will not receive this message and this action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Keep Message
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? 'Cancelling...' : 'Cancel Message'}
          </Button>
        </div>
      </div>
    </div>
  );
}
