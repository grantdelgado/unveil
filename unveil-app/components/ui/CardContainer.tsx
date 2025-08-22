import React from 'react';
import { cn } from '@/lib/utils';

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

export const CardContainer: React.FC<CardContainerProps> = ({
  children,
  className,
  maxWidth = 'sm',
  animated = true,
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className={cn(
        'w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6',
        maxWidthClasses[maxWidth],
        'mx-auto',
        animated && 'transition-all duration-500 ease-out animate-fade-in-up',
        className,
      )}
    >
      {children}
    </div>
  );
};

CardContainer.displayName = 'CardContainer';
