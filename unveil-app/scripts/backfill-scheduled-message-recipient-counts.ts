#!/usr/bin/env tsx

/**
 * Backfill Script: Fix Incorrect Recipient Counts in Scheduled Messages
 *
 * This script fixes the recipient count discrepancy where scheduled messages
 * with explicit guest selection show incorrect recipient_count values.
 *
 * SAFE OPERATIONS:
 * - Only updates recipient_count field
 * - Does NOT modify target_guest_ids or audience
 * - Only processes scheduled/sending messages with target_guest_ids
 * - Idempotent - can be run multiple times safely
 *
 * Usage:
 *   tsx scripts/backfill-scheduled-message-recipient-counts.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ScheduledMessageRow {
  id: string;
  event_id: string;
  status: string;
  target_guest_ids: string[] | null;
  recipient_count: number | null;
  created_at: string;
  send_at: string;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🔍 Scheduled Message Recipient Count Backfill');
  console.log(
    `Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will make changes)'}`,
  );
  console.log('='.repeat(60));

  try {
    // Step 1: Find scheduled messages with incorrect recipient counts
    console.log(
      '📊 Scanning for scheduled messages with incorrect recipient counts...',
    );

    const { data: scheduledMessages, error: fetchError } = (await supabase
      .from('scheduled_messages')
      .select(
        'id, event_id, status, target_guest_ids, recipient_count, created_at, send_at',
      )
      .in('status', ['scheduled', 'sending'])
      .not('target_guest_ids', 'is', null)) as {
      data: ScheduledMessageRow[] | null;
      error: any;
    };

    if (fetchError) {
      throw new Error(
        `Failed to fetch scheduled messages: ${fetchError.message}`,
      );
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      console.log('✅ No scheduled messages found with target_guest_ids.');
      return;
    }

    console.log(
      `📋 Found ${scheduledMessages.length} scheduled messages to examine.`,
    );

    // Step 2: Identify messages with incorrect counts
    const incorrectMessages = scheduledMessages.filter((msg) => {
      const actualCount = msg.target_guest_ids?.length || 0;
      const storedCount = msg.recipient_count || 0;
      return actualCount !== storedCount && actualCount > 0;
    });

    if (incorrectMessages.length === 0) {
      console.log('✅ All scheduled messages have correct recipient counts.');
      return;
    }

    console.log(
      `🔧 Found ${incorrectMessages.length} messages with incorrect recipient counts:`,
    );
    console.log('');

    // Step 3: Display what will be fixed
    incorrectMessages.forEach((msg, index) => {
      const actualCount = msg.target_guest_ids?.length || 0;
      const storedCount = msg.recipient_count || 0;

      console.log(`${index + 1}. Message ID: ${msg.id}`);
      console.log(`   Event ID: ${msg.event_id}`);
      console.log(`   Status: ${msg.status}`);
      console.log(`   Send At: ${msg.send_at}`);
      console.log(`   Current recipient_count: ${storedCount}`);
      console.log(`   Actual target_guest_ids count: ${actualCount}`);
      console.log(
        `   Will update recipient_count: ${storedCount} → ${actualCount}`,
      );
      console.log('');
    });

    if (isDryRun) {
      console.log('🔍 DRY RUN COMPLETE - No changes made.');
      console.log(
        `Would update ${incorrectMessages.length} scheduled messages.`,
      );
      return;
    }

    // Step 4: Confirm before proceeding
    console.log(
      '⚠️  About to update recipient counts for the messages listed above.',
    );
    console.log('This operation:');
    console.log('  ✅ WILL update recipient_count field only');
    console.log('  ✅ Will NOT modify target_guest_ids or change audience');
    console.log('  ✅ Is idempotent and safe to run multiple times');
    console.log('');

    // In a script environment, we'll proceed automatically
    // In production, you might want to add a confirmation prompt

    // Step 5: Perform the backfill
    console.log('🚀 Starting backfill operation...');
    let successCount = 0;
    let errorCount = 0;

    for (const msg of incorrectMessages) {
      const actualCount = msg.target_guest_ids?.length || 0;

      try {
        console.log(
          `   Updating message ${msg.id}: recipient_count ${msg.recipient_count} → ${actualCount}`,
        );

        const { error: updateError } = await supabase
          .from('scheduled_messages')
          .update({ recipient_count: actualCount })
          .eq('id', msg.id)
          .eq('recipient_count', msg.recipient_count); // Ensure no concurrent changes

        if (updateError) {
          throw updateError;
        }

        successCount++;
        console.log(`   ✅ Updated successfully`);
      } catch (updateError) {
        errorCount++;
        console.error(`   ❌ Failed to update message ${msg.id}:`, updateError);
      }
    }

    // Step 6: Summary
    console.log('');
    console.log('📊 BACKFILL COMPLETE');
    console.log('='.repeat(40));
    console.log(`✅ Successfully updated: ${successCount} messages`);
    console.log(`❌ Failed to update: ${errorCount} messages`);
    console.log(`📊 Total processed: ${incorrectMessages.length} messages`);

    if (errorCount > 0) {
      console.log('');
      console.log('⚠️  Some updates failed. Check the error messages above.');
      console.log('The script is idempotent - you can safely run it again.');
    }

    // Step 7: Verification
    console.log('');
    console.log('🔍 Verification: Checking for remaining incorrect counts...');

    const { data: remainingIncorrect } = (await supabase
      .from('scheduled_messages')
      .select('id, target_guest_ids, recipient_count')
      .in('status', ['scheduled', 'sending'])
      .not('target_guest_ids', 'is', null)) as {
      data: ScheduledMessageRow[] | null;
    };

    const stillIncorrect =
      remainingIncorrect?.filter((msg) => {
        const actualCount = msg.target_guest_ids?.length || 0;
        const storedCount = msg.recipient_count || 0;
        return actualCount !== storedCount && actualCount > 0;
      }) || [];

    if (stillIncorrect.length === 0) {
      console.log(
        '✅ Verification passed: All scheduled messages now have correct recipient counts.',
      );
    } else {
      console.log(
        `⚠️  Verification found ${stillIncorrect.length} messages still with incorrect counts.`,
      );
      console.log(
        'These may have been updated concurrently or had other issues.',
      );
    }
  } catch (error) {
    console.error('💥 Backfill failed with error:', error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

export { main as backfillScheduledMessageRecipientCounts };
