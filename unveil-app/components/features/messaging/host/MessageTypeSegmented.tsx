'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Megaphone, Tags, MessageSquare } from 'lucide-react';
import type { EventCapabilities } from '@/hooks/useEventCapabilities';

type MessageType = 'announcement' | 'channel' | 'direct';

interface MessageTypeSegmentedProps {
  value: MessageType;
  onChange: (value: MessageType) => void;
  className?: string;
  capabilities?: EventCapabilities;
}

const messageTypeConfig = {
  announcement: {
    label: 'Announcement',
    icon: Megaphone,
    description: 'Everyone in this event',
  },
  channel: {
    label: 'Channel',
    icon: Tags,
    description: 'Guests with selected tags',
  },
  direct: {
    label: 'Direct',
    icon: MessageSquare,
    description: 'Selected recipients only',
  },
} as const;

export function MessageTypeSegmented({
  value,
  onChange,
  className,
  capabilities,
}: MessageTypeSegmentedProps) {
  const handleKeyDown = (event: React.KeyboardEvent, type: MessageType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(type);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const types: MessageType[] = ['announcement', 'channel', 'direct'];
      const currentIndex = types.indexOf(value);
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const nextIndex =
        (currentIndex + direction + types.length) % types.length;
      onChange(types[nextIndex]);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Pills Container */}
      <div
        role="tablist"
        aria-label="Message type"
        className="flex gap-2 overflow-x-auto"
      >
        {(Object.keys(messageTypeConfig) as MessageType[]).map((type) => {
          const config = messageTypeConfig[type];
          const isActive = value === type;
          
          // Check capabilities for message types
          const isDisabled = capabilities ? (
            (type === 'announcement' && !capabilities.canSendAnnouncements) ||
            (type === 'channel' && !capabilities.canSendChannels)
          ) : false;

          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${config.label}: ${config.description}${isDisabled ? ' (Not available)' : ''}`}
              onClick={() => {
                if (!isDisabled) {
                  onChange(type);
                  // Dev-only observability
                  if (process.env.NODE_ENV === 'development') {
                    console.log('ui:typeSelector:changed', { type });
                  }
                }
              }}
              onKeyDown={(e) => !isDisabled && handleKeyDown(e, type)}
              disabled={isDisabled}
              className={cn(
                // Base styles - pill shape with adequate touch target
                'inline-flex h-11 items-center justify-center gap-2 px-4 rounded-full transition-all duration-200',
                'text-center touch-manipulation whitespace-nowrap font-medium text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                // State styles
                isDisabled
                  ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                  : isActive
                  ? 'bg-purple-600 text-white border-2 border-purple-600 shadow-sm'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50',
              )}
              tabIndex={isDisabled ? -1 : 0}
            >
              <span>{config.label}</span>
              {isDisabled && <span className="text-xs">🔒</span>}
            </button>
          );
        })}
      </div>

      {/* Sublabel with audience explanation */}
      <div className="mt-3 text-xs text-gray-600 text-center">
        Audience controls who can see this. Notified now (SMS) shows who gets a text.
      </div>
    </div>
  );
}
