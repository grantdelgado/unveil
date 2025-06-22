import React from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  className,
  centered = true,
}) => {
  return (
    <div
      className={cn(
        'min-h-screen bg-[#FAFAFA]',
        centered && 'flex items-center justify-center',
        'p-4 md:p-6',
        className,
      )}
    >
      {children}
    </div>
  );
};

PageWrapper.displayName = 'PageWrapper'; 