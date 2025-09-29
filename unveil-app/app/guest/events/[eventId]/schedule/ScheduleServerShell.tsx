'use client';

import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  BackButton,
} from '@/components/ui';
import type { Database } from '@/app/reference/supabase.types';
import { ReactNode } from 'react';

type Event = Database['public']['Tables']['events']['Row'];

interface ScheduleServerShellProps {
  event: Event | null;
  error: string | null;
  eventId: string;
  children: ReactNode;
}

/**
 * Client component shell for the server-rendered schedule page
 * Handles interactive elements like navigation and error states
 */
export function ScheduleServerShell({ event, error, eventId, children }: ScheduleServerShellProps) {
  if (error || !event) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          <CardContainer className="p-8 text-center">
            <div className="text-4xl mb-4">😔</div>
            <PageTitle>Event Not Found</PageTitle>
            <SubTitle>
              {error || 'This event may have been moved or is no longer available.'}
            </SubTitle>
            <BackButton href="/select-event" className="mt-6">
              Return to Your Events
            </BackButton>
          </CardContainer>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper centered={false}>
      <div className="max-w-4xl mx-auto pt-4 pb-6">
        {/* Header - Static content for immediate render */}
        <div className="mb-6">
          <BackButton
            href={`/guest/events/${eventId}/home`}
            variant="subtle"
            className="mb-4"
          >
            Back to Event
          </BackButton>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {event.title} Schedule
          </h1>
          <SubTitle>
            A complete breakdown of celebration times and locations
          </SubTitle>
        </div>

        {/* Schedule Content */}
        {children}
      </div>
    </PageWrapper>
  );
}
