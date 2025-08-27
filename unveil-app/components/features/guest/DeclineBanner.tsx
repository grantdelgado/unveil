'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useGuestRejoin } from '@/hooks/guests';
import { useErrorHandler } from '@/hooks/common';

interface DeclineBannerProps {
  eventId: string;
  eventTitle: string;
  onDismiss: () => void;
  onRejoin?: () => void;
  className?: string;
}

export function DeclineBanner({
  eventId,
  eventTitle: _eventTitle, // eslint-disable-line @typescript-eslint/no-unused-vars
  onDismiss,
  onRejoin,
  className,
}: DeclineBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { handleError } = useErrorHandler();

  // Atomic rejoin functionality
  const {
    rejoinEvent,
    isLoading: isRejoining,
    error: rejoinError,
  } = useGuestRejoin({
    eventId,
    onRejoinSuccess: () => {
      onRejoin?.();
      handleDismiss(); // Dismiss banner after successful rejoin
    },
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };



  const handleRejoin = async () => {
    const result = await rejoinEvent();
    if (!result.success) {
      // Show error using centralized handler
      handleError(result.error || 'Something went wrong. Please try again.', {
        context: 'Rejoin event'
      });
    }
  };

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'bg-amber-50 border border-amber-200 rounded-xl p-4',
        'animate-in slide-in-from-top-2 duration-300',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-5 h-5 text-amber-600 flex-shrink-0">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="font-medium text-amber-900">
              You&apos;ve marked that you can&apos;t make it
            </h3>
          </div>

          <p className="text-sm text-amber-800 mb-3">
            You won&apos;t receive day-of logistics unless the host specifically
            includes you in messages.
          </p>

          {rejoinError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{rejoinError}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRejoin}
              disabled={isRejoining}
              className={cn(
                'inline-flex items-center text-sm font-medium',
                'px-3 py-2 rounded-lg border transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                'min-h-[44px]', // Ensure minimum touch target
                isRejoining
                  ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 hover:text-amber-900',
              )}
            >
              {isRejoining ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'I can attend after all'
              )}
            </button>


          </div>
        </div>

        <button
          onClick={handleDismiss}
          className={cn(
            'ml-3 p-1 rounded-lg text-amber-600 hover:text-amber-800',
            'hover:bg-amber-100 focus:outline-none focus:ring-2',
            'focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-200',
            'min-w-[44px] min-h-[44px] flex items-center justify-center', // Ensure minimum touch target
          )}
          aria-label="Dismiss banner"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
