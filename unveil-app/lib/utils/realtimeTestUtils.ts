/**
 * Realtime Test Utilities
 * 
 * Utilities for manually testing realtime subscription stability in development.
 * These are only available in development mode.
 */

import { getSubscriptionManager } from '@/lib/realtime/SubscriptionManager';
import { logger } from '@/lib/logger';

interface TestResults {
  passed: number;
  failed: number;
  details: string[];
}

/**
 * Test subscription stability by creating, monitoring, and cleaning up test subscriptions
 */
export async function testSubscriptionStability(): Promise<TestResults> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Realtime test utilities are only available in development');
  }

  const results: TestResults = { passed: 0, failed: 0, details: [] };
  
  try {
    const subscriptionManager = getSubscriptionManager();
    const testSubscriptionId = `test-stability-${Date.now()}`;
    
    // Test 1: Create subscription
    try {
      const unsubscribe = subscriptionManager.subscribe(testSubscriptionId, {
        table: 'test_table',
        event: 'INSERT',
        schema: 'public',
        filter: 'id=eq.test',
        callback: () => {},
        onError: (error) => {
          results.details.push(`❌ Test subscription error: ${error.message}`);
        },
        onStatusChange: (status) => {
          results.details.push(`📡 Test subscription status: ${status}`);
        }
      });
      
      results.passed++;
      results.details.push('✅ Successfully created test subscription');
      
      // Test 2: Check subscription exists
      const stats = subscriptionManager.getStats();
      const hasTestSubscription = stats.totalSubscriptions > 0;
      
      if (hasTestSubscription) {
        results.passed++;
        results.details.push('✅ Subscription appears in stats');
      } else {
        results.failed++;
        results.details.push('❌ Subscription not found in stats');
      }
      
      // Test 3: Clean up subscription
      unsubscribe();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const statsAfterCleanup = subscriptionManager.getStats();
      if (statsAfterCleanup.totalSubscriptions < stats.totalSubscriptions) {
        results.passed++;
        results.details.push('✅ Subscription cleaned up successfully');
      } else {
        results.failed++;
        results.details.push('❌ Subscription not cleaned up properly');
      }
      
    } catch (error) {
      results.failed++;
      results.details.push(`❌ Subscription test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    results.failed++;
    results.details.push(`❌ Test setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return results;
}

/**
 * Test network state handling
 */
export async function testNetworkStateHandling(): Promise<TestResults> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Realtime test utilities are only available in development');
  }
  
  const results: TestResults = { passed: 0, failed: 0, details: [] };
  
  try {
    // Test online/offline events
    const originalOnLine = navigator.onLine;
    
    // Mock going offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    
    results.details.push('📡 Simulated offline state');
    
    // Mock coming back online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    
    results.details.push('📡 Simulated online state');
    results.passed++;
    results.details.push('✅ Network state events dispatched successfully');
    
    // Restore original state
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    
  } catch (error) {
    results.failed++;
    results.details.push(`❌ Network test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return results;
}

/**
 * Test visibility change handling
 */
export async function testVisibilityHandling(): Promise<TestResults> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Realtime test utilities are only available in development');
  }
  
  const results: TestResults = { passed: 0, failed: 0, details: [] };
  
  try {
    const originalHidden = document.hidden;
    
    // Mock page becoming hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    
    results.details.push('👁️ Simulated page hidden');
    
    // Mock page becoming visible
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    
    results.details.push('👁️ Simulated page visible');
    results.passed++;
    results.details.push('✅ Visibility change events dispatched successfully');
    
    // Restore original state
    Object.defineProperty(document, 'hidden', { value: originalHidden, configurable: true });
    
  } catch (error) {
    results.failed++;
    results.details.push(`❌ Visibility test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return results;
}

/**
 * Run all stability tests
 */
export async function runAllStabilityTests(): Promise<TestResults> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Realtime test utilities are only available in development');
  }
  
  logger.info('🧪 Running realtime stability tests...');
  
  const allResults: TestResults = { passed: 0, failed: 0, details: [] };
  
  // Run subscription stability test
  const subscriptionResults = await testSubscriptionStability();
  allResults.passed += subscriptionResults.passed;
  allResults.failed += subscriptionResults.failed;
  allResults.details.push('📡 Subscription Stability Tests:');
  allResults.details.push(...subscriptionResults.details);
  allResults.details.push('');
  
  // Run network state test
  const networkResults = await testNetworkStateHandling();
  allResults.passed += networkResults.passed;
  allResults.failed += networkResults.failed;
  allResults.details.push('🌐 Network State Tests:');
  allResults.details.push(...networkResults.details);
  allResults.details.push('');
  
  // Run visibility test
  const visibilityResults = await testVisibilityHandling();
  allResults.passed += visibilityResults.passed;
  allResults.failed += visibilityResults.failed;
  allResults.details.push('👁️ Visibility Change Tests:');
  allResults.details.push(...visibilityResults.details);
  allResults.details.push('');
  
  // Summary
  allResults.details.push(`📊 Test Summary: ${allResults.passed} passed, ${allResults.failed} failed`);
  
  // Log results
  allResults.details.forEach(detail => {
    if (detail.startsWith('❌')) {
      logger.error(detail);
    } else if (detail.startsWith('✅')) {
      logger.info(detail);
    } else {
      logger.info(detail);
    }
  });
  
  return allResults;
}

/**
 * Make test utilities available on window in development
 */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).realtimeTests = {
    testSubscriptionStability,
    testNetworkStateHandling,
    testVisibilityHandling,
    runAllStabilityTests,
  };
  
  console.log('🧪 Realtime test utilities available at window.realtimeTests');
}
