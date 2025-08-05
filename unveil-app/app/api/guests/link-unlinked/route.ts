/**
 * API Route: /api/guests/link-unlinked
 * Purpose: Link unlinked guest records to user accounts on login
 * Used for login-time backfill of guest-user relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { linkGuestRecordsToUser } from '@/lib/db/linkGuestRecords';
import { logger } from '@/lib/logger';

interface LinkUnlinkedRequest {
  userId?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user session with proper cookie handling
    const supabase = createRouteHandlerClient({ cookies });
    
    // Attempt to get session from cookies first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    let currentUser = session?.user;

    if (sessionError || !currentUser) {
      // Try to get session from Authorization header as fallback
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !user) {
          return NextResponse.json(
            { error: 'Authentication required - invalid token' },
            { status: 401 }
          );
        }
        
        currentUser = user;
      } else {
        return NextResponse.json(
          { error: 'Authentication required - no session or token found' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body: LinkUnlinkedRequest = await request.json();
    const userId = body.userId || currentUser.id;
    const phone = body.phone;

    logger.info('Parsed guest linking request', {
      bodyUserId: body.userId,
      bodyPhone: body.phone,
      currentUserId: currentUser.id,
      currentUserPhone: currentUser.phone,
      userMetadataPhone: currentUser.user_metadata?.phone,
      appMetadataPhone: currentUser.app_metadata?.phone
    });

    // Validate required parameters
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!phone) {
      // Try to get phone from user metadata
      const sessionPhone = currentUser.phone || 
                          currentUser.user_metadata?.phone ||
                          currentUser.app_metadata?.phone;
      
      if (!sessionPhone) {
        logger.error('No phone number found in request or session', {
          userId,
          requestPhone: phone,
          sessionPhone: currentUser.phone,
          userMetadata: currentUser.user_metadata,
          appMetadata: currentUser.app_metadata
        });
        return NextResponse.json(
          { error: 'Phone number is required and not found in session' },
          { status: 400 }
        );
      }
    }

    const finalPhone = phone || currentUser.phone || 
                      currentUser.user_metadata?.phone ||
                      currentUser.app_metadata?.phone;

    logger.info('Using phone number for linking', {
      finalPhone,
      source: phone ? 'request' : 'session'
    });

    // Security check: ensure user can only link their own records
    if (userId !== currentUser.id) {
      logger.warn('User attempted to link records for different user', {
        requestedUserId: userId,
        sessionUserId: currentUser.id,
        phone: finalPhone
      });
      return NextResponse.json(
        { error: 'Cannot link records for other users' },
        { status: 403 }
      );
    }

    logger.info('Processing guest record linking request', {
      userId,
      phone: finalPhone,
      sessionUserId: currentUser.id
    });

    // ✅ Perform the guest record linking using our shared helper
    const result = await linkGuestRecordsToUser(userId, finalPhone, true);

    if (!result.success) {
      logger.error('Guest record linking failed', {
        userId,
        phone: finalPhone,
        error: result.error
      });
      return NextResponse.json(
        { error: result.error || 'Failed to link guest records' },
        { status: 500 }
      );
    }

    logger.info('Guest record linking successful', {
      userId,
      phone: finalPhone,
      linkedCount: result.linkedCount
    });

    // Return success response with linking details
    return NextResponse.json({
      success: true,
      linkedCount: result.linkedCount,
      message: result.linkedCount > 0 
        ? `Successfully linked ${result.linkedCount} guest record(s)` 
        : 'No unlinked guest records found for this phone number'
    });

  } catch (error) {
    logger.error('Unexpected error in link-unlinked API', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS if needed
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}