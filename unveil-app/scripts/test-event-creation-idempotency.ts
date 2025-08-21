#!/usr/bin/env tsx
/**
 * Test script for event creation idempotency
 * 
 * Usage:
 *   npx tsx scripts/test-event-creation-idempotency.ts
 * 
 * This script validates:
 * 1. Parallel requests with same creation_key only create one event
 * 2. Different creation_keys create different events
 * 3. Proper operation type reporting
 * 4. Error handling for edge cases
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';
import { EventCreationService } from '../lib/services/eventCreation';
import type { EventCreationInput } from '../lib/services/eventCreation';

// Test configuration
const TEST_USER_ID = '1431c6f7-b99a-4cec-b7cb-208e1a6fa35a'; // Nick Molcsan for testing
const TEST_EVENT_TITLE = 'Idempotency Test Event';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

interface TestResult {
  testName: string;
  success: boolean;
  details: string;
  duration: number;
}

async function cleanupTestEvents() {
  console.log('🧹 Cleaning up existing test events...');
  
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('host_user_id', TEST_USER_ID)
    .like('title', `${TEST_EVENT_TITLE}%`);
    
  if (error) {
    console.warn('Warning: Could not cleanup test events:', error.message);
  } else {
    console.log('✅ Test events cleaned up');
  }
}

async function testParallelSameKey(): Promise<TestResult> {
  const testName = 'Parallel Requests with Same Creation Key';
  const startTime = Date.now();
  
  try {
    const creationKey = crypto.randomUUID();
    const eventInput: EventCreationInput = {
      title: `${TEST_EVENT_TITLE} - Parallel Test`,
      event_date: '2026-06-01',
      location: 'Test Location',
      is_public: true,
      creation_key: creationKey
    };

    // Fire two parallel requests with same creation_key
    const [result1, result2] = await Promise.all([
      EventCreationService.createEventWithHost(eventInput, TEST_USER_ID),
      EventCreationService.createEventWithHost(eventInput, TEST_USER_ID)
    ]);

    // Both should succeed
    if (!result1.success || !result2.success) {
      return {
        testName,
        success: false,
        details: `One request failed: ${result1.error?.message || result2.error?.message}`,
        duration: Date.now() - startTime
      };
    }

    // Should return same event ID
    if (result1.data!.event_id !== result2.data!.event_id) {
      return {
        testName,
        success: false,
        details: `Different event IDs returned: ${result1.data!.event_id} vs ${result2.data!.event_id}`,
        duration: Date.now() - startTime
      };
    }

    // One should be "created", one should be "returned_existing"
    const operations = [result1.data!.operation, result2.data!.operation].sort();
    const expectedOps = ['created', 'returned_existing'].sort();
    
    if (JSON.stringify(operations) !== JSON.stringify(expectedOps)) {
      return {
        testName,
        success: false,
        details: `Unexpected operations: ${JSON.stringify(operations)}, expected: ${JSON.stringify(expectedOps)}`,
        duration: Date.now() - startTime
      };
    }

    return {
      testName,
      success: true,
      details: `✅ Same event ID (${result1.data!.event_id}), operations: ${operations.join(', ')}`,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      testName,
      success: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - startTime
    };
  }
}

async function testDifferentKeys(): Promise<TestResult> {
  const testName = 'Parallel Requests with Different Creation Keys';
  const startTime = Date.now();
  
  try {
    const eventInput1: EventCreationInput = {
      title: `${TEST_EVENT_TITLE} - Different Keys 1`,
      event_date: '2026-06-02',
      location: 'Test Location 1',
      is_public: true,
      creation_key: crypto.randomUUID()
    };

    const eventInput2: EventCreationInput = {
      title: `${TEST_EVENT_TITLE} - Different Keys 2`,
      event_date: '2026-06-03',
      location: 'Test Location 2',
      is_public: true,
      creation_key: crypto.randomUUID()
    };

    // Fire two parallel requests with different creation_keys
    const [result1, result2] = await Promise.all([
      EventCreationService.createEventWithHost(eventInput1, TEST_USER_ID),
      EventCreationService.createEventWithHost(eventInput2, TEST_USER_ID)
    ]);

    // Both should succeed
    if (!result1.success || !result2.success) {
      return {
        testName,
        success: false,
        details: `One request failed: ${result1.error?.message || result2.error?.message}`,
        duration: Date.now() - startTime
      };
    }

    // Should return different event IDs
    if (result1.data!.event_id === result2.data!.event_id) {
      return {
        testName,
        success: false,
        details: `Same event ID returned: ${result1.data!.event_id}`,
        duration: Date.now() - startTime
      };
    }

    // Both should be "created"
    if (result1.data!.operation !== 'created' || result2.data!.operation !== 'created') {
      return {
        testName,
        success: false,
        details: `Unexpected operations: ${result1.data!.operation}, ${result2.data!.operation}`,
        duration: Date.now() - startTime
      };
    }

    return {
      testName,
      success: true,
      details: `✅ Different event IDs: ${result1.data!.event_id} vs ${result2.data!.event_id}`,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      testName,
      success: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - startTime
    };
  }
}

async function testNoCreationKey(): Promise<TestResult> {
  const testName = 'Request without Creation Key (Backward Compatibility)';
  const startTime = Date.now();
  
  try {
    const eventInput: EventCreationInput = {
      title: `${TEST_EVENT_TITLE} - No Key`,
      event_date: '2026-06-04',
      location: 'Test Location',
      is_public: true
      // No creation_key provided
    };

    const result = await EventCreationService.createEventWithHost(eventInput, TEST_USER_ID);

    if (!result.success) {
      return {
        testName,
        success: false,
        details: `Request failed: ${result.error?.message}`,
        duration: Date.now() - startTime
      };
    }

    if (result.data!.operation !== 'created') {
      return {
        testName,
        success: false,
        details: `Unexpected operation: ${result.data!.operation}`,
        duration: Date.now() - startTime
      };
    }

    return {
      testName,
      success: true,
      details: `✅ Event created without key: ${result.data!.event_id}`,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      testName,
      success: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - startTime
    };
  }
}

async function testRetryScenario(): Promise<TestResult> {
  const testName = 'Retry Scenario (Client Retry with Same Key)';
  const startTime = Date.now();
  
  try {
    const creationKey = crypto.randomUUID();
    const eventInput: EventCreationInput = {
      title: `${TEST_EVENT_TITLE} - Retry Test`,
      event_date: '2026-06-05',
      location: 'Test Location',
      is_public: true,
      creation_key: creationKey
    };

    // First request
    const result1 = await EventCreationService.createEventWithHost(eventInput, TEST_USER_ID);
    
    if (!result1.success) {
      return {
        testName,
        success: false,
        details: `First request failed: ${result1.error?.message}`,
        duration: Date.now() - startTime
      };
    }

    // Simulate retry after 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retry with same creation_key
    const result2 = await EventCreationService.createEventWithHost(eventInput, TEST_USER_ID);

    if (!result2.success) {
      return {
        testName,
        success: false,
        details: `Retry request failed: ${result2.error?.message}`,
        duration: Date.now() - startTime
      };
    }

    // Should return same event
    if (result1.data!.event_id !== result2.data!.event_id) {
      return {
        testName,
        success: false,
        details: `Different events on retry: ${result1.data!.event_id} vs ${result2.data!.event_id}`,
        duration: Date.now() - startTime
      };
    }

    if (result1.data!.operation !== 'created' || result2.data!.operation !== 'returned_existing') {
      return {
        testName,
        success: false,
        details: `Unexpected operations: ${result1.data!.operation}, ${result2.data!.operation}`,
        duration: Date.now() - startTime
      };
    }

    return {
      testName,
      success: true,
      details: `✅ Retry returned same event: ${result1.data!.event_id}`,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      testName,
      success: false,
      details: `Exception: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - startTime
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log('🧪 TESTING EVENT CREATION IDEMPOTENCY\n');
  
  await cleanupTestEvents();
  console.log('');

  const tests = [
    testParallelSameKey,
    testDifferentKeys,
    testNoCreationKey,
    testRetryScenario
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = await test();
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.testName}`);
      console.log(`   ${result.details}`);
    } else {
      console.log(`❌ ${result.testName}`);
      console.log(`   ${result.details}`);
    }
    console.log(`   Duration: ${result.duration}ms\n`);
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('📊 TEST SUMMARY:');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED - Idempotency implementation needs review');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - Idempotency working correctly!');
  }

  // Cleanup
  await cleanupTestEvents();
}

// Run the tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
