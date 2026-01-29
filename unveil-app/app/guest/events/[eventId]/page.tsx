import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GuestEventJoinClient } from './GuestEventJoinClient';

interface PageProps {
  params: Promise<{ eventId: string }>;
}

/**
 * Server Component for Guest Event Join Page
 *
 * Security: Event existence is validated on the server before any data is sent.
 * This prevents:
 * - Information leakage about non-existent events
 * - Unnecessary client-side fetching for invalid event IDs
 *
 * Note: This page allows unauthenticated access to show the join gate.
 * The client component handles the authentication flow.
 */
export default async function GuestEventJoinPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  // 1. Validate event exists (basic info only - no sensitive data)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, event_date, location, time_zone')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    // Event not found - show 404
    notFound();
  }

  // 2. Check if user is authenticated (optional for join gate)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Render client component with pre-validated data
  return (
    <GuestEventJoinClient
      eventInfo={event}
      eventId={eventId}
      isAuthenticated={!!user}
      userId={user?.id}
      userPhone={user?.phone}
    />
  );
}
