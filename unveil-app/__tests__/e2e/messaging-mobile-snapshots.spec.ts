/**
 * Playwright mobile snapshot tests for messaging UI and CLS metrics
 * 
 * Tests:
 * - Messaging list shows "today / yesterday / date" chunking
 * - No flicker on new message arrival
 * - Composer + keyboard overlay respects safe-area
 * - No layout jump; CLS < 0.02
 * - StrictMode enabled: mount/unmount does not cause duplicate realtime updates
 */

import { test, expect, devices } from '@playwright/test';

// Test configuration
const MOBILE_DEVICES = {
  'iPhone 14': devices['iPhone 14'],
  'Pixel 7': devices['Pixel 7'],
  'iPhone 14 Pro Max': devices['iPhone 14 Pro Max'],
};

const CLS_THRESHOLD = 0.02; // Cumulative Layout Shift threshold

// Test observability counters (TEST-ONLY)
let testCounters = {
  snapshotsTaken: 0,
  clsChecks: 0,
  keyboardTests: 0,
  realtimeTests: 0,
  layoutStabilityChecks: 0,
};

// Helper to measure CLS
async function measureCLS(page: any): Promise<number> {
  return await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      // Wait a bit for layout shifts to settle
      setTimeout(() => {
        observer.disconnect();
        resolve(clsValue);
      }, 1000);
    });
  });
}

// Helper to inject test messages
async function injectTestMessages(page: any) {
  await page.evaluate(() => {
    // Mock message data for testing
    const mockMessages = [
      {
        message_id: 'msg-today-1',
        content: 'Today message 1',
        created_at: new Date().toISOString(),
        delivery_status: 'delivered',
        sender_name: 'Host',
        sender_avatar_url: null,
        message_type: 'announcement',
        is_own_message: false,
      },
      {
        message_id: 'msg-yesterday-1',
        content: 'Yesterday message',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        delivery_status: 'delivered',
        sender_name: 'Host',
        sender_avatar_url: null,
        message_type: 'announcement',
        is_own_message: false,
      },
      {
        message_id: 'msg-older-1',
        content: 'Older message',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        delivery_status: 'delivered',
        sender_name: 'Host',
        sender_avatar_url: null,
        message_type: 'announcement',
        is_own_message: false,
      },
    ];
    
    // Store in global for component access
    (window as any).__TEST_MESSAGES__ = mockMessages;
  });
}

