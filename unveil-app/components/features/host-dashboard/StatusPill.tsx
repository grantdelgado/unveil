'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  statusKey: string;
  label: string;
  icon: string;
  count: number;
  isActive: boolean;
  bgColor: string;
  activeColor: string;
  textColor: string;
  activeTextColor: string;
  onClick: () => void;
}

export const StatusPill = memo<StatusPillProps>(({
  statusKey,
  label,
  icon,
  count,
  isActive,
  bgColor,
  activeColor,
  textColor,
  activeTextColor,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200',
        'text-sm font-medium min-h-[40px] whitespace-nowrap flex-shrink-0',
        'transform hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6B6B]',
        isActive
          ? `${activeColor} ${activeTextColor} shadow-md`
          : `${bgColor} ${textColor} hover:shadow-sm`
      )}
      type="button"
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          'text-xs px-2 py-0.5 rounded-full font-semibold min-w-[20px] text-center',
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-white text-gray-600 shadow-sm'
        )}
      >
        {count}
      </span>
    </button>
  );
});

StatusPill.displayName = 'StatusPill';