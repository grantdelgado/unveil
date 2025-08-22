'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Megaphone, Tags, MessageSquare } from 'lucide-react';

type MessageType = 'announcement' | 'channel' | 'direct';

interface MessageTypeSegmentedProps {
  value: MessageType;
  onChange: (value: MessageType) => void;
  className?: string;
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
      {/* Segmented Control */}
      <div
        role="radiogroup"
        aria-label="Message type"
        className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-gray-100 w-full"
      >
        {(Object.keys(messageTypeConfig) as MessageType[]).map((type) => {
          const config = messageTypeConfig[type];
          const Icon = config.icon;
          const isActive = value === type;

          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${config.label}: ${config.description}`}
              onClick={() => onChange(type)}
              onKeyDown={(e) => handleKeyDown(e, type)}
              className={cn(
                // Base styles - icon above label layout
                'inline-flex h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border transition-all duration-200',
                'text-center touch-manipulation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                // State styles
                isActive
                  ? 'bg-white text-gray-900 shadow-sm border-gray-200'
                  : 'bg-transparent text-gray-600 border-transparent hover:bg-white/50 hover:text-gray-900',
              )}
              tabIndex={isActive ? 0 : -1}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="text-[12px] sm:text-sm leading-tight font-medium whitespace-normal break-words">
                {config.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Type Description */}
      <div className="mt-3 text-sm text-gray-600">
        <div
          className={cn(
            'rounded-lg p-3 border',
            value === 'announcement' &&
              'bg-purple-50 border-purple-200 text-purple-800',
            value === 'channel' && 'bg-blue-50 border-blue-200 text-blue-800',
            value === 'direct' && 'bg-gray-50 border-gray-200 text-gray-800',
          )}
        >
          <div className="font-medium mb-1">
            Audience: {messageTypeConfig[value].description}
          </div>
          <div
            className={cn(
              'text-sm',
              value === 'announcement' && 'text-purple-700',
              value === 'channel' && 'text-blue-700',
              value === 'direct' && 'text-gray-700',
            )}
          >
            {value === 'announcement' &&
              'Visible in app to all current and future guests.'}
            {value === 'channel' &&
              'Visible in app to anyone with these tags (past & future).'}
            {value === 'direct' && 'Visible only to the selected recipients.'}
          </div>
        </div>
      </div>
    </div>
  );
}
