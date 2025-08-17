import { NextRequest, NextResponse } from 'next/server';
import { sendRSVPReminder } from '@/lib/sms';
import { supabase } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { eventId, guestIds } = await request.json();

    // Validate required fields
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 },
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 },
      );
    }

    // Verify the user is authenticated and is the host of this event
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 },
      );
    }

    // Verify user is the host of this event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id')
      .eq('id', eventId)
      .eq('host_user_id', user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or unauthorized' },
        { status: 404 },
      );
    }

    // Send the RSVP reminders
    const result = await sendRSVPReminder(eventId, guestIds);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      message: `Successfully sent ${result.sent} RSVP reminders${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
    });
  } catch (error) {
    console.error('❌ Error sending RSVP reminders:', error);
    return NextResponse.json(
      { error: 'Failed to send RSVP reminders' },
      { status: 500 },
    );
  }
}
