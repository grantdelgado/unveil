/**
 * SMS Retry Button Component
 * Allows manual retry of SMS invitations from the dashboard
 */

'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { SecondaryButton } from '@/components/ui';
import { retryAllGuestSMS } from '@/lib/utils/manualSMSRetry';
import { logger } from '@/lib/logger';

interface SMSRetryButtonProps {
  eventId: string;
  className?: string;
  onSuccess?: (result: { sent: number; skipped: number }) => void;
  onError?: (error: string) => void;
}

export function SMSRetryButton({
  eventId,
  className,
  onSuccess,
  onError
}: SMSRetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleRetrySMS = async () => {
    if (isRetrying) return;

    try {
      setIsRetrying(true);
      setLastResult(null);

      logger.info('Manual SMS retry initiated', { eventId });

      const result = await retryAllGuestSMS(eventId);

      if (result.success) {
        const message = `SMS sent to ${result.sent} guests${result.skipped > 0 ? ` (${result.skipped} skipped - recently sent)` : ''}`;
        setLastResult(message);
        onSuccess?.(result);
        
        logger.info('Manual SMS retry completed', {
          eventId,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
      setLastResult(`Error: ${errorMessage}`);
      onError?.(errorMessage);
      
      logger.error('Manual SMS retry failed', { eventId, error: errorMessage });
    } finally {
      setIsRetrying(false);
      
      // Clear result message after 5 seconds
      setTimeout(() => setLastResult(null), 5000);
    }
  };

  return (
    <div className={className}>
      <SecondaryButton
        onClick={handleRetrySMS}
        disabled={isRetrying}
        className="flex items-center gap-2"
      >
        {isRetrying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isRetrying ? 'Sending...' : 'Send SMS Invites'}
      </SecondaryButton>
      
      {lastResult && (
        <div className={`mt-2 text-sm ${lastResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {lastResult}
        </div>
      )}
    </div>
  );
}