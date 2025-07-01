import React from 'react';
import { ScheduledPageClient } from './ScheduledPageClient';

interface ScheduledPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function ScheduledPage({ params }: ScheduledPageProps) {
  const { eventId } = await params;

  return <ScheduledPageClient eventId={eventId} />;
} 