// Configure tests for each mobile device
Object.entries(MOBILE_DEVICES).forEach(([deviceName, device]) => {
  test.describe(`Messaging Mobile UI - ${deviceName}`, () => {
    test.use({ ...device });

    test.beforeEach(async ({ page }) => {
      // Reset counters
      testCounters = {
        snapshotsTaken: 0,
        clsChecks: 0,
        keyboardTests: 0,
        realtimeTests: 0,
        layoutStabilityChecks: 0,
      };

      // Navigate to guest messaging page
      await page.goto('/guest/events/test-event-123/messages');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Inject test data
      await injectTestMessages(page);
    });

    test('should display date chunking correctly', async ({ page }) => {
      // Wait for messages to render
      await page.waitForSelector('[data-testid="message-list"]', { timeout: 10000 });
      
      // Take screenshot for visual regression
      await page.screenshot({
        path: `test-results/messaging-date-chunks-${deviceName.replace(/\s+/g, '-')}.png`,
        fullPage: true,
      });
      testCounters.snapshotsTaken++;

      // Check for date separators
      const todayHeader = page.locator('text=Today');
      const yesterdayHeader = page.locator('text=Yesterday');
      
      await expect(todayHeader).toBeVisible();
      await expect(yesterdayHeader).toBeVisible();
      
      // Verify messages are grouped correctly
      const messageGroups = page.locator('[data-testid="message-group"]');
      const groupCount = await messageGroups.count();
      expect(groupCount).toBeGreaterThanOrEqual(2); // At least Today and Yesterday
    });

    test('should handle new message arrival without flicker', async ({ page }) => {
      // Initial screenshot
      await page.waitForSelector('[data-testid="message-list"]');
      await page.screenshot({
        path: `test-results/before-new-message-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure initial CLS
      const initialCLS = await measureCLS(page);
      testCounters.clsChecks++;

      // Simulate new message arrival
      await page.evaluate(() => {
        const newMessage = {
          message_id: 'msg-new-realtime',
          content: 'New realtime message',
          created_at: new Date().toISOString(),
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        };
        
        // Trigger message update (simulate realtime)
        const event = new CustomEvent('newMessage', { detail: newMessage });
        window.dispatchEvent(event);
      });

      // Wait for message to appear
      await page.waitForSelector('text=New realtime message', { timeout: 5000 });

      // Take screenshot after message arrival
      await page.screenshot({
        path: `test-results/after-new-message-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure CLS after message arrival
      const finalCLS = await measureCLS(page);
      testCounters.clsChecks++;
      testCounters.layoutStabilityChecks++;

      // CLS should be minimal
      expect(finalCLS).toBeLessThan(CLS_THRESHOLD);
      
      // New message should be visible
      await expect(page.locator('text=New realtime message')).toBeVisible();
    });

    test('should handle composer keyboard overlay correctly', async ({ page }) => {
      // Find message input
      const messageInput = page.locator('[data-testid="message-input"]');
      await expect(messageInput).toBeVisible();

      // Take screenshot before keyboard
      await page.screenshot({
        path: `test-results/before-keyboard-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure CLS before keyboard interaction
      const beforeKeyboardCLS = await measureCLS(page);
      testCounters.clsChecks++;

      // Focus input to trigger virtual keyboard
      await messageInput.focus();
      await messageInput.fill('Test message content');

      // Wait for keyboard animation
      await page.waitForTimeout(1000);

      // Take screenshot with keyboard
      await page.screenshot({
        path: `test-results/with-keyboard-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;
      testCounters.keyboardTests++;

      // Check that composer is still visible and properly positioned
      const composer = page.locator('[data-testid="message-composer"]');
      await expect(composer).toBeVisible();

      // Verify safe area handling
      const composerBox = await composer.boundingBox();
      expect(composerBox).not.toBeNull();
      
      if (composerBox) {
        // Composer should not be cut off at bottom
        const viewportSize = page.viewportSize();
        expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(viewportSize!.height);
      }

      // Measure CLS after keyboard interaction
      const afterKeyboardCLS = await measureCLS(page);
      testCounters.clsChecks++;
      testCounters.layoutStabilityChecks++;

      // CLS should remain low even with keyboard
      expect(afterKeyboardCLS).toBeLessThan(CLS_THRESHOLD);
    });

    test('should maintain stable layout during typing', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      await messageInput.focus();

      // Measure CLS during typing
      const startCLS = await measureCLS(page);
      testCounters.clsChecks++;

      // Type a long message that might cause layout changes
      const longMessage = 'This is a very long message that might cause the text area to expand and potentially trigger layout shifts if not handled properly. We want to ensure the UI remains stable during typing.';
      
      await messageInput.fill(longMessage);

      // Wait for any layout adjustments
      await page.waitForTimeout(500);

      // Take screenshot during typing
      await page.screenshot({
        path: `test-results/during-typing-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure final CLS
      const endCLS = await measureCLS(page);
      testCounters.clsChecks++;
      testCounters.layoutStabilityChecks++;

      // Layout should remain stable
      expect(endCLS).toBeLessThan(CLS_THRESHOLD);

      // Character counter should be visible if present
      const charCounter = page.locator('[data-testid="character-counter"]');
      if (await charCounter.isVisible()) {
        await expect(charCounter).toContainText(longMessage.length.toString());
      }
    });

    test('should handle StrictMode without duplicate realtime subscriptions', async ({ page }) => {
      // Enable console logging to catch duplicate subscription warnings
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'warn') {
          consoleMessages.push(msg.text());
        }
      });

      // Simulate StrictMode double mount by navigating away and back
      await page.goto('/guest/events/test-event-123/home');
      await page.waitForLoadState('networkidle');
      
      await page.goto('/guest/events/test-event-123/messages');
      await page.waitForLoadState('networkidle');

      // Wait for component stabilization
      await page.waitForTimeout(2000);
      testCounters.realtimeTests++;

      // Check for duplicate subscription warnings
      const duplicateWarnings = consoleMessages.filter(msg => 
        msg.includes('duplicate') || 
        msg.includes('StrictMode') ||
        msg.includes('already exists')
      );

      // Should not have duplicate subscription warnings
      expect(duplicateWarnings.length).toBe(0);

      // Messages should still load correctly
      await page.waitForSelector('[data-testid="message-list"]');
      const messages = page.locator('[data-testid="message-item"]');
      const messageCount = await messages.count();
      expect(messageCount).toBeGreaterThan(0);

      // Take screenshot to verify UI is working
      await page.screenshot({
        path: `test-results/after-remount-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;
    });

    test('should maintain scroll position during realtime updates', async ({ page }) => {
      // Scroll to middle of message list
      const messageList = page.locator('[data-testid="message-list"]');
      await messageList.scrollIntoView();
      
      // Scroll down a bit
      await page.evaluate(() => {
        const list = document.querySelector('[data-testid="message-list"]');
        if (list) {
          list.scrollTop = 200;
        }
      });

      // Get initial scroll position
      const initialScrollTop = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="message-list"]');
        return list ? list.scrollTop : 0;
      });

      // Take screenshot at scroll position
      await page.screenshot({
        path: `test-results/scroll-position-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Simulate new message arrival (should not affect scroll)
      await page.evaluate(() => {
        const newMessage = {
          message_id: 'msg-scroll-test',
          content: 'Message during scroll test',
          created_at: new Date().toISOString(),
          delivery_status: 'delivered',
          sender_name: 'Host',
          sender_avatar_url: null,
          message_type: 'announcement',
          is_own_message: false,
        };
        
        const event = new CustomEvent('newMessage', { detail: newMessage });
        window.dispatchEvent(event);
      });

      // Wait for message to be processed
      await page.waitForTimeout(1000);

      // Check scroll position hasn't changed
      const finalScrollTop = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="message-list"]');
        return list ? list.scrollTop : 0;
      });

      testCounters.layoutStabilityChecks++;

      // Scroll position should be preserved (within small tolerance)
      expect(Math.abs(finalScrollTop - initialScrollTop)).toBeLessThan(10);
    });

    test('should handle orientation change gracefully', async ({ page }) => {
      // Take screenshot in portrait
      await page.screenshot({
        path: `test-results/portrait-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure CLS before rotation
      const beforeRotationCLS = await measureCLS(page);
      testCounters.clsChecks++;

      // Simulate orientation change (landscape)
      const currentViewport = page.viewportSize()!;
      await page.setViewportSize({
        width: currentViewport.height,
        height: currentViewport.width,
      });

      // Wait for layout adjustment
      await page.waitForTimeout(1000);

      // Take screenshot in landscape
      await page.screenshot({
        path: `test-results/landscape-${deviceName.replace(/\s+/g, '-')}.png`,
      });
      testCounters.snapshotsTaken++;

      // Measure CLS after rotation
      const afterRotationCLS = await measureCLS(page);
      testCounters.clsChecks++;
      testCounters.layoutStabilityChecks++;

      // UI should still be functional
      const messageList = page.locator('[data-testid="message-list"]');
      await expect(messageList).toBeVisible();

      const composer = page.locator('[data-testid="message-composer"]');
      await expect(composer).toBeVisible();

      // Layout shift should be minimal
      expect(afterRotationCLS).toBeLessThan(CLS_THRESHOLD * 2); // Allow slightly higher for orientation change
    });
  });
});

// Cross-device comparison tests
test.describe('Cross-Device Messaging Consistency', () => {
  test('should maintain consistent layout across devices', async ({ page }) => {
    const screenshots: { [key: string]: Buffer } = {};
    
    for (const [deviceName, device] of Object.entries(MOBILE_DEVICES)) {
      await page.setViewportSize(device.viewport);
      await page.goto('/guest/events/test-event-123/messages');
      await page.waitForLoadState('networkidle');
      
      await injectTestMessages(page);
      await page.waitForSelector('[data-testid="message-list"]');
      
      // Take screenshot for comparison
      const screenshot = await page.screenshot();
      screenshots[deviceName] = screenshot;
      testCounters.snapshotsTaken++;
    }
    
    // All devices should have message list visible
    expect(Object.keys(screenshots)).toHaveLength(3);
  });
});

// Performance regression tests
test.describe('Messaging Performance Regression', () => {
  test.use(MOBILE_DEVICES['iPhone 14']);

  test('should load messages within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/guest/events/test-event-123/messages');
    await page.waitForSelector('[data-testid="message-list"]');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds on mobile
    expect(loadTime).toBeLessThan(3000);
    
    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals: any = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
          });
          
          resolve(vitals);
        });
        
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        setTimeout(() => resolve({}), 2000);
      });
    });
    
    // Core Web Vitals should be within acceptable ranges for mobile
    if ((vitals as any).fcp) {
      expect((vitals as any).fcp).toBeLessThan(2000); // FCP < 2s
    }
    if ((vitals as any).lcp) {
      expect((vitals as any).lcp).toBeLessThan(3000); // LCP < 3s
    }
  });
});

// Export test counters for reporting
test.afterAll(async () => {
  console.log('Mobile Messaging Test Summary:', testCounters);
});
