import React from 'react';
import { cn } from '@/lib/utils';

interface LogoContainerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const LogoContainer: React.FC<LogoContainerProps> = ({
  className,
  size = 'md',
  children = '💍',
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-3xl',
    md: 'w-16 h-16 text-5xl',
    lg: 'w-20 h-20 text-6xl',
  };

  return (
    <div className={cn('flex justify-center mb-4', className)}>
      <div className={cn(
        'flex items-center justify-center',
        sizeClasses[size]
      )}>
        <span>{children}</span>
      </div>
    </div>
  );
};

LogoContainer.displayName = 'LogoContainer'; 