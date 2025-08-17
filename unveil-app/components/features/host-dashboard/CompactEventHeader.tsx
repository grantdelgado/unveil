'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface CompactEventHeaderProps {
  event: Event;
  className?: string;
}

export function CompactEventHeader({ event, className }: CompactEventHeaderProps) {
  return (
    <div className={cn(
      "bg-white border-b border-gray-200 shadow-sm",
      className
    )}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Left side - Back button and title */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Link
              href="/select-event"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Events</span>
            </Link>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                {event.title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Host Dashboard
              </p>
            </div>
          </div>

          {/* Right side - Optional actions */}
          <div className="flex items-center gap-2 ml-4">
            <Link
              href={`/host/events/${event.id}/details`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              title="Edit details"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden md:inline">Edit details</span>
            </Link>
            
            <Link
              href={`/guest/events/${event.id}/home`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              title="Preview guest view"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden md:inline">Preview guest view</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
