#!/usr/bin/env npx tsx

/**
 * Storage Setup Script
 * 
 * This script creates the event-media storage bucket needed for photo uploads
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

async function setupStorage() {
  console.log('🗄️ Setting up storage bucket...\n');

  try {
    // First, check if bucket already exists
    console.log('1. Checking existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }

    const eventMediaBucket = buckets?.find(bucket => bucket.name === 'event-media');
    
    if (eventMediaBucket) {
      console.log('✅ event-media bucket already exists');
      console.log(`   Public: ${eventMediaBucket.public}`);
      console.log(`   Created: ${eventMediaBucket.created_at}`);
    } else {
      console.log('📦 Creating event-media bucket...');
      
      // Create the bucket
      const { data: bucketData, error: createError } = await supabase.storage.createBucket('event-media', {
        public: true, // Set to public for easier access
        allowedMimeTypes: [
          'image/jpeg', 
          'image/png', 
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/mov',
          'video/avi'
        ],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        
        // Check if it's a permissions issue
        if (createError.message.includes('permission') || createError.message.includes('unauthorized')) {
          console.log('\n💡 This might be a permissions issue. The bucket creation requires admin privileges.');
          console.log('   You may need to create the bucket manually in the Supabase dashboard:');
          console.log('   1. Go to https://supabase.com/dashboard/project/wvhtbqvnamerdkkjknuv/storage/buckets');
          console.log('   2. Create a new bucket named "event-media"');
          console.log('   3. Set it as public');
          console.log('   4. Configure MIME types: image/*, video/*');
          console.log('   5. Set file size limit to 50MB');
        }
        return;
      }

      console.log('✅ event-media bucket created successfully');
      console.log('   Name:', bucketData?.name);
    }

    // Test bucket access
    console.log('\n2. Testing bucket access...');
    const { data: files, error: filesError } = await supabase.storage.from('event-media').list('', {
      limit: 1
    });

    if (filesError) {
      console.error('❌ Error accessing bucket:', filesError.message);
    } else {
      console.log('✅ Bucket access successful');
      console.log(`   Current files: ${files?.length || 0}`);
    }

    console.log('\n🎉 Storage setup complete!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the setup
setupStorage().catch(console.error); 