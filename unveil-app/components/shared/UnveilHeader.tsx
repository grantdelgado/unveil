import React from 'react';
import { cn } from '@/lib/utils';

interface UnveilHeaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  tagline?: string;
}

export const UnveilHeader: React.FC<UnveilHeaderProps> = ({
  className,
  size = 'md',
  showTagline = false,
  tagline = 'Focus on presence, not logistics'
}) => {
  const sizeClasses = {
    sm: {
      brand: 'text-3xl font-semibold',
      divider: 'w-16 h-px',
      spacing: 'space-y-2'
    },
    md: {
      brand: 'text-4xl font-semibold',
      divider: 'w-20 h-px',
      spacing: 'space-y-3'
    },
    lg: {
      brand: 'text-5xl font-semibold',
      divider: 'w-24 h-px',
      spacing: 'space-y-4'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn('text-center', classes.spacing, className)}>
      {/* Brand Logo/Wordmark */}
      <h1 className={cn(
        classes.brand,
        'text-gray-800 tracking-tight'
      )}>
        unveil
      </h1>
      
      {/* Decorative divider */}
      <div className={cn(
        classes.divider,
        'bg-gradient-to-r from-transparent via-rose-300 to-transparent mx-auto'
      )} />
      
      {/* Optional tagline */}
      {showTagline && (
        <p className="text-lg text-gray-600 font-light max-w-md mx-auto">
          {tagline}
        </p>
      )}
    </div>
  );
};

UnveilHeader.displayName = 'UnveilHeader';