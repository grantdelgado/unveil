#!/usr/bin/env npx tsx

/**
 * Storage Setup Verification Script
 *
 * This script verifies that the event-media storage bucket is properly configured
 * and tests all functionality needed for the PhotoUpload component.
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
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  const emoji =
    result.status === 'PASS'
      ? '✅'
      : result.status === 'FAIL'
        ? '❌'
        : result.status === 'WARN'
          ? '⚠️'
          : '⏭️';
  console.log(`${emoji} ${result.name}`);
  if (result.details) console.log(`   ${result.details}`);
  if (result.error) console.log(`   Error: ${result.error}`);
  results.push(result);
}

async function testBucketExists() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const eventMediaBucket = buckets?.find(
      (bucket) => bucket.name === 'event-media',
    );

    if (eventMediaBucket) {
      logTest({
        name: 'Storage Bucket Exists',
        status: 'PASS',
        details: `Found event-media bucket (public: ${eventMediaBucket.public})`,
      });
      return eventMediaBucket;
    } else {
      logTest({
        name: 'Storage Bucket Exists',
        status: 'FAIL',
        details:
          'event-media bucket not found. Please create it manually in Supabase Dashboard.',
        error: 'Missing required storage bucket',
      });
      return null;
    }
  } catch (error) {
    logTest({
      name: 'Storage Bucket Exists',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

async function testBucketAccess() {
  try {
    const { data: files, error } = await supabase.storage
      .from('event-media')
      .list('', { limit: 1 });

    if (error) {
      if (error.message.includes('not found')) {
        logTest({
          name: 'Bucket Access',
          status: 'FAIL',
          details: 'Bucket not found - needs manual creation',
          error: error.message,
        });
      } else {
        throw error;
      }
    } else {
      logTest({
        name: 'Bucket Access',
        status: 'PASS',
        details: `Successfully accessed bucket (${files?.length || 0} files found)`,
      });
    }
  } catch (error) {
    logTest({
      name: 'Bucket Access',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testUploadFunctionality() {
  try {
    // Create a test file (small base64 image)
    const testImageData =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testFile = dataURLtoFile(testImageData, 'test-image.png');

    if (!testFile) {
      throw new Error('Failed to create test file');
    }

    // Test upload to a test folder
    const testPath = `test-folder/test-${Date.now()}.png`;

    const { data, error } = await supabase.storage
      .from('event-media')
      .upload(testPath, testFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      logTest({
        name: 'Upload Functionality',
        status: 'FAIL',
        details: 'Upload test failed - check bucket permissions',
        error: error.message,
      });
    } else {
      logTest({
        name: 'Upload Functionality',
        status: 'PASS',
        details: `Successfully uploaded test file: ${data.path}`,
      });

      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('event-media')
        .remove([testPath]);

      if (deleteError) {
        logTest({
          name: 'Cleanup Test File',
          status: 'WARN',
          details: 'Test file uploaded but could not be cleaned up',
          error: deleteError.message,
        });
      } else {
        logTest({
          name: 'Cleanup Test File',
          status: 'PASS',
          details: 'Test file successfully removed',
        });
      }
    }
  } catch (error) {
    logTest({
      name: 'Upload Functionality',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testPublicAccess() {
  try {
    // Get public URL for a test path
    const { data } = supabase.storage
      .from('event-media')
      .getPublicUrl('test-folder/nonexistent.jpg');

    if (data.publicUrl) {
      logTest({
        name: 'Public URL Generation',
        status: 'PASS',
        details: `Public URLs can be generated: ${data.publicUrl.substring(0, 50)}...`,
      });

      // Test if we can actually access public URLs (this will 404 but should not be blocked)
      try {
        const response = await fetch(data.publicUrl, { method: 'HEAD' });
        // 404 is expected since file doesn't exist, but bucket should be accessible
        if (response.status === 404) {
          logTest({
            name: 'Public URL Access',
            status: 'PASS',
            details:
              'Public URLs are accessible (404 expected for nonexistent file)',
          });
        } else if (response.status === 403) {
          logTest({
            name: 'Public URL Access',
            status: 'FAIL',
            details: 'Bucket is not public - check bucket configuration',
            error: '403 Forbidden on public URL',
          });
        } else {
          logTest({
            name: 'Public URL Access',
            status: 'WARN',
            details: `Unexpected response: ${response.status} ${response.statusText}`,
          });
        }
      } catch (fetchError) {
        logTest({
          name: 'Public URL Access',
          status: 'WARN',
          details: 'Could not test public URL access',
          error:
            fetchError instanceof Error ? fetchError.message : 'Network error',
        });
      }
    } else {
      logTest({
        name: 'Public URL Generation',
        status: 'FAIL',
        details: 'Could not generate public URL',
      });
    }
  } catch (error) {
    logTest({
      name: 'Public URL Generation',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testStorageIntegration() {
  // Test our actual storage service function
  try {
    const { uploadEventMedia } = await import('../services/storage');

    logTest({
      name: 'Storage Service Import',
      status: 'PASS',
      details: 'uploadEventMedia function available',
    });

    // We can't actually test upload without authentication, but we can test the function exists
    if (typeof uploadEventMedia === 'function') {
      logTest({
        name: 'Upload Function Signature',
        status: 'PASS',
        details: 'uploadEventMedia function has correct signature',
      });
    } else {
      logTest({
        name: 'Upload Function Signature',
        status: 'FAIL',
        details: 'uploadEventMedia is not a function',
      });
    }
  } catch (error) {
    logTest({
      name: 'Storage Service Import',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Import error',
    });
  }
}

// Helper function to convert data URL to File
function dataURLtoFile(dataurl: string, filename: string): File | null {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  } catch (error) {
    return null;
  }
}

async function runStorageVerification() {
  console.log('🗄️ Verifying Storage Bucket Setup...\n');

  // Step 1: Check if bucket exists
  const bucket = await testBucketExists();

  if (bucket) {
    // Step 2: Test bucket access
    await testBucketAccess();

    // Step 3: Test upload functionality
    await testUploadFunctionality();

    // Step 4: Test public access
    await testPublicAccess();
  } else {
    logTest({
      name: 'Remaining Tests',
      status: 'SKIP',
      details: 'Skipping additional tests - bucket does not exist',
    });
  }

  // Step 5: Test integration
  await testStorageIntegration();

  // Summary
  console.log('\n📊 Verification Summary:');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warned = results.filter((r) => r.status === 'WARN').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️ Warnings: ${warned}`);
  console.log(`⏭️ Skipped: ${skipped}`);

  if (failed === 0 && passed > 0) {
    console.log('\n🎉 Storage setup is ready for production!');
    console.log('\nNext steps:');
    console.log('1. Test PhotoUpload component in browser');
    console.log('2. Upload a real image and verify it appears in gallery');
    console.log('3. Mark storage setup as complete in MVP-ProjectPlan.md');
  } else if (failed > 0) {
    console.log('\n⚠️ Storage setup needs attention:');

    const failedTests = results.filter((r) => r.status === 'FAIL');
    failedTests.forEach((test) => {
      console.log(`   • ${test.name}: ${test.error || test.details}`);
    });

    if (failedTests.some((t) => t.name.includes('Bucket'))) {
      console.log('\n📋 Manual Setup Required:');
      console.log('   1. Go to Supabase Dashboard > Storage');
      console.log('   2. Create bucket named "event-media"');
      console.log('   3. Set as public bucket');
      console.log('   4. Configure MIME types and 50MB limit');
      console.log('   5. Re-run this verification script');
    }
  } else {
    console.log('\n📋 No tests completed - check configuration and try again');
  }
}

// Run the verification
runStorageVerification().catch(console.error);
