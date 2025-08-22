'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface StaticEventHeaderProps {
  event: Event;
  className?: string;
}

export function StaticEventHeader({
  event,
  className,
}: StaticEventHeaderProps) {
  const hasHeaderImage = event.header_image_url;

  if (!hasHeaderImage) {
    // Fallback gradient header when no image is available
    return (
      <div
        className={cn(
          'w-full h-48 md:h-64 bg-gradient-to-r from-purple-600 to-pink-600 relative overflow-hidden',
          className,
        )}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {event.title}
            </h1>
            <p className="text-white/90 text-sm md:text-base">Host Dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full h-48 md:h-64 relative overflow-hidden bg-gray-200',
        className,
      )}
    >
      {/* Cover Image */}
      <Image
        src={event.header_image_url!}
        alt={`${event.title} header image`}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
      />

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

      {/* Optional overlay content */}
      <div className="absolute bottom-4 left-4 right-4 text-white">
        <div className="inline-flex items-center gap-2 text-sm font-medium bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
          <span>👑</span>
          <span>Host View</span>
        </div>
      </div>
    </div>
  );
}
