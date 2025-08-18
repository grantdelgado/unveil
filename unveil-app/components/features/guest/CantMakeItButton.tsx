'use client';

import { cn } from '@/lib/utils';

interface CantMakeItButtonProps {
  onClick: () => void;
  className?: string;
}

export function CantMakeItButton({ onClick, className }: CantMakeItButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center text-sm text-stone-600 hover:text-stone-800",
        "focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2 rounded-lg",
        "transition-colors duration-200 underline underline-offset-2",
        "min-h-[44px] px-2 py-1", // Ensure minimum touch target
        className
      )}
    >
      Can&apos;t make it?
    </button>
  );
}
