import React from 'react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/common/useHapticFeedback';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

const buttonVariants = {
  primary: 'bg-stone-800 text-white hover:bg-stone-900 focus:ring-stone-500 dark:bg-stone-700 dark:hover:bg-stone-600',
  secondary:
    'bg-stone-100 text-stone-900 hover:bg-stone-200 focus:ring-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700',
  outline:
    'border border-stone-300 bg-transparent text-stone-700 hover:bg-stone-50 focus:ring-stone-300 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-100 focus:ring-stone-300 dark:text-stone-300 dark:hover:bg-stone-800',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800',
};

const buttonSizes = {
  sm: 'px-3 py-2 text-sm min-h-[36px]', // Slightly smaller but still accessible
  md: 'px-4 py-3 text-base min-h-[44px]', // Standard touch target
  lg: 'px-6 py-4 text-lg min-h-[48px]', // Larger for CTAs
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const { triggerHaptic } = useHapticFeedback();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;
      
      // Trigger haptic feedback based on variant
      const hapticPattern = variant === 'destructive' ? 'warning' : 
                           variant === 'primary' ? 'medium' : 'light';
      triggerHaptic(hapticPattern);
      
      onClick?.(e);
    };

    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Enhanced transitions
          'transition-all duration-200 ease-in-out',
          'active:scale-95 hover:scale-[1.02]',
          'shadow-sm hover:shadow-md active:shadow-sm',
          // Touch target and accessibility
          'select-none touch-manipulation',
          // Variant styles
          buttonVariants[variant],
          // Size styles
          buttonSizes[size],
          className,
        )}
        disabled={disabled || isLoading}
        onClick={handleClick}
        ref={ref}
        {...props}
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
