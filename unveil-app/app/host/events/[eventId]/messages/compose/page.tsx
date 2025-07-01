import React from 'react';
import { ComposePageClient } from './ComposePageClient';

interface ComposePageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function ComposePage({ params }: ComposePageProps) {
  const { eventId } = await params;

  return <ComposePageClient eventId={eventId} />;
} 