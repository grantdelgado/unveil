'use client';

import { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type HeaderChipVariant = 'primary' | 'success' | 'warning' | 'destructive' | 'neutral' | 'muted';

interface HeaderChipProps {
  variant: HeaderChipVariant;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  microcopy?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Uniform header chip component for guest cards
 * Ensures consistent sizing across all states (interactive and non-interactive)
 */
export const HeaderChip = memo<HeaderChipProps>(({
  variant,
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  loadingText = 'Loading...',
  microcopy,
  className,
  'aria-label': ariaLabel,
}) => {
  // Shared base styles for uniform sizing
  const baseStyles = cn(
    'px-3 py-2 text-sm font-medium rounded-xl',
    'min-h-[44px] w-[120px] flex items-center justify-center gap-2',
    'transition-colors duration-200'
  );

  // Variant-specific styles
  const variantStyles = {
    primary: cn(
      'text-white bg-pink-600 hover:bg-pink-700',
      'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-1',
      disabled && 'opacity-75 cursor-not-allowed'
    ),
    success: 'bg-blue-50 text-blue-700 border border-blue-200',
    warning: 'bg-red-50 text-red-700 border border-red-200',
    destructive: 'bg-orange-50 text-orange-700 border border-orange-200',
    neutral: 'bg-purple-50 text-purple-700 border border-purple-200',
    muted: 'bg-gray-50 text-gray-600 border border-gray-200'
  };

  const chipStyles = cn(
    baseStyles,
    variantStyles[variant],
    className
  );

  const content = loading ? (
    <>
      <span className="animate-spin size-4">⏳</span>
      <span>{loadingText}</span>
    </>
  ) : (
    <>
      <span className="size-4 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </>
  );

  return (
    <div className="text-center">
      {onClick ? (
        <button
          onClick={onClick}
          disabled={disabled || loading}
          className={chipStyles}
          aria-label={ariaLabel || `${label} action`}
        >
          {content}
        </button>
      ) : (
        <div
          className={chipStyles}
          aria-label={ariaLabel || `Status: ${label}`}
          role="status"
        >
          {content}
        </div>
      )}
      
      {/* Microcopy */}
      {microcopy && (
        <p className="text-xs text-gray-500 mt-1">
          {microcopy}
        </p>
      )}
    </div>
  );
});

HeaderChip.displayName = 'HeaderChip';
