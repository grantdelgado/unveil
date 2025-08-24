#!/usr/bin/env tsx

/**
 * Debug Script: Scheduled SMS Missing Event Tags
 * 
 * This script helps diagnose why scheduled SMS messages are missing event tags
 * by testing the exact production conditions.
 */

import { composeSmsText } from '../lib/sms-formatter';
import { flags } from '../config/flags';

async function debugScheduledSMS() {
  console.log('🔍 Debugging Scheduled SMS Event Tag Issue\n');

  // Check environment flags
  console.log('📋 Environment Configuration:');
  console.log(`  SMS_BRANDING_DISABLED: ${process.env.SMS_BRANDING_DISABLED || '(unset)'}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  Flag value: ${flags.ops.smsBrandingDisabled}`);
  console.log('');

  // Test scenarios
  const testCases = [
    {
      name: 'Normal Operation (branding enabled)',
      eventId: 'test-event-123',
      guestId: 'test-guest-456',
      message: 'Test scheduled message',
      setup: () => {
        delete process.env.SMS_BRANDING_DISABLED;
      }
    },
    {
      name: 'Kill Switch Active (branding disabled)',
      eventId: 'test-event-123',
      guestId: 'test-guest-456',
      message: 'Test scheduled message with kill switch',
      setup: () => {
        process.env.SMS_BRANDING_DISABLED = 'true';
      }
    },
    {
      name: 'Production-like Environment',
      eventId: 'prod-event-789',
      guestId: 'prod-guest-012',
      message: 'Production test message',
      setup: () => {
        process.env.NODE_ENV = 'production';
        delete process.env.SMS_BRANDING_DISABLED;
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    
    // Setup environment
    testCase.setup();
    
    // Clear require cache to pick up env changes
    delete require.cache[require.resolve('../config/flags')];
    const { flags: currentFlags } = require('../config/flags');
    
    try {
      const result = await composeSmsText(
        testCase.eventId,
        testCase.guestId,
        testCase.message
      );

      console.log(`  ✅ Result:`);
      console.log(`     Text: "${result.text}"`);
      console.log(`     Header: ${result.included.header}`);
      console.log(`     Brand: ${result.included.brand}`);
      console.log(`     Stop: ${result.included.stop}`);
      console.log(`     Reason: ${result.reason || 'none'}`);
      console.log(`     Kill Switch: ${currentFlags.ops.smsBrandingDisabled}`);
      
      // Analysis
      if (!result.included.header && !currentFlags.ops.smsBrandingDisabled) {
        console.log(`  🚨 ISSUE: Header missing but kill switch is OFF!`);
        console.log(`     This indicates a fallback scenario.`);
        console.log(`     Reason: ${result.reason}`);
      } else if (!result.included.header && currentFlags.ops.smsBrandingDisabled) {
        console.log(`  ⚠️  EXPECTED: Header missing because kill switch is ON`);
        console.log(`     But our new implementation should preserve headers!`);
      } else if (result.included.header) {
        console.log(`  ✅ GOOD: Header is included as expected`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('');
  }

  // Test Supabase client behavior
  console.log('🔌 Testing Supabase Client Behavior:');
  
  try {
    // Test server client (Send Now path)
    const { createServerSupabaseClient } = await import('../lib/supabase/server');
    const serverClient = await createServerSupabaseClient();
    console.log('  ✅ Server client: Available');
  } catch (error) {
    console.log('  ❌ Server client: Failed');
    console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  try {
    // Test admin client (Scheduled path fallback)
    const { supabase: adminClient } = await import('../lib/supabase/admin');
    console.log('  ✅ Admin client: Available');
  } catch (error) {
    console.log('  ❌ Admin client: Failed');
    console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  console.log('\n🎯 Recommendations:');
  console.log('1. Check production logs for "SMS formatting completed" entries');
  console.log('2. Look for "reason: fallback" in the logs');
  console.log('3. Verify SMS_BRANDING_DISABLED is not set in production');
  console.log('4. Check if event fetch is failing due to RLS or connectivity');
  console.log('5. Monitor telemetry for "messaging.formatter.fallback_used" metrics');
}

// Run the debug script
debugScheduledSMS().catch(console.error);
