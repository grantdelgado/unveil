#!/usr/bin/env tsx

/**
 * Script to Fix Realtime Subscription Issues
 * 
 * This script:
 * 1. Tests current subscription health
 * 2. Applies the realtime optimization migration
 * 3. Validates the fixes
 * 4. Provides debugging information
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create service client with enhanced realtime config
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: {
    timeout: 30000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
  },
});

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message?: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${icon} ${result.name}: ${result.status}${duration}`);
  if (result.message) {
    console.log(`   ${result.message}`);
  }
  if (result.details) {
    console.log(`   Details:`, result.details);
  }
  results.push(result);
}

async function testRealtimeConnection(): Promise<void> {
  console.log('\n🔍 Testing Realtime Connection...');
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logResult({
        name: 'Realtime Connection',
        status: 'FAIL',
        message: 'Connection timeout after 10 seconds',
        duration: Date.now() - startTime,
      });
      resolve();
    }, 10000);
    
    const channel = supabase.channel('test-connection-health');
    
    channel.subscribe((status, error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      if (error) {
        logResult({
          name: 'Realtime Connection',
          status: 'FAIL',
          message: `Connection failed: ${error.message}`,
          duration,
          details: error,
        });
      } else if (status === 'SUBSCRIBED') {
        logResult({
          name: 'Realtime Connection',
          status: 'PASS',
          message: 'Successfully connected to realtime',
          duration,
        });
      } else {
        logResult({
          name: 'Realtime Connection',
          status: 'WARNING',
          message: `Connection status: ${status}`,
          duration,
        });
      }
      
      // Clean up
      supabase.removeChannel(channel);
      resolve();
    });
  });
}

async function testDatabaseAccess(): Promise<void> {
  console.log('\n🔍 Testing Database Access...');
  
  try {
    const startTime = Date.now();
    
    // Test basic database connection
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, host_user_id')
      .limit(1);
    
    const duration = Date.now() - startTime;
    
    if (error) {
      logResult({
        name: 'Database Access',
        status: 'FAIL',
        message: `Database query failed: ${error.message}`,
        duration,
        details: error,
      });
    } else {
      logResult({
        name: 'Database Access',
        status: 'PASS',
        message: `Successfully queried database (${events?.length || 0} events found)`,
        duration,
      });
    }
  } catch (error) {
    logResult({
      name: 'Database Access',
      status: 'FAIL',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    });
  }
}

async function checkRLSPolicies(): Promise<void> {
  console.log('\n🔍 Checking RLS Policies...');
  
  try {
    const startTime = Date.now();
    
    // Check messages table policies
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'messages');
    
    const duration = Date.now() - startTime;
    
    if (error) {
      logResult({
        name: 'RLS Policy Check',
        status: 'FAIL',
        message: `Failed to check RLS policies: ${error.message}`,
        duration,
        details: error,
      });
    } else {
      const policyCount = policies?.length || 0;
      const hasOptimizedPolicy = policies?.some(p => p.policyname === 'messages_realtime_optimized');
      
      logResult({
        name: 'RLS Policy Check',
        status: hasOptimizedPolicy ? 'PASS' : 'WARNING',
        message: `Found ${policyCount} policies on messages table${hasOptimizedPolicy ? ' (including optimized policy)' : ' (no optimized policy found)'}`,
        duration,
        details: policies?.map(p => p.policyname),
      });
    }
  } catch (error) {
    logResult({
      name: 'RLS Policy Check',
      status: 'FAIL',
      message: `RLS policy check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    });
  }
}

async function testMessageSubscription(eventId?: string): Promise<void> {
  console.log('\n🔍 Testing Message Subscription...');
  
  if (!eventId) {
    // Try to find an event to test with
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .limit(1);
    
    if (!events || events.length === 0) {
      logResult({
        name: 'Message Subscription Test',
        status: 'WARNING',
        message: 'No events found to test subscription with',
      });
      return;
    }
    
    eventId = events[0].id;
  }
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logResult({
        name: 'Message Subscription Test',
        status: 'FAIL',
        message: 'Subscription timeout after 15 seconds',
        duration: Date.now() - startTime,
      });
      resolve();
    }, 15000);
    
    let receivedData = false;
    
    const channel = supabase
      .channel(`test-messages-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          receivedData = true;
          console.log('📡 Received test data:', payload.eventType);
        }
      )
      .subscribe((status, error) => {
        const duration = Date.now() - startTime;
        
        if (error) {
          clearTimeout(timeout);
          logResult({
            name: 'Message Subscription Test',
            status: 'FAIL',
            message: `Subscription failed: ${error.message}`,
            duration,
            details: { eventId, error },
          });
          supabase.removeChannel(channel);
          resolve();
        } else if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          logResult({
            name: 'Message Subscription Test',
            status: 'PASS',
            message: `Successfully subscribed to messages for event ${eventId}`,
            duration,
            details: { eventId, receivedData },
          });
          supabase.removeChannel(channel);
          resolve();
        } else if (status === 'TIMED_OUT') {
          clearTimeout(timeout);
          logResult({
            name: 'Message Subscription Test',
            status: 'FAIL',
            message: 'Subscription timed out',
            duration,
            details: { eventId },
          });
          supabase.removeChannel(channel);
          resolve();
        }
      });
  });
}

async function applyOptimizationMigration(): Promise<void> {
  console.log('\n🚀 Applying Realtime Optimization Migration...');
  
  const migrationSQL = `
    -- Fix Realtime Subscription Issues Migration
    
    -- Drop existing problematic policies
    DROP POLICY IF EXISTS "messages_select_optimized" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_update_host_only" ON public.messages;
    DROP POLICY IF EXISTS "messages_select_event_accessible" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_event_participant" ON public.messages;
    
    -- Create optimized policy
    CREATE POLICY "messages_realtime_optimized" ON public.messages
    FOR ALL TO authenticated, anon
    USING (
      EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = messages.event_id 
        AND (
          e.host_user_id = (SELECT auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM public.event_guests eg
            WHERE eg.event_id = e.id 
            AND eg.phone = (auth.jwt() ->> 'phone')
            AND (auth.jwt() ->> 'phone') IS NOT NULL
          )
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.id = messages.event_id 
        AND (
          e.host_user_id = (SELECT auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM public.event_guests eg
            WHERE eg.event_id = e.id 
            AND eg.phone = (auth.jwt() ->> 'phone')
            AND (auth.jwt() ->> 'phone') IS NOT NULL
          )
        )
      )
    );
    
    -- Create optimized indexes
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_realtime_access 
    ON public.messages(event_id, created_at DESC)
    WHERE event_id IS NOT NULL;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_phone_realtime 
    ON public.event_guests(phone, event_id)
    WHERE phone IS NOT NULL;
    
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_host_realtime 
    ON public.events(id, host_user_id)
    WHERE host_user_id IS NOT NULL;
    
    -- Ensure realtime is enabled
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    
    -- Update statistics
    ANALYZE public.messages;
    ANALYZE public.events;
    ANALYZE public.event_guests;
  `;
  
  try {
    const startTime = Date.now();
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    const duration = Date.now() - startTime;
    
    if (error) {
      logResult({
        name: 'Migration Application',
        status: 'FAIL',
        message: `Migration failed: ${error.message}`,
        duration,
        details: error,
      });
    } else {
      logResult({
        name: 'Migration Application',
        status: 'PASS',
        message: 'Realtime optimization migration applied successfully',
        duration,
      });
    }
  } catch (error) {
    logResult({
      name: 'Migration Application',
      status: 'FAIL',
      message: `Migration execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    });
  }
}

async function generateReport(): Promise<void> {
  console.log('\n📊 Test Summary Report');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  Warnings:');
    results
      .filter(r => r.status === 'WARNING')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
  }
  
  console.log('\n🔧 Recommended Actions:');
  
  if (failed > 0 || warnings > 0) {
    console.log('   1. Review failed tests and address underlying issues');
    console.log('   2. Run this script again to verify fixes');
    console.log('   3. Monitor realtime subscription health in production');
  } else {
    console.log('   ✅ All tests passed! Your realtime subscriptions should work correctly now.');
  }
  
  console.log('\n🐛 Debugging Tools:');
  console.log('   - Use debug_message_access(event_id, phone) to test access');
  console.log('   - Check realtime_subscription_health view for policy analysis');
  console.log('   - Monitor subscription manager logs in browser console');
}

async function main(): Promise<void> {
  console.log('🚀 Realtime Subscription Fix & Test Script');
  console.log('==========================================\n');
  
  const args = process.argv.slice(2);
  const testEventId = args.find(arg => arg.startsWith('--event-id='))?.split('=')[1];
  const skipMigration = args.includes('--skip-migration');
  
  if (testEventId) {
    console.log(`🎯 Testing with specific event ID: ${testEventId}`);
  }
  
  try {
    // Pre-fix tests
    await testDatabaseAccess();
    await testRealtimeConnection();
    await checkRLSPolicies();
    
    // Apply fixes if not skipped
    if (!skipMigration) {
      await applyOptimizationMigration();
    } else {
      console.log('\n⏭️  Skipping migration application (--skip-migration flag set)');
    }
    
    // Post-fix tests
    await testMessageSubscription(testEventId);
    
    // Generate report
    await generateReport();
    
  } catch (error) {
    console.error('\n💥 Script execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await supabase.auth.signOut();
  }
  
  console.log('\n🎉 Script completed!');
  
  // Exit with error code if any tests failed
  const hasFailures = results.some(r => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { main as fixRealtimeSubscriptions }; 