import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Test-only endpoint for ensuring test users and data exist
 * ONLY available in test environment with proper secret
 */
export async function POST(request: NextRequest) {
  // Security: Only available in test environment
  if (process.env.NODE_ENV !== 'test') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Security: Require test secret
  const testSecret = request.headers.get('x-e2e-test-secret');
  if (!testSecret || testSecret !== process.env.E2E_TEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userType, eventId } = body;

    if (!userType || !['host', 'guest'].includes(userType)) {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 });
    }

    // Create test users if they don't exist
    const testUsers = {
      host: {
        id: '00000000-0000-0000-0000-000000000001',
        phone: '+15551234567',
        email: 'e2e-host@example.com',
        full_name: 'E2E Test Host',
      },
      guest: {
        id: '00000000-0000-0000-0000-000000000002', 
        phone: '+15551234568',
        email: 'e2e-guest@example.com',
        full_name: 'E2E Test Guest',
      },
    };

    const userData = testUsers[userType as keyof typeof testUsers];

    // Create/update test user in database
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert(userData, { onConflict: 'id' });

    if (userError) {
      console.error('Test session: User creation error:', userError);
      return NextResponse.json({ error: 'Failed to create test user' }, { status: 500 });
    }

    // If eventId provided, ensure test user has access
    if (eventId) {
      if (userType === 'host') {
        // Ensure event exists and user is host
        const { error: eventError } = await supabaseAdmin
          .from('events')
          .upsert({
            id: eventId,
            title: 'E2E Test Event',
            event_date: '2024-12-31',
            host_user_id: userData.id,
            location: 'Test Location',
            time_zone: 'America/New_York',
          }, { onConflict: 'id' });

        if (eventError) {
          console.error('Test session: Event creation error:', eventError);
        }
      } else {
        // Ensure guest access exists
        const { error: guestError } = await supabaseAdmin
          .from('event_guests')
          .upsert({
            event_id: eventId,
            user_id: userData.id,
            phone: userData.phone,
            guest_name: userData.full_name,
            role: 'guest',
            rsvp_status: 'attending',
            sms_opt_out: false,
          }, { onConflict: 'event_id,user_id' });

        if (guestError) {
          console.error('Test session: Guest creation error:', guestError);
        }
      }
    }

    // Create auth user if not exists
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      phone: userData.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        full_name: userData.full_name,
      },
    });

    if (authError && !authError.message?.includes('already registered')) {
      console.error('Test session: Auth creation error:', authError);
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userId: userData.id,
      userType,
      phone: userData.phone,
      email: userData.email,
      eventId: eventId || null,
    });

  } catch (error) {
    console.error('Test session: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
