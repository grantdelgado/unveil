'use client';

import { ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

interface TimezoneSelectProps {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

// Common US timezones for wedding events
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: '', label: '───────────', disabled: true },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];

export function TimezoneSelect({
  id,
  value,
  onChange,
  disabled = false,
  error,
  className,
}: TimezoneSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'w-full rounded-md border-gray-300 shadow-sm focus:border-pink-300 focus:ring focus:ring-pink-200 focus:ring-opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-[16px] min-h-[44px]',
        error && 'border-red-300 focus:border-red-300 focus:ring-red-200',
        className,
      )}
    >
      {TIMEZONE_OPTIONS.map((option) => (
        <option
          key={option.value || 'separator'}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

