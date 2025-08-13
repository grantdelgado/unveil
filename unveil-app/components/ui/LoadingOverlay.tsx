import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  message?: string;
  className?: string;
  fadeOut?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading...',
  className,
  fadeOut = false,
}) => {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300',
        fadeOut && 'opacity-0',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none select-none">
        <LoadingSpinner size="lg" text={message} />
      </div>
    </div>
  );
};

LoadingOverlay.displayName = 'LoadingOverlay';


