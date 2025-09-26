'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserEvents } from '@/hooks/events';
import { useAuth } from '@/lib/auth/AuthProvider';

// Import server components
import { EventSelectionView } from './EventSelectionView';

/**
 * Client component that handles interactive functionality for event selection
 * Separated from server-rendered content for better performance
 */
export function EventSelectionClient() {
  const { events, loading, error, refetch } = useUserEvents();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle event selection with client-side navigation optimization
  const handleEventSelect = (event: {
    event_id: string;
    user_role: string;
    title: string;
  }) => {
    const path =
      event.user_role === 'host'
        ? `/host/events/${event.event_id}/dashboard`
        : `/guest/events/${event.event_id}/home`;
    router.push(path);
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  return (
    <EventSelectionView
      events={events}
      loading={loading}
      error={error}
      authLoading={authLoading}
      isAuthenticated={isAuthenticated}
      onEventSelect={handleEventSelect}
      onProfile={handleProfile}
      onRefetch={refetch}
    />
  );
}
