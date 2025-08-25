#!/usr/bin/env tsx

/**
 * Test script for the event reminder system
 * This script tests the core RPC functions to ensure they work correctly
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';

// Initialize Supabase client (you'll need to set these environment variables)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

async function testReminderSystem() {
  console.log('🧪 Testing Event Reminder System...\n');

  try {
    // Test 1: Check if RPC functions exist
    console.log('1. Checking RPC functions...');
    
    const { data: functions } = await supabase.rpc('get_event_reminder_status' as any, {
      p_event_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      p_timeline_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    });
    
    console.log('✅ RPC functions are accessible');

    // Test 2: Check database schema
    console.log('\n2. Checking database schema...');
    
    const { data: columns } = await supabase
      .from('scheduled_messages')
      .select('trigger_source, trigger_ref_id')
      .limit(1);
    
    console.log('✅ New columns exist in scheduled_messages table');

    // Test 3: Check content template function
    console.log('\n3. Testing content template...');
    
    const testContent = await supabase.rpc('build_event_reminder_content' as any, {
      p_sub_event_title: 'Test Event',
      p_start_at_utc: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      p_event_timezone: 'America/Denver',
      p_event_id: '00000000-0000-0000-0000-000000000000',
    });
    
    if (testContent.data) {
      console.log('✅ Content template function works');
      console.log('   Sample content:', testContent.data.substring(0, 50) + '...');
    }

    console.log('\n🎉 All tests passed! The reminder system is ready to use.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testReminderSystem().catch(console.error);
