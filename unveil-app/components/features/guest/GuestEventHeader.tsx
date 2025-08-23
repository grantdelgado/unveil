'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type Variant = 'compact' | 'hero';

interface GuestEventHeaderProps {
  eventTitle: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  variant?: Variant;
  className?: string;
}

export function GuestEventHeader({
  eventTitle,
  subtitle,
  backHref = '/select-event',
  backLabel = 'Your Events',
  variant = 'compact',
  className,
}: GuestEventHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push(backHref);
  };

  if (variant === 'hero') {
    return (
      <header
        role="banner"
        aria-label="Event navigation"
        data-testid="guest-header"
        className={cn(
          'pt-[env(safe-area-inset-top)] bg-transparent mb-6 md:mb-8',
          className,
        )}
      >
        <div className="mx-auto max-w-5xl px-4">
          {/* Back control */}
          <button
            onClick={handleBack}
            aria-label="Back to Your Events"
            className="-ml-2 mt-2 p-2 rounded-xl flex items-center gap-2 min-h-[44px] min-w-[44px] text-[15px] font-medium text-gray-900 hover:bg-gray-100/40 active:bg-gray-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 mb-4"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>

          {/* Hero title */}
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-gray-900 truncate mb-2"
            title={eventTitle}
          >
            {eventTitle}
          </h1>

          {/* Optional subtitle */}
          {subtitle && (
            <p className="text-[15px] md:text-base text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
      </header>
    );
  }

  // Compact variant (default)
  return (
    <header
      role="banner"
      aria-label="Event navigation"
      data-testid="guest-header"
      className={cn(
        'sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-white/90 backdrop-blur shadow-sm border-b border-gray-200/60 h-20 mb-4',
        className,
      )}
    >
      <div className="mx-auto max-w-5xl px-4 h-full flex flex-col justify-center gap-2">
        {/* Row 1: Back control (entire cluster is tappable) */}
        <div className="flex items-center">
          <button
            onClick={handleBack}
            aria-label="Back to Your Events"
            className="-ml-2 p-2 rounded-xl flex items-center gap-2 min-h-[44px] min-w-[44px] text-[15px] font-medium text-gray-900 hover:bg-gray-100/40 active:bg-gray-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
        </div>

        {/* Row 2: Event title (lead visually) */}
        <div className="flex items-center">
          <h1
            className="text-2xl font-semibold tracking-tight leading-tight truncate text-gray-900 relative z-10"
            title={eventTitle}
          >
            {eventTitle}
          </h1>
        </div>
      </div>
    </header>
  );
}
