import { NextRequest, NextResponse } from 'next/server';
import { sendEventAnnouncement } from '@/lib/sms';
import { createApiSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Create authenticated Supabase client from request cookies
    const supabase = createApiSupabaseClient(request);
    
    // Use getUser() instead of getSession() to validate JWT server-side
    // getSession() only reads cookies without validation, making it insecure
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
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

    // Verify user is the host of this event using RPC
    const { data: isHost, error: hostError } = await supabase.rpc(
      'is_event_host',
      { p_event_id: eventId },
    );

    if (hostError) {
      logger.apiError('Host check failed for send-announcement', hostError);
      return NextResponse.json(
        { error: 'Authorization check failed' },
        { status: 500 },
      );
    }

    if (!isHost) {
      return NextResponse.json(
        { error: 'Event not found or unauthorized' },
        { status: 403 },
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
