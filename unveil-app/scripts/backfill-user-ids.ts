#!/usr/bin/env tsx

/**
 * Utility script to backfill user_id in event_guests table
 *
 * This script uses the database function `backfill_user_id_from_phone()`
 * to safely update existing event_guests rows where user_id is NULL
 * but a matching users.phone exists.
 *
 * Usage:
 *   npm run script:backfill-user-ids
 *
 * Features:
 * - Safe for reruns (only updates rows where user_id IS NULL)
 * - Reports count of updated rows
 * - No risk of overwriting existing user_id values
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/app/reference/supabase.types';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

interface BackfillResult {
  updated_count: number;
  total_eligible_count: number;
  details: string;
}

async function runBackfill(): Promise<void> {
  console.log('🔄 Starting user_id backfill process...\n');

  try {
    // Call the backfill function
    const { data, error } = await supabase.rpc('backfill_user_id_from_phone');

    if (error) {
      console.error('❌ Error running backfill:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No results returned from backfill function');
      return;
    }

    const result = data[0] as BackfillResult;

    console.log('📊 Backfill Results:');
    console.log(`   • Eligible rows: ${result.total_eligible_count}`);
    console.log(`   • Updated rows: ${result.updated_count}`);
    console.log(`   • Status: ${result.details}\n`);

    if (result.updated_count > 0) {
      console.log('✅ Backfill completed successfully!');
      console.log(
        `   Updated ${result.updated_count} event_guests records with matching user_id values.`,
      );
    } else if (result.total_eligible_count === 0) {
      console.log(
        '✅ No updates needed - all event_guests already have user_id or no matching users found.',
      );
    } else {
      console.log('⚠️  Some rows may need manual review.');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

async function checkCurrentState(): Promise<void> {
  console.log('🔍 Checking current state before backfill...\n');

  try {
    // Check event_guests without user_id but with phone
    const { data: unlinkedGuests, error: unlinkedError } = await supabase
      .from('event_guests')
      .select('id, phone, guest_name')
      .is('user_id', null)
      .not('phone', 'is', null);

    if (unlinkedError) {
      console.error('Error checking unlinked guests:', unlinkedError);
      return;
    }

    // Check for potential matches
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, phone, full_name');

    if (usersError) {
      console.error('Error checking users:', usersError);
      return;
    }

    const userPhones = new Set(users?.map((u) => u.phone) || []);
    const potentialMatches =
      unlinkedGuests?.filter(
        (guest) => guest.phone && userPhones.has(guest.phone),
      ) || [];

    console.log(`📈 Current State:`);
    console.log(`   • Total users: ${users?.length || 0}`);
    console.log(
      `   • Event guests without user_id: ${unlinkedGuests?.length || 0}`,
    );
    console.log(`   • Potential matches found: ${potentialMatches.length}\n`);

    if (potentialMatches.length > 0) {
      console.log('🎯 Potential matches:');
      potentialMatches.forEach((guest) => {
        const matchingUser = users?.find((u) => u.phone === guest.phone);
        console.log(
          `   • Guest "${guest.guest_name}" (${guest.phone}) → User "${matchingUser?.full_name}"`,
        );
      });
      console.log('');
    }
  } catch (err) {
    console.error('Error checking current state:', err);
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('🛠  User ID Backfill Utility\n');
  console.log('This script will safely update event_guests.user_id where:');
  console.log('• user_id is currently NULL');
  console.log('• phone number matches an existing user');
  console.log('• Will NOT overwrite existing user_id values\n');

  await checkCurrentState();
  await runBackfill();
}

if (require.main === module) {
  main().catch(console.error);
}

export { runBackfill, checkCurrentState };
