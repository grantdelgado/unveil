import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  text = 'Loading...',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('text-center', className)}>
      <div
        className={cn(
          'border-2 border-pink-300 border-t-[#FF6B6B] rounded-full animate-spin mx-auto mb-4',
          sizeClasses[size],
        )}
      ></div>
      {text && <p className="text-gray-500 text-base">{text}</p>}
    </div>
  );
};

LoadingSpinner.displayName = 'LoadingSpinner';

export const LoadingPage: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="min-h-100dvh bg-[#FAFAFA] flex items-center justify-center p-4 md:p-6">
      <div className="text-center">
        <LoadingSpinner size="lg" text={message} />
      </div>
    </div>
  );
};

export const LoadingCard: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="bg-app rounded-xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" className="mr-3" />
        <span className="text-stone-600">{message}</span>
      </div>
    </div>
  );
};
