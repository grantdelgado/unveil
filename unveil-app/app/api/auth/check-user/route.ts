import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Create Supabase client for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, phone } = await request.json();

    if (!userId || !phone) {
      return NextResponse.json(
        { error: 'Missing userId or phone' },
        { status: 400 }
      );
    }

    // Check if user exists in users table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, phone, onboarding_completed')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new users
      console.error('Error checking user:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check user status' },
        { status: 500 }
      );
    }

    let userCreated = false;

    // If user doesn't exist, create them
    if (!existingUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          phone: phone,
          onboarding_completed: false,
        });

      if (insertError) {
        console.error('Error creating user:', insertError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userCreated = true;
      
      return NextResponse.json({
        userExists: true, // Now exists since we created it
        onboardingCompleted: false,
        userCreated: true,
      });
    }

    // User exists, return their status
    return NextResponse.json({
      userExists: true,
      onboardingCompleted: existingUser.onboarding_completed,
      userCreated: false,
    });

  } catch (error) {
    console.error('API error in check-user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 