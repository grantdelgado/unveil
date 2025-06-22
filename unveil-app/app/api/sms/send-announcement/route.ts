import { NextRequest, NextResponse } from 'next/server';
import { sendEventAnnouncement } from '@/lib/sms';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { eventId, message, targetGuestIds } = await request.json();

    // Validate required fields
    if (!eventId || !message) {
      return NextResponse.json(
        { error: 'Event ID and message are required' },
        { status: 400 },
      );
    }

    // Message length validation
    if (message.length > 1500) {
      return NextResponse.json(
        { error: 'Message too long. Please keep it under 1500 characters.' },
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

    // Send the announcement
    const result = await sendEventAnnouncement(
      eventId,
      message,
      targetGuestIds,
    );

    // Also save the announcement as a message in the database
    try {
      await supabase.from('messages').insert({
        event_id: eventId,
        sender_user_id: user.id,
        content: message,
        message_type: 'announcement',
      });
    } catch (dbError) {
      console.error('Failed to save announcement to database:', dbError);
      // Don't fail the whole operation for this
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      message: `Successfully sent announcement to ${result.sent} guests${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
    });
  } catch (error) {
    console.error('❌ Error sending announcement:', error);
    return NextResponse.json(
      { error: 'Failed to send announcement' },
      { status: 500 },
    );
  }
}
