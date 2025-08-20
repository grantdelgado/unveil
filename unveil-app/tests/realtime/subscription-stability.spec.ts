import { test, expect } from '@playwright/test';

/**
 * Realtime Subscription Stability Tests
 * 
 * These tests validate the stability improvements made to the guest dashboard:
 * - Idle behavior without channel errors
 * - Recovery from network changes
 * - Background/foreground handling
 * - Token refresh handling
 */

test.describe('Guest Dashboard Realtime Stability', () => {
  // Configure retries for stability tests
  test.describe.configure({ retries: process.env.CI ? 2 : 1 });
  
  test.beforeEach(async ({ page }) => {
    // Mock a successful auth state
    await page.addInitScript(() => {
      // Mock successful auth to avoid login flow in tests
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }));
    });
  });

  test('should maintain stable subscriptions during idle period', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(10 * 60 * 1000); // 10 minutes
    
    // Navigate to guest dashboard
    await page.goto('/guest/events/test-event-id/home');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('CHANNEL_ERROR')) {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait for appropriate duration based on environment
    const idleTime = process.env.CI ? 2 * 60 * 1000 : 5 * 60 * 1000; // 2min CI, 5min local
    await page.waitForTimeout(idleTime);
    
    // Should have no channel errors
    expect(consoleErrors).toHaveLength(0);
    
    // Check debug panel shows healthy state (if in dev mode)
    const debugPanel = page.locator('[data-testid="realtime-debug-panel"]');
    if (await debugPanel.isVisible()) {
      const healthScore = await debugPanel.locator('.health-score').textContent();
      expect(parseInt(healthScore || '0')).toBeGreaterThan(80);
    }
  });

  test('should recover from network offline/online cycle', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('realtime') || msg.text().includes('subscription')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Simulate going offline
    await page.setOfflineMode(true);
    await page.waitForTimeout(2000);
    
    // Go back online
    await page.setOfflineMode(false);
    await page.waitForTimeout(5000);
    
    // Should have reconnection messages
    const reconnectMessages = consoleMessages.filter(msg => 
      msg.includes('Back online') || msg.includes('Reconnecting')
    );
    expect(reconnectMessages.length).toBeGreaterThan(0);
    
    // Should not have stuck channel errors
    const channelErrors = consoleMessages.filter(msg => 
      msg.includes('CHANNEL_ERROR') && !msg.includes('reconnect')
    );
    expect(channelErrors).toHaveLength(0);
  });

  test('should handle page visibility changes gracefully', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('backgrounded') || msg.text().includes('foregrounded')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Simulate backgrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1000);
    
    // Simulate foregrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2000);
    
    // Should have visibility change handling messages
    const visibilityMessages = consoleMessages.filter(msg => 
      msg.includes('backgrounded') || msg.includes('foregrounded')
    );
    expect(visibilityMessages.length).toBeGreaterThan(0);
  });

  test('should not create duplicate subscriptions', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    // Enable debug panel if available
    const debugPanel = page.locator('[data-testid="realtime-debug-panel"]');
    if (await debugPanel.isVisible()) {
      await debugPanel.click(); // Expand debug panel
      
      // Check subscription details
      const subscriptionList = debugPanel.locator('.subscription-list');
      if (await subscriptionList.isVisible()) {
        const subscriptions = await subscriptionList.locator('.subscription-item').all();
        
        // Extract subscription IDs to check for duplicates
        const subscriptionIds: string[] = [];
        for (const sub of subscriptions) {
          const id = await sub.getAttribute('data-subscription-id');
          if (id) subscriptionIds.push(id);
        }
        
        // Should not have duplicate subscription IDs
        const uniqueIds = new Set(subscriptionIds);
        expect(uniqueIds.size).toBe(subscriptionIds.length);
      }
    }
    
    // Force a component remount by navigating away and back
    await page.goto('/guest/events/test-event-id/schedule');
    await page.waitForTimeout(500);
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForTimeout(2000);
    
    // Check console for duplicate subscription warnings
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('already exists') || msg.text().includes('duplicate')) {
        consoleWarnings.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    expect(consoleWarnings).toHaveLength(0);
  });

  test('should handle token refresh without breaking subscriptions', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Token refreshed') || msg.text().includes('realtime auth')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Simulate token refresh
    await page.evaluate(() => {
      // Trigger a token refresh event
      const event = new CustomEvent('supabase:auth-change', {
        detail: { event: 'TOKEN_REFRESHED', session: { access_token: 'new-mock-token' } }
      });
      window.dispatchEvent(event);
    });
    
    await page.waitForTimeout(2000);
    
    // Should have token refresh handling
    const tokenRefreshMessages = consoleMessages.filter(msg => 
      msg.includes('Token refreshed') || msg.includes('updating realtime auth')
    );
    expect(tokenRefreshMessages.length).toBeGreaterThan(0);
    
    // Subscriptions should remain stable
    await page.waitForTimeout(3000);
    const errorMessages = consoleMessages.filter(msg => 
      msg.includes('subscription error') && !msg.includes('recovered')
    );
    expect(errorMessages).toHaveLength(0);
  });
});

/**
 * Smoke Test for Critical Guest Dashboard Flows
 */
test.describe('Guest Dashboard Smoke Tests', () => {
  test('should load guest dashboard without subscription errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    // Check that key elements are present
    await expect(page.locator('[data-testid="event-messages-card"]')).toBeVisible();
    
    // Should not have critical subscription errors
    const subscriptionErrors = consoleErrors.filter(err => 
      err.includes('subscription') && !err.includes('retry')
    );
    expect(subscriptionErrors).toHaveLength(0);
  });
  
  test('should show live connection indicator', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');
    
    // Wait for connections to establish
    await page.waitForTimeout(2000);
    
    // Should show live indicator
    const liveIndicator = page.locator('text=Live');
    await expect(liveIndicator).toBeVisible();
  });
});
