'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useErrorHandler } from '@/hooks/common';

interface SMSAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  guestCount: number;
  onSuccess?: () => void;
}

export function SMSAnnouncementModal({
  isOpen,
  onClose,
  eventId,
  guestCount,
  onSuccess,
}: SMSAnnouncementModalProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { handleError, handleSuccess } = useErrorHandler();
  const [targetType, setTargetType] = useState<'all' | 'attending' | 'pending'>(
    'all',
  );

  const handleSend = async () => {
    if (!message.trim()) {
      handleError('Please enter a message', { context: 'Send announcement' });
      return;
    }

    if (message.length > 1500) {
      handleError('Message is too long. Please keep it under 1500 characters.', { 
        context: 'Send announcement' 
      });
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Send SMS announcement via API
      const response = await fetch('/api/sms/send-announcement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId,
          message: message.trim(),
          targetType, // Future enhancement: filter by RSVP status
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send announcement');
      }

      // Show success message
      const successMessage =
        result.sent > 0
          ? `📱 Successfully sent announcement to ${result.sent} guests!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
          : '📱 No eligible guests found for SMS. Make sure guests have phone numbers and haven&apos;t opted out.';

      handleSuccess(successMessage, { context: 'Send announcement' });

      // Reset form and close modal
      setMessage('');
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error sending announcement:', error);
      handleError(error, { context: 'Send announcement' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const charCount = message.length;
  const charLimit = 1500;
  const isNearLimit = charCount > charLimit * 0.8;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-stone-800 flex items-center">
              <span className="text-2xl mr-2">📢</span>
              Send SMS Announcement
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Send a message directly to your guests&apos; phones
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Target Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Send to:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: 'all',
                  label: 'All Guests',
                  desc: `${guestCount} guests`,
                },
                {
                  value: 'attending',
                  label: 'Attending',
                  desc: 'Only confirmed',
                },
                { value: 'pending', label: 'Pending', desc: 'No RSVP yet' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setTargetType(
                      option.value as 'all' | 'attending' | 'pending',
                    )
                  }
                  className={`
                    p-3 text-left border rounded-lg transition-colors
                    ${
                      targetType === option.value
                        ? 'border-purple-200 bg-purple-50 text-purple-800'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600'
                    }
                  `}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs opacity-70">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Composer */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Your message:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement here... e.g., 'Exciting news! We've added a photo booth to the reception. Can't wait to see you all there! 📸'"
              className="w-full h-32 px-3 py-2 border border-stone-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
              disabled={isLoading}
              maxLength={charLimit}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-stone-500">
                Messages are personalized with guest names
              </div>
              <div
                className={`text-xs font-medium ${isNearLimit ? 'text-amber-600' : 'text-stone-500'}`}
              >
                {charCount}/{charLimit}
              </div>
            </div>
          </div>

          {/* Preview */}
          {message.trim() && (
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="text-xs font-medium text-stone-600 mb-2">
                Preview:
              </div>
              <div className="text-sm text-stone-700 bg-white p-3 rounded border">
                Hi [Guest Name]! [Your Name] here with an update about [Event]:
                <br />
                <br />
                {message.trim()}
                <br />
                <br />
                Reply STOP to opt out.
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="text-amber-500 text-sm">⚠️</div>
              <div className="text-xs text-amber-700">
                <div className="font-medium mb-1">SMS charges may apply</div>
                <div>
                  This will send individual SMS messages to each guest with a
                  phone number. Make sure your Twilio account has sufficient
                  credits.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || !message.trim() || charCount > charLimit}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sending...</span>
              </div>
            ) : (
              <>
                <span className="mr-1">📱</span>
                Send SMS
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
