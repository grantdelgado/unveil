import React from 'react';
import { cn } from '@/lib/utils';

interface DevModeBoxProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const DevModeBox: React.FC<DevModeBoxProps> = ({
  title = "🚀 Development Mode",
  children,
  className,
}) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className={cn('mt-6 p-4 bg-[#EDF4FF] rounded-lg', className)}>
      <div className="text-sm">
        <div className="font-bold text-blue-800 mb-2">{title}</div>
        <div className="text-blue-700 space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
};

DevModeBox.displayName = 'DevModeBox'; 