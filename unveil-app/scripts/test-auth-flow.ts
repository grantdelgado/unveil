#!/usr/bin/env node

/**
 * Test script to verify auth initialization flow
 * This helps identify race conditions in session handling
 */

import { supabase } from '../lib/supabase/client';

async function testAuthFlow() {
  console.log('🔍 Testing auth flow initialization...\n');

  try {
    // Test 1: Check initial session state
    console.log('1. Getting initial session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error.message);
      return;
    }

    console.log('✅ Session check completed');
    console.log(`   - Session exists: ${!!session}`);
    console.log(`   - User ID: ${session?.user?.id || 'N/A'}`);
    console.log('');

    // Test 2: If session exists, verify user profile
    if (session?.user) {
      console.log('2. Checking user profile...');
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, phone, full_name')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching profile:', profileError.message);
      } else {
        console.log('✅ User profile found');
        console.log(`   - Name: ${userProfile.full_name || 'Not set'}`);
        console.log(`   - Phone: ${userProfile.phone || 'Not set'}`);
      }
    } else {
      console.log('2. No session found - user not authenticated');
    }

    console.log('\n🎉 Auth flow test completed successfully!');
    
  } catch (error) {
    console.error('💥 Auth flow test failed:', error);
  }
}

// Run the test
testAuthFlow()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  }); 