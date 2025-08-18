'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DeclineBannerProps {
  eventTitle: string;
  hostEmail?: string;
  onDismiss: () => void;
  className?: string;
}

export function DeclineBanner({ 
  eventTitle, 
  hostEmail, 
  onDismiss, 
  className 
}: DeclineBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss();
  };

  const handleContactHost = () => {
    if (hostEmail) {
      const subject = encodeURIComponent(`About ${eventTitle}`);
      const body = encodeURIComponent(`Hi! I wanted to reach out regarding ${eventTitle}...`);
      window.location.href = `mailto:${hostEmail}?subject=${subject}&body=${body}`;
    }
  };

  if (isDismissed) return null;

  return (
    <div className={cn(
      "bg-amber-50 border border-amber-200 rounded-xl p-4",
      "animate-in slide-in-from-top-2 duration-300",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-5 h-5 text-amber-600 flex-shrink-0">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-medium text-amber-900">
              You&apos;ve marked that you can&apos;t make it
            </h3>
          </div>
          
          <p className="text-sm text-amber-800 mb-3">
            You won&apos;t receive day-of logistics unless the host specifically includes you in messages.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {hostEmail && (
              <button
                onClick={handleContactHost}
                className={cn(
                  "inline-flex items-center text-sm font-medium text-amber-800",
                  "hover:text-amber-900 focus:outline-none focus:ring-2",
                  "focus:ring-amber-500 focus:ring-offset-2 rounded-lg px-2 py-1",
                  "transition-colors duration-200 underline underline-offset-2",
                  "min-h-[44px]" // Ensure minimum touch target
                )}
              >
                Contact host
              </button>
            )}
            
            <span className="text-amber-600 text-sm">
              If your plans change, reach out to your hosts.
            </span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className={cn(
            "ml-3 p-1 rounded-lg text-amber-600 hover:text-amber-800",
            "hover:bg-amber-100 focus:outline-none focus:ring-2",
            "focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-200",
            "min-w-[44px] min-h-[44px] flex items-center justify-center" // Ensure minimum touch target
          )}
          aria-label="Dismiss banner"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
