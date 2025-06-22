'use client';

import React from 'react';
import Image from 'next/image';
import { formatEventDate } from '@/lib/utils';
import { CardContainer } from '@/components/ui';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface EventHeaderProps {
  event: Event;
  participantCount: number;
  children?: React.ReactNode; // For QuickActions or other action elements
}

export function EventHeader({ 
  event, 
  participantCount, 
  children 
}: EventHeaderProps) {
  return (
    <CardContainer 
      maxWidth="xl" 
      className="bg-gradient-to-r from-purple-600 to-[#FF6B6B] text-white border-0"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-start gap-4">
            {/* Event Image */}
            {event.header_image_url && (
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-white/20">
                <Image
                  src={event.header_image_url}
                  alt={event.title}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* Host Badge & Event Details */}
            <div className="min-w-0 flex-1">
              {/* Host Badge */}
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
                <span className="text-lg">👑</span>
                <span className="text-sm font-medium">Host Dashboard</span>
              </div>
              
              {/* Event Title */}
              <h1 className="text-2xl font-bold mb-3 text-white">
                {event.title}
              </h1>
              
              {/* Event Meta Information */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-white/80">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <span className="font-medium">
                    {formatEventDate(event.event_date)}
                  </span>
                </div>
                
                {event.location && (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    <span className="font-medium">{event.location}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <span className="font-medium">
                    {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Description */}
          {event.description && (
            <p className="text-white/90 max-w-2xl leading-relaxed">
              {event.description}
            </p>
          )}
        </div>

        {/* Action Area - for QuickActions or other components */}
        {children && (
          <div className="flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </CardContainer>
  );
} 