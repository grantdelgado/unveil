'use client';

import React from 'react';
import { ErrorBoundary, MessagingErrorFallback } from '@/components/ui/ErrorBoundary';
import { EnhancedMessageCenter } from '@/components/features/messaging/host';

interface MessagesPageClientProps {
  eventId: string;
}

export function MessagesPageClient({ eventId }: MessagesPageClientProps) {
  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-900 mb-6">Messages</h1>
          <EnhancedMessageCenter eventId={eventId} />
        </div>
      </div>
    </ErrorBoundary>
  );
} 