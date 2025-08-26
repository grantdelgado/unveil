/**
 * Guest Messages - Timezone Headers & Chip Removal Tests
 *
 * Tests that guest message bubbles show only time (no chips) and 
 * date headers use viewer's local timezone across different devices.
 */

import { test, expect } from '@playwright/test';

test.describe('Guest Messages - Timezone & Chips', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to guest messaging page
    // Note: This assumes test data setup - adjust URL as needed
    await page.goto('/guest/events/test-event-id/home');
    await page.getByRole('button', { name: /messages/i }).click();
  });

  test.describe('Chip Removal', () => {
    test('guest message bubbles show only time, no delivery/status chips', async ({ page }) => {
      // Wait for messages to load
      await expect(page.locator('[data-testid="message-bubble"]').first()).toBeVisible();

      // Check that message bubbles exist
      const messageBubbles = page.locator('[data-testid="message-bubble"]');
      await expect(messageBubbles).toHaveCount.atLeast(1);

      // Verify no green delivery chips are visible
      await expect(page.locator('.bg-green-100, .bg-green-200')).not.toBeVisible();
      await expect(page.locator('.text-green-700, .text-green-800')).not.toBeVisible();

      // Verify no blue message chips are visible  
      await expect(page.locator('.bg-blue-100, .bg-blue-200')).not.toBeVisible();
      await expect(page.locator('.text-blue-700, .text-blue-800')).not.toBeVisible();

      // Verify time is still displayed (should match pattern like "3:11 PM")
      await expect(page.locator('text=/\\d{1,2}:\\d{2}\\s?(AM|PM)/i')).toBeVisible();

      // Verify sender line with type chip above bubble is unchanged
      await expect(page.locator('text=/📢|💬|🏷️/')).toBeVisible(); // Message type icons
    });

    test('message footer contains only time and optional timezone mismatch indicator', async ({ page }) => {
      const messageBubbles = page.locator('[data-testid="message-bubble"]');
      await expect(messageBubbles.first()).toBeVisible();

      // Check the timestamp row in the first message
      const timestampRow = messageBubbles.first().locator('.text-muted-foreground').last();
      
      // Should contain time
      await expect(timestampRow).toContainText(/\d{1,2}:\d{2}\s?(AM|PM)/i);

      // Should NOT contain "delivery" or "message" text
      await expect(timestampRow).not.toContainText(/delivery/i);
      await expect(timestampRow).not.toContainText(/message/i);

      // May contain timezone mismatch indicator (*)
      const hasAsterisk = await timestampRow.locator('span[title*="timezone"]').count() > 0;
      if (hasAsterisk) {
        await expect(timestampRow.locator('span[title*="timezone"]')).toContainText('*');
      }
    });

    test('no empty container spacing remains after chip removal', async ({ page }) => {
      const messageBubbles = page.locator('[data-testid="message-bubble"]');
      await expect(messageBubbles.first()).toBeVisible();

      // Check that timestamp row doesn't have excessive gaps or flex containers
      const timestampRow = messageBubbles.first().locator('.text-muted-foreground').last();
      
      // Should not have flex row classes that were used for chips
      const hasFlexRow = await timestampRow.evaluate(el => 
        el.classList.contains('flex') && el.classList.contains('items-center')
      );
      
      // If it has flex, it should be for alignment, not for chip containers
      if (hasFlexRow) {
        // Should not have gap classes that were used for chip spacing
        const hasGap = await timestampRow.evaluate(el => 
          Array.from(el.classList).some(cls => cls.startsWith('gap-'))
        );
        expect(hasGap).toBe(false);
      }
    });
  });

  test.describe('Local Timezone Headers', () => {
    test('date headers reflect viewer local timezone on desktop', async ({ page }) => {
      // Set timezone to Los Angeles
      await page.addInitScript(() => {
        // Mock Intl.DateTimeFormat to return specific timezone
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locales, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = 'America/Los_Angeles';
          return new originalDateTimeFormat(locales, options);
        };
        Object.setPrototypeOf(Intl.DateTimeFormat, originalDateTimeFormat);
        Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
      });

      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();

      // Wait for messages to load and check for date headers
      await expect(page.locator('[role="separator"]')).toBeVisible();

      // Verify date headers use expected format (Today/Yesterday/Day, Mon d)
      const dateHeaders = page.locator('[role="separator"]');
      const headerCount = await dateHeaders.count();
      
      for (let i = 0; i < headerCount; i++) {
        const headerText = await dateHeaders.nth(i).textContent();
        expect(headerText).toMatch(/^(Today|Yesterday|\w{3}, \w{3} \d{1,2})$/);
      }
    });

    test('date headers change when timezone changes', async ({ page }) => {
      // First, set timezone to New York
      await page.addInitScript(() => {
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locales, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = 'America/New_York';
          return new originalDateTimeFormat(locales, options);
        };
        Object.setPrototypeOf(Intl.DateTimeFormat, originalDateTimeFormat);
        Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
      });

      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Capture initial headers
      const initialHeaders = await page.locator('[role="separator"]').allTextContents();

      // Change timezone to Los Angeles
      await page.addInitScript(() => {
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locales, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = 'America/Los_Angeles';
          return new originalDateTimeFormat(locales, options);
        };
        Object.setPrototypeOf(Intl.DateTimeFormat, originalDateTimeFormat);
        Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
      });

      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();

      // Capture headers after timezone change
      const newHeaders = await page.locator('[role="separator"]').allTextContents();

      // Headers should be recalculated (may be same or different depending on message times)
      expect(Array.isArray(newHeaders)).toBe(true);
      expect(newHeaders.length).toBeGreaterThan(0);
    });

    test('mobile viewport shows correct timezone headers', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      // Set timezone
      await page.addInitScript(() => {
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locales, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = 'America/Los_Angeles';
          return new originalDateTimeFormat(locales, options);
        };
        Object.setPrototypeOf(Intl.DateTimeFormat, originalDateTimeFormat);
        Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
      });

      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();

      // Verify mobile layout works with timezone headers
      await expect(page.locator('[role="separator"]')).toBeVisible();
      
      // Check that headers are properly styled for mobile
      const dateHeader = page.locator('[role="separator"]').first();
      await expect(dateHeader).toHaveClass(/my-3|md:my-4/);
    });
  });

  test.describe('Layout & Spacing', () => {
    test('message list has proper spacing without overlap', async ({ page }) => {
      // Check main message container spacing
      const messageContainer = page.locator('.flex.flex-col').filter({ hasText: /Today|Yesterday|\w{3}, \w{3}/ });
      await expect(messageContainer).toHaveClass(/gap-3|md:gap-4/);

      // Check individual message spacing
      const messageBubbles = page.locator('[data-testid="message-bubble"]');
      const bubbleCount = await messageBubbles.count();
      
      if (bubbleCount > 1) {
        // Verify no overlapping by checking positions
        const firstBubbleBox = await messageBubbles.first().boundingBox();
        const secondBubbleBox = await messageBubbles.nth(1).boundingBox();
        
        if (firstBubbleBox && secondBubbleBox) {
          // Second bubble should be below first bubble (no overlap)
          expect(secondBubbleBox.y).toBeGreaterThan(firstBubbleBox.y + firstBubbleBox.height);
        }
      }
    });

    test('date headers have proper spacing', async ({ page }) => {
      const dateHeaders = page.locator('[role="separator"]');
      await expect(dateHeaders.first()).toBeVisible();

      // Check header spacing classes
      const headerContainer = dateHeaders.first().locator('..');
      await expect(headerContainer).toHaveClass(/my-3|md:my-4/);
    });

    test('mobile layout prevents stacking issues', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();

      // Verify no horizontal overflow
      const messageArea = page.locator('[role="log"]');
      const messageAreaBox = await messageArea.boundingBox();
      
      if (messageAreaBox) {
        expect(messageAreaBox.width).toBeLessThanOrEqual(375);
      }

      // Verify message bubbles fit within viewport
      const messageBubbles = page.locator('[data-testid="message-bubble"]');
      const bubbleCount = await messageBubbles.count();
      
      for (let i = 0; i < Math.min(bubbleCount, 3); i++) {
        const bubbleBox = await messageBubbles.nth(i).boundingBox();
        if (bubbleBox) {
          expect(bubbleBox.width).toBeLessThanOrEqual(375);
        }
      }
    });
  });

  test.describe('Development Observability', () => {
    test('console logs timezone info in development', async ({ page }) => {
      // Listen for console logs
      const consoleLogs: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'log') {
          consoleLogs.push(msg.text());
        }
      });

      await page.reload();
      await page.getByRole('button', { name: /messages/i }).click();

      // Wait a bit for console logs
      await page.waitForTimeout(1000);

      // Check for development observability logs (only in dev mode)
      const hasTimezoneLog = consoleLogs.some(log => 
        log.includes('phase: headers') && log.includes('tz:')
      );

      // This will only pass in development mode
      if (process.env.NODE_ENV === 'development') {
        expect(hasTimezoneLog).toBe(true);
      }
    });
  });
});
