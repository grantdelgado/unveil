'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MessageJoinBoundaryProps {
  joinDate: Date;
  className?: string;
}

export function MessageJoinBoundary({ joinDate, className }: MessageJoinBoundaryProps) {
  const formattedDate = joinDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  return (
    <div
      role="separator"
      aria-label={`You joined this event on ${formattedDate}. Messages above were sent before you joined.`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 my-2',
        'bg-stone-100/80 border-y border-stone-200/60',
        'text-sm text-stone-600',
        className
      )}
    >
      <div className="flex-1 h-px bg-stone-300/50" />
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-stone-200/80 shadow-sm">
        <Clock className="h-3.5 w-3.5 text-stone-500" />
        <span className="font-medium">
          You joined on {formattedDate}
        </span>
      </div>
      <div className="flex-1 h-px bg-stone-300/50" />
    </div>
  );
}
