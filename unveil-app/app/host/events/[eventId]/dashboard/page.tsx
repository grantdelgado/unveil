import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { HostDashboardClient } from './HostDashboardClient';

interface PageProps {
  params: Promise<{ eventId: string }>;
}

/**
 * Server Component for Host Dashboard
 *
 * Security: All authorization checks happen on the server BEFORE any data is sent to the client.
 * This prevents:
 * - Unauthorized users from seeing loading states with event data
 * - Client-side auth bypass attempts
 * - Unnecessary client bundle for auth logic
 */
export default async function EventDashboardPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Redirect to login with return URL
    redirect(`/login?next=/host/events/${eventId}/dashboard`);
  }

  // 2. Verify host role using RPC
  const { data: isHost, error: hostError } = await supabase.rpc(
    'is_event_host',
    { p_event_id: eventId },
  );

  if (hostError) {
    console.error('Host authorization check failed:', hostError);
    // Show not found for security (don't reveal that the event exists)
    notFound();
  }

  if (!isHost) {
    // User is not a host for this event
    // Redirect to select-event rather than showing error (better UX)
    redirect('/select-event');
  }

  // 3. Fetch event data (user is authorized)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    if (eventError?.code === 'PGRST116') {
      // Event not found
      notFound();
    }
    console.error('Event fetch error:', eventError);
    notFound();
  }

  // 4. Render client component with pre-verified data
  return <HostDashboardClient event={event} eventId={eventId} />;
}
