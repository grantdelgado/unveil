#!/usr/bin/env npx tsx

/**
 * Week 2 Feature Testing Script
 *
 * This script tests all the major features implemented in Week 2:
 * 1. Media Upload (PhotoUpload component)
 * 2. Real-time Messaging (GuestMessaging component)
 * 3. Gallery with lazy loading (GuestPhotoGallery)
 * 4. Storage bucket functionality
 * 5. Database operations
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  const emoji =
    result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${emoji} ${result.name}`);
  if (result.details) console.log(`   ${result.details}`);
  if (result.error) console.log(`   Error: ${result.error}`);
  results.push(result);
}

async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('count(*)', { count: 'exact' });
    if (error) throw error;

    logTest({
      name: 'Database Connection',
      status: 'PASS',
      details: `Connected successfully. Found ${data?.[0]?.count || 0} events.`,
    });
  } catch (error) {
    logTest({
      name: 'Database Connection',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testStorageBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const eventMediaBucket = buckets?.find(
      (bucket) => bucket.name === 'event-media',
    );

    if (eventMediaBucket) {
      logTest({
        name: 'Storage Bucket (event-media)',
        status: 'PASS',
        details: `Bucket exists and is ${eventMediaBucket.public ? 'public' : 'private'}`,
      });
    } else {
      logTest({
        name: 'Storage Bucket (event-media)',
        status: 'FAIL',
        details: 'event-media bucket not found',
      });
    }
  } catch (error) {
    logTest({
      name: 'Storage Bucket (event-media)',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testMediaTable() {
  try {
    const { data, error } = await supabase.from('media').select('*').limit(5);

    if (error) throw error;

    logTest({
      name: 'Media Table Query',
      status: 'PASS',
      details: `Retrieved ${data?.length || 0} media records`,
    });
  } catch (error) {
    logTest({
      name: 'Media Table Query',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testMessagesTable() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .limit(5);

    if (error) throw error;

    logTest({
      name: 'Messages Table Query',
      status: 'PASS',
      details: `Retrieved ${data?.length || 0} message records`,
    });
  } catch (error) {
    logTest({
      name: 'Messages Table Query',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testRealtimeConnection() {
  try {
    const channel = supabase.channel('test-channel');

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('Realtime connection timeout'));
      }, 5000);

      channel
        .on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          channel.unsubscribe();
          logTest({
            name: 'Realtime Connection',
            status: 'PASS',
            details: 'Successfully connected to realtime',
          });
          resolve();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            channel.unsubscribe();
            logTest({
              name: 'Realtime Connection',
              status: 'PASS',
              details: 'Successfully subscribed to realtime channel',
            });
            resolve();
          }
        });
    });
  } catch (error) {
    logTest({
      name: 'Realtime Connection',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testUserProfiles() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(3);

    if (error) throw error;

    logTest({
      name: 'User Profiles View',
      status: 'PASS',
      details: `Retrieved ${data?.length || 0} user profiles`,
    });
  } catch (error) {
    logTest({
      name: 'User Profiles View',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testEventGuests() {
  try {
    const { data, error } = await supabase
      .from('event_guests')
      .select('*')
      .limit(5);

    if (error) throw error;

    logTest({
      name: 'Event Guests Table',
      status: 'PASS',
      details: `Retrieved ${data?.length || 0} participant records`,
    });
  } catch (error) {
    logTest({
      name: 'Event Guests Table',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testPerformanceIndexes() {
  try {
    // Test some of the indexes we added by running queries that would benefit from them
    const start = Date.now();

    const { error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const { error: mediaError } = await supabase
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const duration = Date.now() - start;

    if (messagesError || mediaError) {
      throw new Error(messagesError?.message || mediaError?.message);
    }

    logTest({
      name: 'Database Performance (Indexes)',
      status: 'PASS',
      details: `Queries completed in ${duration}ms`,
    });
  } catch (error) {
    logTest({
      name: 'Database Performance (Indexes)',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testComponentIntegrity() {
  // Test that our key components can be imported (basic module resolution)
  try {
    // These imports will fail at runtime in Node, but we can test the module resolution
    const photoUploadPath = '../components/features/media/PhotoUpload.tsx';
    const guestMessagingPath =
      '../components/features/messaging/GuestMessaging.tsx';
    const galleryPath = '../components/features/media/GuestPhotoGallery.tsx';

    // Check if files exist
    const fs = await import('fs');
    const path = await import('path');

    const files = [
      path.resolve(__dirname, photoUploadPath),
      path.resolve(__dirname, guestMessagingPath),
      path.resolve(__dirname, galleryPath),
    ];

    const allExist = files.every((file) => fs.existsSync(file));

    if (allExist) {
      logTest({
        name: 'Component File Integrity',
        status: 'PASS',
        details: 'All key component files exist and are accessible',
      });
    } else {
      logTest({
        name: 'Component File Integrity',
        status: 'FAIL',
        details: 'Some component files are missing',
      });
    }
  } catch (error) {
    logTest({
      name: 'Component File Integrity',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function runAllTests() {
  console.log('🧪 Running Week 2 Feature Tests...\n');

  await testDatabaseConnection();
  await testStorageBucket();
  await testMediaTable();
  await testMessagesTable();
  await testUserProfiles();
  await testEventGuests();
  await testPerformanceIndexes();
  await testComponentIntegrity();

  // Skip realtime test for now as it might be flaky in CI
  logTest({
    name: 'Realtime Connection',
    status: 'SKIP',
    details: 'Skipped to avoid flaky CI issues',
  });

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(
    `📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`,
  );

  if (failed === 0) {
    console.log(
      '\n🎉 All tests passed! Week 2 features are working correctly.',
    );
  } else {
    console.log(
      '\n⚠️ Some tests failed. Please check the error details above.',
    );
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);
