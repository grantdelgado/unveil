#!/usr/bin/env tsx

/**
 * Test script to verify the user_id auto-population trigger
 * 
 * This script will:
 * 1. Find an existing user with a phone number
 * 2. Create a test event
 * 3. Insert a guest with the same phone but no user_id
 * 4. Verify the trigger automatically populated user_id
 * 5. Clean up test data
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/app/reference/supabase.types';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

interface TestData {
  testEventId?: string;
  testGuestId?: string;
  userPhone?: string;
  userId?: string;
}

const testData: TestData = {};

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  
  if (testData.testGuestId) {
    await supabase.from('event_guests').delete().eq('id', testData.testGuestId);
    console.log('   ✅ Removed test guest');
  }
  
  if (testData.testEventId) {
    await supabase.from('events').delete().eq('id', testData.testEventId);
    console.log('   ✅ Removed test event');
  }
}

async function runTriggerTest(): Promise<void> {
  console.log('🧪 Testing user_id auto-population trigger\n');

  try {
    // 1. Find an existing user with a phone number
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, phone, full_name')
      .not('phone', 'is', null)
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.log('❌ No users with phone numbers found for testing');
      return;
    }

    const testUser = users[0];
    testData.userId = testUser.id;
    testData.userPhone = testUser.phone;
    
    console.log('📱 Using test user:', {
      id: testUser.id,
      phone: testUser.phone,
      name: testUser.full_name
    });

    // 2. Create a test event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: 'Test Event for Trigger',
        event_date: new Date().toISOString().split('T')[0],
        host_user_id: testUser.id,
        description: 'Temporary test event - will be deleted'
      })
      .select()
      .single();

    if (eventError || !event) {
      console.log('❌ Failed to create test event:', eventError);
      return;
    }

    testData.testEventId = event.id;
    console.log('🎉 Created test event:', event.id);

    // 3. Insert guest with same phone but no user_id (should trigger auto-population)
    console.log('\n🔄 Inserting guest with matching phone (user_id should auto-populate)...');
    
    const { data: guest, error: guestError } = await supabase
      .from('event_guests')
      .insert({
        event_id: event.id,
        phone: testUser.phone,
        guest_name: 'Test Guest for Trigger',
        user_id: null, // Explicitly null to test trigger
        role: 'guest'
      })
      .select()
      .single();

    if (guestError || !guest) {
      console.log('❌ Failed to create test guest:', guestError);
      await cleanup();
      return;
    }

    testData.testGuestId = guest.id;

    // 4. Verify the trigger worked
    console.log('🔍 Checking if trigger populated user_id...');
    
    const { data: updatedGuest, error: checkError } = await supabase
      .from('event_guests')
      .select('id, user_id, phone, guest_name')
      .eq('id', guest.id)
      .single();

    if (checkError || !updatedGuest) {
      console.log('❌ Failed to check updated guest:', checkError);
      await cleanup();
      return;
    }

    console.log('\n📊 Results:');
    console.log('   Original user_id: null');
    console.log(`   Final user_id: ${updatedGuest.user_id}`);
    console.log(`   Expected user_id: ${testUser.id}`);
    console.log(`   Phone: ${updatedGuest.phone}`);

    if (updatedGuest.user_id === testUser.id) {
      console.log('\n✅ SUCCESS! Trigger correctly auto-populated user_id');
    } else if (updatedGuest.user_id === null) {
      console.log('\n❌ FAILED! Trigger did not populate user_id');
    } else {
      console.log('\n⚠️  UNEXPECTED! Trigger populated different user_id');
    }

    // 5. Test that existing user_id values are not overwritten
    console.log('\n🔄 Testing trigger does not overwrite existing user_id...');
    
    // Create another user for testing
    const { data: anotherUser, error: userError2 } = await supabase
      .from('users')
      .select('id')
      .neq('id', testUser.id)
      .limit(1)
      .single();

    if (anotherUser) {
      const { data: guest2, error: guest2Error } = await supabase
        .from('event_guests')
        .insert({
          event_id: event.id,
          phone: testUser.phone, // Same phone
          guest_name: 'Test Guest 2',
          user_id: anotherUser.id, // Different user_id
          role: 'guest'
        })
        .select()
        .single();

      if (!guest2Error && guest2) {
        // Check if user_id was preserved
        const { data: finalGuest2 } = await supabase
          .from('event_guests')
          .select('user_id')
          .eq('id', guest2.id)
          .single();

        if (finalGuest2?.user_id === anotherUser.id) {
          console.log('   ✅ Existing user_id preserved (not overwritten)');
        } else {
          console.log('   ❌ Existing user_id was overwritten!');
        }

        // Clean up second guest
        await supabase.from('event_guests').delete().eq('id', guest2.id);
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  } finally {
    await cleanup();
  }
}

if (require.main === module) {
  runTriggerTest().catch(console.error);
}

export { runTriggerTest };
