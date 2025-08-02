'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { 
  RSVP_STATUS_VALUES, 
  getRSVPStatusConfig, 
  normalizeRSVPStatus,
  type RSVPStatus 
} from '@/lib/types/rsvp';

interface RSVPStatusSelectProps {
  value: string | null;
  onChange: (status: RSVPStatus) => void;
  guestName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RSVPStatusSelect = memo<RSVPStatusSelectProps>(({
  value,
  onChange,
  guestName,
  disabled = false,
  size = 'md',
  className
}) => {
  const currentStatus = normalizeRSVPStatus(value);
  const statusConfig = getRSVPStatusConfig(currentStatus);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 min-h-[32px] min-w-[100px]',
    md: 'text-sm px-3 py-2 min-h-[44px] min-w-[120px]',
    lg: 'text-base px-4 py-3 min-h-[48px] min-w-[140px]'
  };

  return (
    <select
      value={currentStatus}
      onChange={(e) => onChange(e.target.value as RSVPStatus)}
      disabled={disabled}
      className={cn(
        'border rounded focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B]',
        'transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        statusConfig.bgColor,
        statusConfig.textColor,
        statusConfig.borderColor,
        className
      )}
      aria-label={
        guestName 
          ? `RSVP status for ${guestName}. Currently ${statusConfig.label}`
          : `RSVP status. Currently ${statusConfig.label}`
      }
    >
      {RSVP_STATUS_VALUES.map((status) => {
        const config = getRSVPStatusConfig(status);
        return (
          <option key={status} value={status}>
            {config.emoji} {config.label}
          </option>
        );
      })}
    </select>
  );
});

RSVPStatusSelect.displayName = 'RSVPStatusSelect';