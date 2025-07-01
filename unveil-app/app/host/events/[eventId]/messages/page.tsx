import React from 'react';
import { MessagesPageClient } from './MessagesPageClient';

interface MessagesPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { eventId } = await params;
  
  return <MessagesPageClient eventId={eventId} />;
} 