import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ScheduleContent } from './ScheduleContent';
import { ScheduleServerShell } from './ScheduleServerShell';
import type { Database } from '@/app/reference/supabase.types';

// Types used in the getScheduleData function
type Event = Database['public']['Tables']['events']['Row'];
type ScheduleItem = Database['public']['Tables']['event_schedule_items']['Row'];

interface PageProps {
  params: Promise<{ eventId: string }>;
}

/**
 * Server-side data fetching for schedule page
 * Uses server Supabase client with RLS enforcement
 */
async function getScheduleData(eventId: string): Promise<{
  event: Event | null;
  scheduleItems: ScheduleItem[];
  error: string | null;
}> {
  // Check authentication first (outside try-catch to allow redirect)
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    console.error('Schedule SSR: Failed to create Supabase client');
    return { event: null, scheduleItems: [], error: 'Service unavailable' };
  }
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  try {

  // Fetch event data (RLS will enforce access control)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError) {
    console.error('Schedule SSR: Event fetch error:', eventError);
    return { event: null, scheduleItems: [], error: 'Event not found' };
  }

  // Verify user has access to this event (distinguish errors from no access)
  const { data: guestCheck, error: guestError } = await supabase
    .from('event_guests')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .is('removed_at', null)
    .maybeSingle();

  if (guestError) {
    console.error('Schedule SSR: Database error checking guest access:', guestError);
    return { event: null, scheduleItems: [], error: 'Database error occurred' };
  }
  
  if (!guestCheck) {
    console.warn('Schedule SSR: User not a guest of this event:', { eventId, userId: user.id });
    return { event: null, scheduleItems: [], error: 'Access denied' };
  }

  // Fetch schedule items
  const { data: scheduleItems, error: scheduleError } = await supabase
    .from('event_schedule_items')
    .select('*')
    .eq('event_id', eventId)
    .order('start_at', { ascending: true });

  if (scheduleError) {
    console.error('Schedule SSR: Schedule items fetch error:', scheduleError);
    return { event, scheduleItems: [], error: 'Failed to load schedule' };
  }

    return { 
      event, 
      scheduleItems: scheduleItems || [], 
      error: null 
    };
  } catch (error) {
    console.error('Schedule SSR: Unexpected error:', error);
    return { 
      event: null, 
      scheduleItems: [], 
      error: 'An unexpected error occurred' 
    };
  }
}

/**
 * Server-rendered schedule page with streaming for fast first paint
 */
export default async function GuestEventSchedulePage({ params }: PageProps) {
  const { eventId } = await params;
  
  // Server-side data fetch with error handling
  const { event, scheduleItems, error } = await getScheduleData(eventId);

  return (
    <ScheduleServerShell 
      event={error ? null : event}
      error={error}
      eventId={eventId}
    >
      {!error && event && (
        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          }
        >
          <ScheduleContent
            event={event}
            scheduleItems={scheduleItems}
            eventId={eventId}
          />
        </Suspense>
      )}
    </ScheduleServerShell>
  );
}

// Enable revalidation for balanced performance (30 seconds)
export const revalidate = 30;
