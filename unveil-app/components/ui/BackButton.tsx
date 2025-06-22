'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  href?: string;           // Custom back URL
  fallback?: string;       // Fallback URL if no history
  variant?: 'subtle' | 'prominent';
  className?: string;
  children?: React.ReactNode;
}

export const BackButton: React.FC<BackButtonProps> = ({
  href,
  fallback = '/select-event',
  variant = 'subtle',
  className,
  children,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (href) {
      // Use explicit href if provided
      router.push(href);
    } else if (window.history.length > 1) {
      // Use browser back if history exists
      router.back();
    } else {
      // Use fallback for direct navigation
      router.push(fallback);
    }
  };

  const variantStyles = {
    subtle: 'text-gray-600 hover:text-[#FF6B6B] hover:bg-gray-50',
    prominent: 'text-[#FF6B6B] hover:text-[#FF5A5A] hover:bg-pink-50',
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        'inline-flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2',
        'min-h-[44px] min-w-[44px]', // Touch-friendly sizing
        variantStyles[variant],
        className,
      )}
      aria-label="Go back"
    >
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 19l-7-7 7-7" 
        />
      </svg>
      {children || 'Back'}
    </button>
  );
};

BackButton.displayName = 'BackButton'; 