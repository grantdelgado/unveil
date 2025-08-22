'use client';

import { MessageCircle, MessageCircleOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponseIndicatorProps {
  canRespond: boolean;
  reason?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ResponseIndicator({
  canRespond,
  reason,
  className,
  variant = 'default',
}: ResponseIndicatorProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1 text-xs', className)}>
        {canRespond ? (
          <>
            <MessageCircle className="h-3 w-3 text-green-600" />
            <span className="text-green-700">
              Announcements from your hosts
            </span>
          </>
        ) : (
          <>
            <MessageCircleOff className="h-3 w-3 text-gray-500" />
            <span className="text-gray-600">Replies disabled</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border text-sm',
        canRespond
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-gray-50 border-gray-200 text-gray-700',
        className,
      )}
    >
      <div className="flex-shrink-0">
        {canRespond ? (
          <MessageCircle className="h-5 w-5 text-green-600" />
        ) : (
          <MessageCircleOff className="h-5 w-5 text-gray-500" />
        )}
      </div>

      <div className="flex-1">
        <div className="font-medium">
          {canRespond ? 'Announcements from your hosts' : 'Announcements Only'}
        </div>

        <div className="text-xs mt-1 opacity-75">
          {canRespond
            ? 'Stay updated with messages from your event hosts.'
            : reason || 'This event shows announcements from your hosts only.'}
        </div>
      </div>

      {!canRespond && (
        <div className="flex-shrink-0">
          <Shield className="h-4 w-4 text-gray-400" />
        </div>
      )}
    </div>
  );
}
