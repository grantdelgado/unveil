'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
      // Use explicit href if provided (for well-defined navigation paths)
      router.push(href);
    } else if (window.history.length > 1) {
      // Use browser back if history exists (for modal-like returns)
      router.back();
    } else {
      // Use fallback for direct navigation
      router.push(fallback);
    }
  };

  const variantStyles = {
    subtle: 'text-muted-foreground hover:text-foreground hover:bg-accent',
    prominent: 'text-primary hover:text-primary/80 hover:bg-primary/10',
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        'inline-flex items-center gap-2 p-2 text-sm font-medium',
        'transition-all duration-200 rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'min-h-[44px] min-w-[44px]', // Touch-friendly sizing
        variantStyles[variant],
        className,
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children && <span>{children}</span>}
    </button>
  );
};

BackButton.displayName = 'BackButton'; 