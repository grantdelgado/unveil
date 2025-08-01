'use client';

import React from 'react';
import { ErrorBoundary, MessagingErrorFallback, LoadingSpinner } from '@/components/ui';
import { MessageComposer } from '@/components/features/messaging/host';
import { useGuests } from '@/hooks/guests';

interface ComposePageClientProps {
  eventId: string;
}

export function ComposePageClient({ eventId }: ComposePageClientProps) {
  const { guests, loading, error } = useGuests({ eventId });

  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-900 mb-6">Compose Message</h1>
          
          {loading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-red-800">
                Failed to load guests: {error.message || 'Unknown error'}
              </div>
            </div>
          )}
          
          {!loading && !error && (
            <MessageComposer 
              eventId={eventId} 
              guests={guests}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
} 