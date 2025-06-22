import React from 'react';
import { cn } from '@/lib/utils';

interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

// Primary Button Component
export const PrimaryButton: React.FC<BaseButtonProps> = ({
  children,
  className,
  loading = false,
  fullWidth = true,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'py-3 px-4 bg-[#FF6B6B] hover:bg-[#FF5A5A] text-white text-base font-medium rounded-lg shadow-sm',
        'transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2',
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Secondary Button Component
export const SecondaryButton: React.FC<BaseButtonProps> = ({
  children,
  className,
  loading = false,
  fullWidth = true,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'py-3 px-4 text-gray-600 text-base font-medium rounded-lg border border-gray-300',
        'hover:bg-gray-50 transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Icon Button Component (for profile buttons, etc.)
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  className,
  size = 'md',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <button
      className={cn(
        'bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200',
        'flex items-center justify-center',
        'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// Display Names
PrimaryButton.displayName = 'PrimaryButton';
SecondaryButton.displayName = 'SecondaryButton';
IconButton.displayName = 'IconButton'; 