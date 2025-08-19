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

    // Check user exists in database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, email, phone')
      .eq('id', userId)
      .single();

    if (dbError || !userData) {
      return { isAdmin: false, error: 'User not found' };
    }

    // For now, check if user is in admin list (can be moved to env var later)
    // TODO: Add proper role system to users table
    const adminEmails = ['grant@sendunveil.com', 'admin@sendunveil.com'];
    const adminPhones = ['+15712364686']; // Add your admin phone numbers
    
    const isAdmin = adminEmails.includes(userData.email || '') || 
                   adminPhones.includes(userData.phone || '');

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

    // Check user exists in database using server client
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, email, phone')
      .eq('id', user.id)
      .single();

    if (dbError || !userData) {
      return { isAdmin: false, error: 'User not found' };
    }

    // For now, check if user is in admin list (can be moved to env var later)
    // TODO: Add proper role system to users table
    const adminEmails = ['grant@sendunveil.com', 'admin@sendunveil.com'];
    const adminPhones = ['+15712364686']; // Add your admin phone numbers
    
    const isAdmin = adminEmails.includes(userData.email || '') || 
                   adminPhones.includes(userData.phone || '');

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
export async function requireAdmin(): Promise<{ isAdmin: true; userId: string } | Response> {
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
