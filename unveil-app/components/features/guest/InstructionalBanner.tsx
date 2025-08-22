'use client';

import { cn } from '@/lib/utils';

interface InstructionalBannerProps {
  className?: string;
}

export function InstructionalBanner({ className }: InstructionalBannerProps) {
  return (
    <div
      className={cn(
        'bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-600',
        className,
      )}
    >
      <p className="leading-relaxed">This page includes:</p>
      <ul className="mt-2 space-y-1 ml-2">
        <li className="flex items-center">
          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full mr-3 flex-shrink-0" />
          Info about the celebration
        </li>
        <li className="flex items-center">
          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full mr-3 flex-shrink-0" />
          Messages from your hosts
        </li>
        <li className="flex items-center">
          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full mr-3 flex-shrink-0" />
          A shared photo album to capture memories
        </li>
      </ul>
    </div>
  );
}
