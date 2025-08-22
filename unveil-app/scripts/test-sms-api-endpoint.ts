#!/usr/bin/env tsx

/**
 * SMS API Endpoint Test Script
 *
 * Tests the /api/sms/send-invitations endpoint specifically
 *
 * Usage: npx tsx scripts/test-sms-api-endpoint.ts
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

interface TestResult {
  test: string;
  success: boolean;
  status?: number;
  error?: string;
  details?: any;
}

async function testSMSAPIEndpoint(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log('🔍 Testing SMS API Endpoint...\n');

  const testEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
  const testGuests = [{ phone: '+15551234567', guestName: 'Test Guest' }];

  // Test 1: Check endpoint without authentication
  try {
    console.log('🧪 Test 1: Endpoint accessibility without auth...');

    const response = await fetch(
      'http://localhost:3000/api/sms/send-invitations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: testEventId,
          guests: testGuests,
        }),
      },
    );

    const data = await response.json();

    if (response.status === 401) {
      results.push({
        test: 'No Auth - Should Return 401',
        success: true,
        status: response.status,
        details: 'Correctly requires authentication',
      });
      console.log('✅ Correctly requires authentication (401)');
    } else {
      results.push({
        test: 'No Auth - Should Return 401',
        success: false,
        status: response.status,
        error: `Expected 401, got ${response.status}`,
        details: data,
      });
      console.log(`❌ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    results.push({
      test: 'No Auth - Should Return 401',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(
      `❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Test 2: Check endpoint with invalid event ID
  try {
    console.log('\n🧪 Test 2: Invalid event ID...');

    const response = await fetch(
      'http://localhost:3000/api/sms/send-invitations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: 'invalid-event-id',
          guests: testGuests,
        }),
      },
    );

    const data = await response.json();

    if (response.status === 401) {
      results.push({
        test: 'Invalid Event ID - Auth Required',
        success: true,
        status: response.status,
        details: 'Correctly requires authentication first',
      });
      console.log('✅ Correctly requires authentication first');
    } else {
      results.push({
        test: 'Invalid Event ID - Auth Required',
        success: false,
        status: response.status,
        error: `Expected 401, got ${response.status}`,
        details: data,
      });
      console.log(`❌ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    results.push({
      test: 'Invalid Event ID - Auth Required',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(
      `❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Test 3: Check endpoint with malformed request
  try {
    console.log('\n🧪 Test 3: Malformed request (missing guests)...');

    const response = await fetch(
      'http://localhost:3000/api/sms/send-invitations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: testEventId,
          // Missing guests array
        }),
      },
    );

    const data = await response.json();

    if (response.status === 400 || response.status === 401) {
      results.push({
        test: 'Malformed Request - Should Return 400 or 401',
        success: true,
        status: response.status,
        details:
          response.status === 400
            ? 'Correctly validates request format'
            : 'Auth required first',
      });
      console.log(
        `✅ Correctly handled malformed request (${response.status})`,
      );
    } else {
      results.push({
        test: 'Malformed Request - Should Return 400 or 401',
        success: false,
        status: response.status,
        error: `Expected 400 or 401, got ${response.status}`,
        details: data,
      });
      console.log(`❌ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    results.push({
      test: 'Malformed Request - Should Return 400 or 401',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(
      `❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return results;
}

function generateReport(results: TestResult[]) {
  console.log('\n📊 SMS API ENDPOINT TEST REPORT');
  console.log('================================\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}\n`);

  if (failed > 0) {
    console.log('❌ Failed Tests:');
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`   ${result.test}: ${result.error}`);
      });
    console.log('');
  }

  if (passed === results.length) {
    console.log(
      '🎉 All basic tests passed! The API endpoint structure looks correct.',
    );
    console.log('\n💡 Next steps:');
    console.log('   1. Try adding a guest with your actual user session');
    console.log('   2. Check server console logs for detailed debugging info');
    console.log(
      '   3. Verify the authentication token is being passed correctly',
    );
  } else {
    console.log(
      '🔧 Some basic tests failed. Check the API route implementation.',
    );
  }

  console.log('\n📚 Resources:');
  console.log('   API Route: app/api/sms/send-invitations/route.ts');
  console.log('   Client Function: lib/api/sms-invitations.ts');
  console.log(
    '   Debugging Guide: docs/debugging/sms-invitation-troubleshooting.md',
  );
}

async function main() {
  console.log('📱 SMS API Endpoint Test Suite');
  console.log('==============================\n');

  try {
    const results = await testSMSAPIEndpoint();
    generateReport(results);
  } catch (error) {
    console.error(
      '❌ Test suite failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

if (require.main === module) {
  main().catch(console.error);
}
