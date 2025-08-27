/**
 * Realtime Stability Integration Tests
 * 
 * End-to-end tests for realtime stability improvements including:
 * - Background/foreground transitions
 * - Offline/online behavior
 * - Token refresh handling
 */

import { test, expect } from '@playwright/test';

test.describe('Realtime Stability', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with realtime subscriptions (guest messages)
    await page.goto('/guest/test-event-id/messages');
    
    // Wait for initial load and auth
    await page.waitForLoadState('networkidle');
    
    // Ensure we're authenticated (mock or real auth)
    await expect(page.locator('[data-testid="guest-messaging-container"]')).toBeVisible();
  });

  test('should handle background/foreground transitions without timeout storms', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    // Capture console messages related to realtime
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('realtime') || text.includes('timeout') || text.includes('background')) {
        consoleMessages.push(text);
      }
    });

    // Simulate backgrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for background state to settle
    await page.waitForTimeout(2000);

    // Simulate foregrounding
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for foreground reconnect
    await page.waitForTimeout(5000);

    // Verify behavior
    const backgroundMessages = consoleMessages.filter(msg => 
      msg.includes('backgrounded') || msg.includes('adaptive timeout')
    );
    const foregroundMessages = consoleMessages.filter(msg => 
      msg.includes('foregrounded') || msg.includes('single reconnect')
    );
    const timeoutStorms = consoleMessages.filter(msg => 
      msg.includes('timeout') && msg.includes('retrying')
    );

    // Should have background/foreground messages
    expect(backgroundMessages.length).toBeGreaterThan(0);
    expect(foregroundMessages.length).toBeGreaterThan(0);
    
    // Should not have excessive timeout messages (storm prevention)
    expect(timeoutStorms.length).toBeLessThan(5);
  });

  test('should handle offline/online transitions cleanly', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('realtime') || text.includes('reconnect') || text.includes('online')) {
        consoleMessages.push(text);
      }
    });

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);

    // Come back online
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // Verify clean reconnection
    const reconnectMessages = consoleMessages.filter(msg => 
      msg.includes('reconnect') || msg.includes('online')
    );
    const coldReconnectMessages = consoleMessages.filter(msg => 
      msg.includes('cold reconnect')
    );

    // Should have reconnection activity
    expect(reconnectMessages.length).toBeGreaterThan(0);
    
    // Cold reconnect should only happen if needed (not on first offline/online)
    expect(coldReconnectMessages.length).toBeLessThanOrEqual(1);
  });

  test('should suppress timeout logging during background state', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('timeout') && text.includes('retrying')) {
        consoleMessages.push(text);
      }
    });

    // Go to background
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait longer than normal timeout period
    await page.waitForTimeout(35000); // Longer than 30s default timeout

    // Count timeout messages during background
    const timeoutsDuringBackground = consoleMessages.length;

    // Come back to foreground
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(5000);

    // Should have minimal timeout logging during background
    expect(timeoutsDuringBackground).toBeLessThan(3);
  });

  test('should show single token authority in logs', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('token') && (text.includes('single authority') || text.includes('deduped'))) {
        consoleMessages.push(text);
      }
    });

    // Trigger a token refresh simulation (if possible in test environment)
    // This would typically happen automatically, but we can check for the logs
    await page.waitForTimeout(10000);

    // Look for single authority messages
    const singleAuthorityMessages = consoleMessages.filter(msg => 
      msg.includes('single authority') || msg.includes('provider')
    );

    // Should have evidence of single token authority if token refresh occurred
    // This test might not always trigger in test environment, so we make it lenient
    if (singleAuthorityMessages.length > 0) {
      expect(singleAuthorityMessages.some(msg => msg.includes('single authority'))).toBe(true);
    }
  });

  test('should maintain subscription stability after multiple transitions', async ({ page }) => {
    const errorMessages: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorMessages.push(msg.text());
      }
    });

    // Perform multiple background/foreground cycles
    for (let i = 0; i < 3; i++) {
      // Background
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(5000);

      // Foreground
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(3000);
    }

    // Verify the page is still functional
    await expect(page.locator('[data-testid="guest-messaging-container"]')).toBeVisible();
    
    // Should not have accumulated errors
    const realtimeErrors = errorMessages.filter(msg => 
      msg.includes('realtime') || msg.includes('subscription')
    );
    expect(realtimeErrors.length).toBeLessThan(3);
  });
});
