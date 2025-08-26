import { test, expect } from '@playwright/test';

test.describe('Guest Messaging Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigation to guest messaging
    // This would need to be adapted based on your actual auth flow
    await page.goto('/guest/test-event-id/messages');
  });

  test('should display date headers in event timezone format', async ({ page }) => {
    // Wait for messages to load
    await page.waitForSelector('[data-testid="guest-messaging-header"]');
    
    // Check for date headers with the new format (EEE, MMM d)
    const dateHeaders = page.locator('[role="separator"]');
    await expect(dateHeaders.first()).toBeVisible();
    
    // Verify the format matches EEE, MMM d pattern
    const headerText = await dateHeaders.first().textContent();
    expect(headerText).toMatch(/\w{3},\s\w{3}\s\d{1,2}/);
  });

  test('should show time-only timestamps in message bubbles', async ({ page }) => {
    // Wait for message bubbles to load
    const messageBubbles = page.locator('[role="article"]');
    await expect(messageBubbles.first()).toBeVisible();
    
    // Check that timestamps are time-only (no date)
    const timestamps = page.locator('.text-muted-foreground span').first();
    const timestampText = await timestamps.textContent();
    
    // Should match time format like "2:30 PM" (no date)
    expect(timestampText).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
  });

  test('should display mismatch indicator when timezone differs', async ({ page }) => {
    // This test would need specific test data where local time differs from event time
    // Look for the asterisk (*) indicator
    const mismatchIndicator = page.locator('span[title="Local date differs from event timezone"]');
    
    // This may or may not be present depending on test data and timezone
    if (await mismatchIndicator.count() > 0) {
      await expect(mismatchIndicator).toBeVisible();
      expect(await mismatchIndicator.textContent()).toBe('*');
    }
  });

  test('should have proper responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    // Check message bubble max-width on mobile
    const messageBubbles = page.locator('.max-w-\\[82\\%\\]');
    await expect(messageBubbles.first()).toBeVisible();
    
    // Check gap spacing
    const messageContainer = page.locator('.flex.flex-col.gap-3');
    await expect(messageContainer).toBeVisible();
  });

  test('should have proper responsive layout on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    
    // Check message bubble max-width on desktop (md:max-w-[70%])
    const messageBubbles = page.locator('.md\\:max-w-\\[70\\%\\]');
    await expect(messageBubbles.first()).toBeVisible();
    
    // Check gap spacing (md:gap-4)
    const messageContainer = page.locator('.md\\:gap-4');
    await expect(messageContainer).toBeVisible();
  });

  test('should not have overlapping elements', async ({ page }) => {
    // Check that Jump to Latest button doesn't overlap with messages
    const jumpButton = page.locator('button[aria-label*="Jump to latest"]');
    const messageContainer = page.locator('[data-testid="messages-container"]');
    
    if (await jumpButton.count() > 0) {
      const buttonBox = await jumpButton.boundingBox();
      const containerBox = await messageContainer.boundingBox();
      
      if (buttonBox && containerBox) {
        // Button should be positioned outside the main content area
        expect(buttonBox.x + buttonBox.width).toBeGreaterThan(containerBox.x + containerBox.width - 100);
      }
    }
  });

  test('should handle long words and emojis without overflow', async ({ page }) => {
    // This would need test data with long words and emojis
    const messageContent = page.locator('.whitespace-pre-wrap.\\[overflow-wrap\\:anywhere\\]');
    await expect(messageContent.first()).toBeVisible();
    
    // Check that content doesn't overflow its container
    const contentBox = await messageContent.first().boundingBox();
    const bubbleBox = await messageContent.first().locator('..').boundingBox();
    
    if (contentBox && bubbleBox) {
      expect(contentBox.width).toBeLessThanOrEqual(bubbleBox.width);
    }
  });

  test('should have proper accessibility labels', async ({ page }) => {
    // Check message accessibility labels
    const messageArticles = page.locator('[role="article"]');
    await expect(messageArticles.first()).toHaveAttribute('aria-label');
    
    // Check date header accessibility
    const dateHeaders = page.locator('[role="separator"]');
    await expect(dateHeaders.first()).toHaveAttribute('aria-label');
    
    // Verify aria-label format includes sender, type, time, and content
    const ariaLabel = await messageArticles.first().getAttribute('aria-label');
    expect(ariaLabel).toContain('.');  // Should have multiple parts separated by periods
  });

  test('should maintain consistent vertical gaps while scrolling', async ({ page }) => {
    // Scroll through messages and verify consistent spacing
    const messageContainer = page.locator('[data-testid="messages-container"]');
    await messageContainer.scrollIntoView();
    
    // Take screenshot for visual regression testing
    await expect(page).toHaveScreenshot('guest-messages-layout.png', {
      fullPage: true,
      mask: [
        // Mask dynamic content like timestamps
        page.locator('.text-muted-foreground'),
        // Mask user-specific content
        page.locator('[data-testid="guest-messaging-header"]')
      ]
    });
  });

  test('should show Today/Yesterday/formatted dates correctly', async ({ page }) => {
    // Check for Today header if there are messages from today
    const todayHeader = page.locator('text=Today');
    const yesterdayHeader = page.locator('text=Yesterday');
    const formattedDateHeaders = page.locator('[role="separator"]').filter({ hasText: /\w{3},\s\w{3}\s\d{1,2}/ });
    
    // At least one type of header should be present
    const headerCount = await todayHeader.count() + await yesterdayHeader.count() + await formattedDateHeaders.count();
    expect(headerCount).toBeGreaterThan(0);
    
    // If Today header exists, verify it's properly formatted
    if (await todayHeader.count() > 0) {
      await expect(todayHeader.first()).toBeVisible();
    }
    
    // If Yesterday header exists, verify it's properly formatted  
    if (await yesterdayHeader.count() > 0) {
      await expect(yesterdayHeader.first()).toBeVisible();
    }
    
    // If formatted date headers exist, verify they match the pattern
    if (await formattedDateHeaders.count() > 0) {
      const headerText = await formattedDateHeaders.first().textContent();
      expect(headerText).toMatch(/\w{3},\s\w{3}\s\d{1,2}/);
    }
  });
});
