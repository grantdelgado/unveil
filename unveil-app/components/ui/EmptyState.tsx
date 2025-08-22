'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  variant?: 'events' | 'guests' | 'media' | 'messages' | 'generic';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
  illustration?: 'default' | 'wedding' | 'photos' | 'messages' | 'guests';
}

const variantConfig = {
  events: {
    defaultTitle: 'No events yet',
    defaultDescription:
      'Ready to plan something special? Create your first event to get started.',
    defaultActionText: 'Create Event',
    illustration: 'wedding' as const,
    colors: {
      primary: 'from-rose-200 to-purple-200',
      secondary: 'from-rose-300 to-purple-300',
      accent: 'from-rose-400 to-purple-400',
    },
  },
  guests: {
    defaultTitle: 'No guests yet',
    defaultDescription:
      'Your guest list is ready for you. Add friends and family to share this special moment.',
    defaultActionText: 'Add Guests',
    illustration: 'guests' as const,
    colors: {
      primary: 'from-blue-200 to-indigo-200',
      secondary: 'from-blue-300 to-indigo-300',
      accent: 'from-blue-400 to-indigo-400',
    },
  },
  media: {
    defaultTitle: 'No memories yet',
    defaultDescription:
      'Beautiful moments are waiting to be captured and shared with your loved ones.',
    defaultActionText: 'Upload Photos',
    illustration: 'photos' as const,
    colors: {
      primary: 'from-emerald-200 to-teal-200',
      secondary: 'from-emerald-300 to-teal-300',
      accent: 'from-emerald-400 to-teal-400',
    },
  },
  messages: {
    defaultTitle: 'No messages yet',
    defaultDescription:
      'Start the conversation! Send updates and connect with your guests.',
    defaultActionText: 'Send Message',
    illustration: 'messages' as const,
    colors: {
      primary: 'from-amber-200 to-orange-200',
      secondary: 'from-amber-300 to-orange-300',
      accent: 'from-amber-400 to-orange-400',
    },
  },
  generic: {
    defaultTitle: 'Nothing here yet',
    defaultDescription: 'This section is waiting for content to appear.',
    defaultActionText: 'Get Started',
    illustration: 'default' as const,
    colors: {
      primary: 'from-gray-200 to-slate-200',
      secondary: 'from-gray-300 to-slate-300',
      accent: 'from-gray-400 to-slate-400',
    },
  },
};

const illustrations = {
  default: (colors: typeof variantConfig.generic.colors) => (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.primary} rounded-full opacity-20`}
      ></div>
      <div
        className={`absolute inset-2 bg-gradient-to-br ${colors.secondary} rounded-full opacity-40`}
      ></div>
      <div
        className={`absolute inset-4 bg-gradient-to-br ${colors.accent} rounded-full flex items-center justify-center`}
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      </div>
    </div>
  ),

  wedding: (colors: typeof variantConfig.events.colors) => (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.primary} rounded-full opacity-20`}
      ></div>
      <div
        className={`absolute inset-2 bg-gradient-to-br ${colors.secondary} rounded-full opacity-40`}
      ></div>
      <div
        className={`absolute inset-4 bg-gradient-to-br ${colors.accent} rounded-full flex items-center justify-center`}
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </div>
    </div>
  ),

  photos: (colors: typeof variantConfig.media.colors) => (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.primary} rounded-full opacity-20`}
      ></div>
      <div
        className={`absolute inset-2 bg-gradient-to-br ${colors.secondary} rounded-full opacity-40`}
      ></div>
      <div
        className={`absolute inset-4 bg-gradient-to-br ${colors.accent} rounded-full flex items-center justify-center`}
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    </div>
  ),

  messages: (colors: typeof variantConfig.messages.colors) => (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.primary} rounded-full opacity-20`}
      ></div>
      <div
        className={`absolute inset-2 bg-gradient-to-br ${colors.secondary} rounded-full opacity-40`}
      ></div>
      <div
        className={`absolute inset-4 bg-gradient-to-br ${colors.accent} rounded-full flex items-center justify-center`}
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
    </div>
  ),

  guests: (colors: typeof variantConfig.guests.colors) => (
    <div className="relative w-24 h-24 mx-auto mb-6">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.primary} rounded-full opacity-20`}
      ></div>
      <div
        className={`absolute inset-2 bg-gradient-to-br ${colors.secondary} rounded-full opacity-40`}
      ></div>
      <div
        className={`absolute inset-4 bg-gradient-to-br ${colors.accent} rounded-full flex items-center justify-center`}
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      </div>
    </div>
  ),
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  actionText,
  onAction,
  className,
  illustration: illustrationOverride,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const finalTitle = title || config.defaultTitle;
  const finalDescription = description || config.defaultDescription;
  const finalActionText = actionText || config.defaultActionText;
  const illustrationType = illustrationOverride || config.illustration;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 rounded-lg',
        'bg-gradient-to-br from-gray-50 to-white border border-gray-100',
        className,
      )}
    >
      <div className="max-w-sm mx-auto space-y-4">
        {/* Branded illustration */}
        {illustrations[illustrationType](config.colors)}

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">{finalTitle}</h3>
          <p className="text-gray-600 leading-relaxed">{finalDescription}</p>
        </div>

        {/* Action button */}
        {onAction && (
          <div className="pt-2">
            <button
              onClick={onAction}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all duration-200',
                'bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-600 hover:to-purple-600',
                'transform hover:scale-105 active:scale-95',
                'shadow-lg hover:shadow-xl',
                'focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2',
              )}
            >
              <span>{finalActionText}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Subtle encouragement text */}
        <div className="pt-2">
          <p className="text-xs text-gray-500">
            ✨ Every beautiful moment starts with a single step
          </p>
        </div>
      </div>
    </div>
  );
}

// Skeleton loader component for consistent loading states
export function SkeletonLoader({
  variant = 'card',
  count = 1,
  className,
}: {
  variant?: 'card' | 'list' | 'grid' | 'text';
  count?: number;
  className?: string;
}) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        );

      case 'list':
        return (
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded"></div>
          </div>
        );

      case 'grid':
        return (
          <div className="aspect-square bg-gray-200 rounded-lg animate-pulse"></div>
        );

      case 'text':
        return (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        );

      default:
        return (
          <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        );
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}

export default EmptyState;
