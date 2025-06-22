import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Create admin client only if needed (will be called conditionally)
const getSupabaseAdmin = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

interface CreateUserRequest {
  name: string;
  email: string;
  role: 'host' | 'guest' | 'admin';
  phone?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // Environment guard - return early for production builds
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Admin API only available in development' },
        { status: 403 },
      );
    }

    // Validate service role key exists
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 },
      );
    }

    const body: CreateUserRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, role' },
        { status: 400 },
      );
    }

    // Validate role
    if (!['host', 'guest', 'admin'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be host, guest, or admin' },
        { status: 400 },
      );
    }

    // Generate secure test password
    const password = `test-${body.role}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

    // Create Supabase Auth user
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password,
        email_confirm: true, // Skip email verification in development
        user_metadata: {
          full_name: body.name,
          phone:
            body.phone ||
            `+1555${Math.floor(Math.random() * 9000000) + 1000000}`,
          role: body.role,
          test_user: true,
          created_by: 'admin-api',
          created_at: new Date().toISOString(),
          ...body.metadata,
        },
      });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
        { status: 500 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No user returned from auth creation' },
        { status: 500 },
      );
    }

    // Wait for database trigger to create user profile
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify user profile exists
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.warn(
        'User profile not found, creating manually:',
        profileError.message,
      );

      // Create user profile manually if trigger failed
      const { error: insertError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        email: body.email,
        full_name: body.name,
        phone: body.phone || authData.user.user_metadata.phone,
        role: body.role,
        avatar_url: body.avatar,
      });

      if (insertError) {
        console.error('Failed to create user profile:', insertError);
        // Don't fail the request, just warn
      }
    }

    // Generate development login URL
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('dev_email', body.email);
    loginUrl.searchParams.set('dev_password', password);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: body.email,
        name: body.name,
        role: body.role,
        created_at: authData.user.created_at,
      },
      credentials: {
        email: body.email,
        password,
      },
      login_url: loginUrl.toString(),
      message: 'Test user created successfully',
    });
  } catch (error) {
    console.error('Unexpected error in test user creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  // Environment guard - return early for production builds
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Admin API only available in development' },
      { status: 403 },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // List test users
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, phone, created_at')
      .like('email', '%@test.local')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch users: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      users: users || [],
      count: users?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching test users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Environment guard - return early for production builds
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Admin API only available in development' },
      { status: 403 },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const all = searchParams.get('all') === 'true';

    if (all) {
      // Delete all test users
      const { data: users, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name')
        .like('email', '%@test.local');

      if (fetchError) {
        return NextResponse.json(
          { error: `Failed to fetch users: ${fetchError.message}` },
          { status: 500 },
        );
      }

      const deletedUsers = [];
      const errors = [];

      for (const user of users || []) {
        try {
          const { error: deleteError } =
            await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (deleteError) {
            errors.push(`${user.email}: ${deleteError.message}`);
          } else {
            deletedUsers.push(user.email);
          }
        } catch (userError) {
          console.error('Error deleting user:', userError);
          errors.push(`${user.email}: Unexpected error`);
        }
      }

      return NextResponse.json({
        success: true,
        deleted: deletedUsers,
        errors,
        message: `Deleted ${deletedUsers.length} users${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      });
    } else if (userId) {
      // Delete specific user
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        return NextResponse.json(
          { error: `Failed to delete user: ${error.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: 'User deleted successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Must provide userId or all=true' },
        { status: 400 },
      );
    }
  } catch (deleteError) {
    console.error('Error deleting test users:', deleteError);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
