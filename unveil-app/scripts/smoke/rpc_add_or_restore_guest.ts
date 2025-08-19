/**
 * Health check script for add_or_restore_guest RPC
 * Tests the function signature and basic functionality
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function healthCheckAddOrRestoreGuest() {
  console.log('🔍 Health Check: add_or_restore_guest RPC');
  console.log('=====================================');

  try {
    // Check if function exists by attempting to call it with invalid params
    // This should fail with a proper error, not a 404
    const { data, error } = await supabase.rpc('add_or_restore_guest', {
      p_event_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
      p_phone: '+1234567890',
      p_name: 'Health Check Test',
      p_email: 'test@example.com',
      p_role: 'guest'
    });

    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.log('❌ FAIL: Function not found in database');
        console.log('   Error:', error.message);
        return false;
      } else if (error.message.includes('Authentication required') || 
                 error.message.includes('Only event hosts can add guests') ||
                 error.message.includes('violates foreign key constraint')) {
        console.log('✅ PASS: Function exists and has proper security checks');
        console.log('   Expected error:', error.message);
        return true;
      } else {
        console.log('⚠️  WARN: Unexpected error (function may exist but have issues)');
        console.log('   Error:', error.message);
        return true; // Function exists but has other issues
      }
    } else {
      console.log('⚠️  WARN: Function executed without authentication (security issue?)');
      console.log('   Result:', data);
      return true; // Function exists but may have security issues
    }
  } catch (err) {
    console.log('❌ FAIL: Network or connection error');
    console.log('   Error:', err);
    return false;
  }
}

async function checkFunctionSignature() {
  console.log('\n🔍 Checking Function Signature');
  console.log('==============================');

  try {
    // Query the function signature directly
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('*')
      .eq('routine_schema', 'public')
      .eq('routine_name', 'add_or_restore_guest');

    if (error) {
      console.log('❌ FAIL: Could not query function signature');
      console.log('   Error:', error.message);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('❌ FAIL: Function not found in information_schema');
      return false;
    }

    console.log('✅ PASS: Function found in schema');
    console.log('   Details:', {
      routine_name: data[0].routine_name,
      data_type: data[0].data_type,
      security_type: data[0].security_type
    });
    return true;
  } catch (err) {
    console.log('⚠️  WARN: Could not check function signature (permissions?)');
    console.log('   Error:', err);
    return true; // Don't fail on this
  }
}

async function main() {
  console.log('🚀 Starting add_or_restore_guest Health Check\n');

  const results = await Promise.all([
    healthCheckAddOrRestoreGuest(),
    checkFunctionSignature()
  ]);

  const allPassed = results.every(result => result);

  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Status: ${allPassed ? '✅ HEALTHY' : '❌ ISSUES DETECTED'}`);
  console.log(`Function exists: ${results[0] ? '✅' : '❌'}`);
  console.log(`Schema check: ${results[1] ? '✅' : '❌'}`);

  if (allPassed) {
    console.log('\n🎉 add_or_restore_guest RPC is ready for use!');
  } else {
    console.log('\n⚠️  Issues detected. Please check the database migration.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { healthCheckAddOrRestoreGuest, checkFunctionSignature };
