import React from 'react';
import { cn } from '@/lib/utils';
import { CardContainer } from '@/components/ui';

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'landing' | 'auth';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AuthCard: React.FC<AuthCardProps> = ({
  children,
  className,
  variant = 'default',
  maxWidth = 'md'
}) => {
  const variantClasses = {
    default: 'bg-white border-gray-100',
    landing: 'bg-gradient-to-br from-white via-rose-50/30 to-purple-50/30 border-rose-200/30',
    auth: 'bg-white border-gray-100'
  };

  return (
    <CardContainer
      maxWidth={maxWidth}
      className={cn(
        variantClasses[variant],
        'shadow-lg rounded-2xl',
        // Enhanced responsive padding with iPhone optimization
        'p-4 xs:p-5 sm:p-6 md:p-8',
        // Better spacing on very small screens (iPhone SE, etc.)
        'mx-2 xs:mx-3 sm:mx-4 md:mx-auto',
        // Ensure readability across all breakpoints
        'w-full max-w-[calc(100vw-1rem)] xs:max-w-[calc(100vw-1.5rem)] sm:max-w-sm md:max-w-md lg:max-w-lg',
        className
      )}
    >
      {children}
    </CardContainer>
  );
};

AuthCard.displayName = 'AuthCard';