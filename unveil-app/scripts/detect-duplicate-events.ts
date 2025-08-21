#!/usr/bin/env tsx
/**
 * Diagnostic script to detect and analyze duplicate events
 * 
 * Usage:
 *   npx tsx scripts/detect-duplicate-events.ts
 *   npx tsx scripts/detect-duplicate-events.ts --fix-duplicates
 * 
 * This script:
 * 1. Identifies potential duplicate events (same host, title, date)
 * 2. Shows timing analysis to understand creation patterns
 * 3. Optionally provides safe cleanup for obvious duplicates
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';

// Initialize Supabase client for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface DuplicateGroup {
  host_user_id: string;
  host_name: string | null;
  title: string;
  event_date: string;
  duplicate_count: number;
  event_ids: string[];
  created_at_range: string;
  timing_analysis?: {
    first_created: string;
    last_created: string;
    time_difference_ms: number;
    likely_double_submission: boolean;
  };
}

async function detectDuplicates(): Promise<DuplicateGroup[]> {
  console.log('🔍 Scanning for duplicate events...\n');

  const { data, error } = await supabase.rpc('detect_duplicate_events');
  
  if (error) {
    console.error('Error detecting duplicates:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('✅ No duplicate events found!');
    return [];
  }

  // Enhance with timing analysis
  const enhancedDuplicates: DuplicateGroup[] = [];
  
  for (const group of data) {
    // Get detailed timing info for this group
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, created_at')
      .in('id', group.event_ids)
      .order('created_at');

    if (eventsError || !events || events.length < 2) {
      enhancedDuplicates.push(group as DuplicateGroup);
      continue;
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const timeDiff = new Date(lastEvent.created_at!).getTime() - new Date(firstEvent.created_at!).getTime();
    
    enhancedDuplicates.push({
      ...group,
      timing_analysis: {
        first_created: firstEvent.created_at!,
        last_created: lastEvent.created_at!,
        time_difference_ms: timeDiff,
        likely_double_submission: timeDiff < 5000 // Less than 5 seconds apart
      }
    } as DuplicateGroup);
  }

  return enhancedDuplicates;
}

function displayDuplicates(duplicates: DuplicateGroup[]) {
  console.log(`🚨 Found ${duplicates.length} duplicate event groups:\n`);

  duplicates.forEach((group, index) => {
    console.log(`${index + 1}. Host: ${group.host_name || 'Unknown'}`);
    console.log(`   Title: "${group.title}"`);
    console.log(`   Date: ${group.event_date}`);
    console.log(`   Duplicates: ${group.duplicate_count}`);
    console.log(`   Event IDs: ${group.event_ids.join(', ')}`);
    
    if (group.timing_analysis) {
      const { timing_analysis } = group;
      console.log(`   Created: ${timing_analysis.first_created} → ${timing_analysis.last_created}`);
      console.log(`   Time Gap: ${timing_analysis.time_difference_ms}ms`);
      console.log(`   Likely Double-Submit: ${timing_analysis.likely_double_submission ? '🔴 YES' : '🟡 NO'}`);
    }
    
    console.log('');
  });
}

async function analyzeCreationPatterns(duplicates: DuplicateGroup[]) {
  console.log('📊 ANALYSIS SUMMARY:\n');

  const doubleSubmissions = duplicates.filter(d => d.timing_analysis?.likely_double_submission);
  const slowDuplicates = duplicates.filter(d => !d.timing_analysis?.likely_double_submission);

  console.log(`• Double-submission duplicates: ${doubleSubmissions.length}`);
  console.log(`• Slow/manual duplicates: ${slowDuplicates.length}`);
  console.log(`• Total affected hosts: ${new Set(duplicates.map(d => d.host_user_id)).size}`);
  
  if (doubleSubmissions.length > 0) {
    console.log('\n🔴 DOUBLE-SUBMISSION CASES (< 5s apart):');
    doubleSubmissions.forEach(d => {
      console.log(`   • ${d.host_name}: ${d.timing_analysis!.time_difference_ms}ms gap`);
    });
  }

  if (slowDuplicates.length > 0) {
    console.log('\n🟡 MANUAL/SLOW DUPLICATES (> 5s apart):');
    slowDuplicates.forEach(d => {
      const seconds = Math.round(d.timing_analysis!.time_difference_ms / 1000);
      console.log(`   • ${d.host_name}: ${seconds}s gap`);
    });
  }
}

async function suggestCleanup(duplicates: DuplicateGroup[]) {
  console.log('\n🧹 CLEANUP RECOMMENDATIONS:\n');

  const safeToCleaup = duplicates.filter(d => {
    return d.timing_analysis?.likely_double_submission && d.duplicate_count === 2;
  });

  if (safeToCleaup.length === 0) {
    console.log('⚠️  No automatically safe cleanup candidates found.');
    console.log('   Manual review recommended for all duplicates.');
    return;
  }

  console.log(`✅ ${safeToCleaup.length} events safe for automatic cleanup:`);
  
  for (const group of safeToCleaup) {
    const eventIds = group.event_ids;
    const keepId = eventIds[0]; // Keep the first one
    const deleteIds = eventIds.slice(1);
    
    console.log(`   • Keep: ${keepId}, Delete: ${deleteIds.join(', ')}`);
  }

  console.log('\n📝 To cleanup safely:');
  console.log('   1. Verify no guests have been added to the duplicate events');
  console.log('   2. Check for any media or messages associated with duplicates');
  console.log('   3. Run: npx tsx scripts/detect-duplicate-events.ts --fix-duplicates');
}

async function performCleanup(duplicates: DuplicateGroup[]) {
  console.log('🧹 PERFORMING AUTOMATIC CLEANUP...\n');

  const safeToCleaup = duplicates.filter(d => {
    return d.timing_analysis?.likely_double_submission && d.duplicate_count === 2;
  });

  if (safeToCleaup.length === 0) {
    console.log('❌ No events meet the safe cleanup criteria.');
    return;
  }

  for (const group of safeToCleaup) {
    const eventIds = group.event_ids;
    const keepId = eventIds[0]; // Keep the first one (chronologically)
    const deleteIds = eventIds.slice(1);
    
    console.log(`Processing: ${group.title} (${group.host_name})`);
    
    for (const deleteId of deleteIds) {
      // Check if the duplicate event has any guests (other than host)
      const { data: guests, error: guestsError } = await supabase
        .from('event_guests')
        .select('id, role')
        .eq('event_id', deleteId);

      if (guestsError) {
        console.log(`  ❌ Error checking guests for ${deleteId}: ${guestsError.message}`);
        continue;
      }

      const nonHostGuests = guests?.filter(g => g.role !== 'host') || [];
      if (nonHostGuests.length > 0) {
        console.log(`  ⚠️  Skipping ${deleteId}: has ${nonHostGuests.length} non-host guests`);
        continue;
      }

      // Safe to delete - no additional guests
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteId);

      if (deleteError) {
        console.log(`  ❌ Error deleting ${deleteId}: ${deleteError.message}`);
      } else {
        console.log(`  ✅ Deleted duplicate event ${deleteId}`);
      }
    }
  }

  console.log('\n✅ Cleanup completed!');
}

async function main() {
  const shouldFix = process.argv.includes('--fix-duplicates');

  try {
    const duplicates = await detectDuplicates();
    
    if (duplicates.length === 0) {
      return;
    }

    displayDuplicates(duplicates);
    await analyzeCreationPatterns(duplicates);
    
    if (shouldFix) {
      await performCleanup(duplicates);
    } else {
      await suggestCleanup(duplicates);
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
