#!/usr/bin/env tsx

/**
 * SMS Fix Verification Script
 *
 * Verifies that our comprehensive SMS fixes are working correctly
 *
 * Usage: npx tsx scripts/verify-sms-fix.ts
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  details?: any;
}

async function testAdminClientConnection(): Promise<TestResult> {
  try {
    console.log('🧪 Testing admin client connection...');

    const { testAdminConnection } = await import('../lib/supabase/admin');
    const isConnected = await testAdminConnection();

    if (isConnected) {
      return {
        test: 'Admin Client Connection',
        success: true,
        details: 'Successfully connected to Supabase with admin privileges',
      };
    } else {
      return {
        test: 'Admin Client Connection',
        success: false,
        error: 'Failed to connect with admin client',
      };
    }
  } catch (error) {
    return {
      test: 'Admin Client Connection',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testEventLookup(): Promise<TestResult> {
  try {
    console.log('🧪 Testing event lookup with admin client...');

    const { supabaseAdmin } = await import('../lib/supabase/admin');
    const testEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('id, title, host_user_id')
      .eq('id', testEventId)
      .single();

    if (error) {
      return {
        test: 'Event Lookup (Admin)',
        success: false,
        error: `Database error: ${error.message}`,
        details: { errorCode: error.code, hint: error.hint },
      };
    }

    if (event) {
      return {
        test: 'Event Lookup (Admin)',
        success: true,
        details: {
          eventId: event.id,
          title: event.title,
          hasHost: !!event.host_user_id,
        },
      };
    }

    return {
      test: 'Event Lookup (Admin)',
      success: false,
      error: 'Event not found in database',
    };
  } catch (error) {
    return {
      test: 'Event Lookup (Admin)',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testEnvironmentVariables(): Promise<TestResult> {
  console.log('🧪 Testing environment variables...');

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    return {
      test: 'Environment Variables',
      success: false,
      error: `Missing required variables: ${missing.join(', ')}`,
    };
  }

  // Check format
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.startsWith('https://')) {
    return {
      test: 'Environment Variables',
      success: false,
      error: 'NEXT_PUBLIC_SUPABASE_URL should start with https://',
    };
  }

  if (!anonKey?.startsWith('eyJ')) {
    return {
      test: 'Environment Variables',
      success: false,
      error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY should be a JWT token',
    };
  }

  if (!serviceKey?.startsWith('eyJ')) {
    return {
      test: 'Environment Variables',
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY should be a JWT token',
    };
  }

  return {
    test: 'Environment Variables',
    success: true,
    details: {
      url: url.substring(0, 30) + '...',
      anonKey: anonKey.substring(0, 20) + '...',
      serviceKey: serviceKey.substring(0, 20) + '...',
    },
  };
}

async function testAPIEndpointStructure(): Promise<TestResult> {
  try {
    console.log('🧪 Testing SMS API endpoint structure...');

    const response = await fetch(
      'http://localhost:3000/api/sms/send-invitations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: 'test-id',
          guests: [{ phone: '+15551234567' }],
        }),
      },
    );

    // Should return 401 (auth required) not 404 or 500
    if (response.status === 401) {
      return {
        test: 'SMS API Endpoint Structure',
        success: true,
        details: 'API endpoint properly requires authentication',
      };
    } else {
      const data = await response.json().catch(() => ({}));
      return {
        test: 'SMS API Endpoint Structure',
        success: false,
        error: `Expected 401, got ${response.status}`,
        details: data,
      };
    }
  } catch (error) {
    return {
      test: 'SMS API Endpoint Structure',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function generateReport(results: TestResult[]) {
  console.log('\n📊 SMS FIX VERIFICATION REPORT');
  console.log('==============================\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}\n`);

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.test}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.details) {
      console.log(`   Details:`, result.details);
    }

    console.log('');
  });

  if (failed === 0) {
    console.log('🎉 All verification tests passed!');
    console.log('\n✅ SMS system should now work correctly:');
    console.log('   - Admin client properly configured');
    console.log('   - Event lookup bypasses RLS restrictions');
    console.log('   - API endpoints respond correctly');
    console.log('   - Environment variables are valid');
    console.log('\n💡 Next steps:');
    console.log('   1. Try importing a guest in the UI');
    console.log('   2. Check for SMS delivery');
    console.log('   3. Monitor server logs for success messages');
  } else {
    console.log('🔧 Some verification tests failed.');
    console.log('\nFix the failed tests above before proceeding.');
  }
}

async function main() {
  console.log('🔍 SMS Fix Verification Suite');
  console.log('=============================\n');

  const results: TestResult[] = [];

  try {
    // Run all verification tests
    results.push(await testEnvironmentVariables());
    results.push(await testAdminClientConnection());
    results.push(await testEventLookup());
    results.push(await testAPIEndpointStructure());

    generateReport(results);
  } catch (error) {
    console.error(
      '❌ Verification suite failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

if (require.main === module) {
  main().catch(console.error);
}
