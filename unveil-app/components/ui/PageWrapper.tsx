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
        'min-h-mobile bg-[#FAFAFA]',
        centered && 'flex items-center justify-center',
        // Enhanced responsive padding with mobile optimizations
        'p-3 xs:p-4 sm:p-6 md:p-8',
        // Mobile-first responsive width handling
        'max-w-md mx-auto sm:max-w-none',
        className,
      )}
    >
      {children}
    </div>
  );
};

PageWrapper.displayName = 'PageWrapper'; 