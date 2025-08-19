/**
 * Admin authentication and authorization utilities
 */

import { supabase } from '@/lib/supabase/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AdminVerificationResult {
  isAdmin: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify if the current user has admin privileges
 * Checks both JWT claims and database role
 */
export async function verifyAdminRole(userId?: string): Promise<AdminVerificationResult> {
  try {
    // If userId not provided, get from current session
    if (!userId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return { isAdmin: false, error: 'User not authenticated' };
      }
      userId = user.id;
    }

    // Check user role in database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (dbError || !userData) {
      return { isAdmin: false, error: 'User not found' };
    }

    // For now, check if user role is 'admin'
    // This can be extended to check specific permissions later
    const isAdmin = userData.role === 'admin';

    return {
      isAdmin,
      userId,
      error: isAdmin ? undefined : 'Insufficient privileges'
    };
  } catch (error) {
    return {
      isAdmin: false,
      error: error instanceof Error ? error.message : 'Admin verification failed'
    };
  }
}

/**
 * Server-side admin verification for API routes
 */
export async function verifyAdminRoleServer(): Promise<AdminVerificationResult> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { isAdmin: false, error: 'Authentication required' };
    }

    // Check user role in database using server client
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (dbError || !userData) {
      return { isAdmin: false, error: 'User not found' };
    }

    const isAdmin = userData.role === 'admin';

    return {
      isAdmin,
      userId: user.id,
      error: isAdmin ? undefined : 'Insufficient privileges'
    };
  } catch (error) {
    return {
      isAdmin: false,
      error: error instanceof Error ? error.message : 'Admin verification failed'
    };
  }
}

/**
 * Middleware-style admin guard for API routes
 * Returns 403 response if user is not admin
 */
export async function requireAdmin(_request?: Request): Promise<{ isAdmin: true; userId: string } | Response> {
  const verification = await verifyAdminRoleServer();
  
  if (!verification.isAdmin) {
    return new Response(
      JSON.stringify({ 
        error: verification.error || 'Admin access required',
        code: 'INSUFFICIENT_PRIVILEGES'
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { isAdmin: true, userId: verification.userId! };
}
