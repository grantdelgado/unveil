import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Server-side auth routing logic
 * Determines where to redirect users based on their auth state and available events
 */

export interface AuthRoutingResult {
  redirect: string;
  reason: string;
}

/**
 * Get the appropriate redirect path for a user based on their auth state
 * This runs on the server to avoid client-side flashes
 */
export async function getAuthRedirect(): Promise<AuthRoutingResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Log routing decision in development
    if (process.env.NODE_ENV === 'development') {
      console.info('[ServerRouting] Checking auth state...');
    }

    // No session - redirect to login
    if (sessionError || !session?.user) {
      if (process.env.NODE_ENV === 'development') {
        console.info('[ServerRouting] route: / → /login (no session)');
      }
      return {
        redirect: '/login',
        reason: 'no_session'
      };
    }

    const userId = session.user.id;

    // Check for events where user is a guest (server-side query)
    const { data: guestEventData, error: guestError } = await supabase
      .from('event_guests')
      .select(`
        event_id,
        events!inner (
          id,
          title,
          event_date,
          location,
          is_public,
          allow_open_signup
        )
      `)
      .eq('user_id', userId)
      .eq('events.is_public', true);

    // Check for events where user is a host (server-side query)
    const { data: hostEventData, error: hostError } = await supabase
      .from('events')
      .select('id, title, event_date, location')
      .eq('host_user_id', userId)
      .order('event_date', { ascending: false });

    const guestEvents = guestError ? [] : (guestEventData?.map((eg) => eg.events) || []);
    const hostEvents = hostError ? [] : (hostEventData || []);

    // If user has both guest and host events, or multiple events, go to select-event
    if ((guestEvents.length + hostEvents.length) > 1) {
      if (process.env.NODE_ENV === 'development') {
        console.info(`[ServerRouting] route: / → /select-event (${guestEvents.length} guest, ${hostEvents.length} host events)`);
      }
      return {
        redirect: '/select-event',
        reason: 'multiple_events'
      };
    }

    // If user has exactly one guest event, redirect to it
    if (guestEvents.length === 1 && hostEvents.length === 0) {
      const eventId = guestEvents[0].id;
      if (process.env.NODE_ENV === 'development') {
        console.info(`[ServerRouting] route: / → /guest/events/${eventId} (single guest event)`);
      }
      return {
        redirect: `/guest/events/${eventId}`,
        reason: 'single_guest_event'
      };
    }

    // If user has exactly one host event, redirect to it
    if (hostEvents.length === 1 && guestEvents.length === 0) {
      const eventId = hostEvents[0].id;
      if (process.env.NODE_ENV === 'development') {
        console.info(`[ServerRouting] route: / → /host/events/${eventId}/dashboard (single host event)`);
      }
      return {
        redirect: `/host/events/${eventId}/dashboard`,
        reason: 'single_host_event'
      };
    }

    // No events found - redirect to select-event (which will show create/join options)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ServerRouting] route: / → /select-event (no events)');
    }
    return {
      redirect: '/select-event',
      reason: 'no_events'
    };

  } catch (error) {
    // On error, redirect to login as fallback
    console.error('[ServerRouting] Error determining auth redirect:', error);
    if (process.env.NODE_ENV === 'development') {
      console.info('[ServerRouting] route: / → /login (error fallback)');
    }
    return {
      redirect: '/login',
      reason: 'error_fallback'
    };
  }
}
