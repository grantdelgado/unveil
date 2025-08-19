import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/adminAuth';

// Removed unused interface - using inline type instead
// interface BackfillResult {
//   updated_count: number;
//   total_eligible_count: number;
//   details: string;
// }

/**
 * Admin endpoint to trigger user_id backfill in event_guests table
 * 
 * POST /api/admin/backfill-user-ids
 * 
 * Safely updates event_guests.user_id where:
 * - user_id is currently NULL
 * - phone number matches an existing user
 * - Will NOT overwrite existing user_id values
 * 
 * Returns:
 * - updated_count: number of rows updated
 * - total_eligible_count: number of rows that were eligible for update
 * - details: human-readable status message
 */
export async function POST(request: Request) {
  try {
    // Verify admin privileges first
    const adminCheck = await requireAdmin();
    if (adminCheck instanceof Response) {
      return adminCheck; // Return 403 if not admin
    }

    // Create Supabase client
    const supabase = createApiSupabaseClient(request);

    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Optional: Add admin role check here if you have role-based permissions
    // For now, any authenticated user can run this (consider restricting in production)

    console.log('🔄 Admin triggering user_id backfill...', {
      userId: session.user.id,
      timestamp: new Date().toISOString()
    });

    // Execute the backfill function
    const { data, error } = await supabase
      .rpc('backfill_user_id_from_phone');

    if (error) {
      console.error('❌ Backfill function error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to execute backfill',
          details: error.message 
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          error: 'No results returned from backfill function',
          updated_count: 0,
          total_eligible_count: 0,
          details: 'Function executed but returned no data'
        },
        { status: 500 }
      );
    }

    const result = data[0] as { updated_count: number; total_eligible_count: number; details: string };

    console.log('✅ Backfill completed:', {
      updated_count: result.updated_count,
      total_eligible_count: result.total_eligible_count,
      details: result.details,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      updated_count: result.updated_count,
      total_eligible_count: result.total_eligible_count,
      details: result.details,
      timestamp: new Date().toISOString(),
      executed_by: session.user.id
    });

  } catch (err) {
    console.error('❌ Unexpected error in backfill endpoint:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current state without running backfill
 */
export async function GET(request: Request) {
  try {
    // Verify admin privileges first
    const adminCheck = await requireAdmin();
    if (adminCheck instanceof Response) {
      return adminCheck; // Return 403 if not admin
    }

    const supabase = createApiSupabaseClient(request);

    // Count rows that would be eligible for backfill
    const { data, error } = await supabase
      .from('event_guests')
      .select('id', { count: 'exact' })
      .is('user_id', null)
      .not('phone', 'is', null);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to check current state', details: error.message },
        { status: 500 }
      );
    }

    const eligibleCount = data?.length || 0;

    // Check total event_guests count
    const { count: totalCount, error: countError } = await supabase
      .from('event_guests')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json(
        { error: 'Failed to get total count', details: countError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      total_event_guests: totalCount || 0,
      eligible_for_backfill: eligibleCount,
      ready_to_run: eligibleCount > 0,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Unexpected error in backfill status endpoint:', err);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
