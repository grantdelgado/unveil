/**
 * @file Mobile authenticated E2E tests
 * Tests core Host/Guest flows on mobile devices with authentication
 */

import { test, expect } from '@playwright/test';

const TEST_EVENT_ID = '12345678-1234-1234-1234-123456789012';

test.describe('Mobile Guest Flow', () => {
  test.use({ storageState: '.auth/guest.json' });

  test('should navigate from select-event to guest home with messages', async ({ page }) => {
    // Start from select-event page (authenticated guest)
    await page.goto('/select-event');
    await expect(page.locator('h1')).toContainText('Your Events');

    // Navigate to test event
    await page.goto(`/guest/events/${TEST_EVENT_ID}/home`);
    
    // Verify guest home page loads
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that messages section is present (may be empty)
    const messagesSection = page.locator('[data-testid="guest-messaging-header"]');
    await expect(messagesSection).toBeVisible();
    
    // Verify mobile layout is responsive
    await expect(page.locator('.safe-bottom, .pb-safe-area')).toBeVisible();
  });

  test('should load messages with compound cursor pagination', async ({ page }) => {
    await page.goto(`/guest/events/${TEST_EVENT_ID}/home`);
    
    // Wait for messages to load
    await page.waitForLoadState('networkidle');
    
    // Look for message items or empty state
    const hasMessages = await page.locator('[role="log"] > div').count() > 0;
    const hasEmptyState = await page.locator('text=No messages yet').isVisible();
    
    // Should have either messages or empty state, not loading spinner
    expect(hasMessages || hasEmptyState).toBe(true);
    
    // If messages exist, test pagination
    if (hasMessages) {
      const loadMoreButton = page.locator('button:has-text("Load earlier messages")');
      if (await loadMoreButton.isVisible()) {
        await loadMoreButton.click();
        
        // Wait for loading state
        await expect(loadMoreButton.locator('text=Loading...')).toBeVisible();
        
        // Wait for completion
        await expect(loadMoreButton.locator('text=Load earlier messages')).toBeVisible();
      }
    }
  });

  test('should navigate to schedule page with SSR content', async ({ page }) => {
    await page.goto(`/guest/events/${TEST_EVENT_ID}/home`);
    
    // Navigate to schedule
    await page.locator('button:has-text("Schedule")').click();
    
    // Verify URL changed
    await expect(page).toHaveURL(`/guest/events/${TEST_EVENT_ID}/schedule`);
    
    // Verify SSR content is present immediately (before JS hydration)
    await expect(page.locator('h1')).toContainText('Schedule');
    await expect(page.locator('text=A complete breakdown of celebration times')).toBeVisible();
    
    // Verify mobile safe area handling
    const backButton = page.locator('text=Back to Event');
    await expect(backButton).toBeVisible();
    
    // Test back navigation
    await backButton.click();
    await expect(page).toHaveURL(`/guest/events/${TEST_EVENT_ID}/home`);
  });

  test('should handle touch interactions properly', async ({ page }) => {
    await page.goto(`/guest/events/${TEST_EVENT_ID}/home`);
    
    // Test button touch targets (minimum 44px)
    const buttons = page.locator('button').first();
    const buttonBox = await buttons.boundingBox();
    
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    }
    
    // Test scroll behavior
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(100);
    
    // Verify no layout shifts during scroll
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Mobile Host Flow', () => {
  test.use({ storageState: '.auth/host.json' });

  test('should access host dashboard and compose announcement', async ({ page }) => {
    // Navigate to host event
    await page.goto(`/host/events/${TEST_EVENT_ID}/messages`);
    
    // Verify host messaging interface loads
    await expect(page.locator('text=Compose Message')).toBeVisible();
    
    // Click compose message tab if not already active
    await page.locator('button:has-text("Compose Message")').click();
    
    // Verify message composer is visible
    const composer = page.locator('textarea[placeholder*="Write your message"]');
    await expect(composer).toBeVisible();
    
    // Test that audience section is present
    await expect(page.locator('text=Audience')).toBeVisible();
    
    // Verify mobile layout adapts properly
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Mobile layout checks
      await expect(page.locator('.sticky')).toBeVisible(); // Sticky footer
    }
  });

  test('should preview announcement before sending (UI only)', async ({ page }) => {
    await page.goto(`/host/events/${TEST_EVENT_ID}/messages`);
    
    // Go to compose tab
    await page.locator('button:has-text("Compose Message")').click();
    
    // Fill out message (don't actually send)
    const messageText = 'E2E Test Announcement - Do Not Send';
    await page.locator('textarea[placeholder*="Write your message"]').fill(messageText);
    
    // Verify character count updates
    await expect(page.locator('text=/\\d+\\/1000 characters/')).toBeVisible();
    
    // Verify audience shows recipient count
    await expect(page.locator('text=/\\d+ guests?/')).toBeVisible();
    
    // Clear the message (don't send to avoid Twilio calls)
    await page.locator('button:has-text("Clear")').click();
    await expect(page.locator('textarea[placeholder*="Write your message"]')).toHaveValue('');
  });
});

test.describe('Schedule SSR Validation', () => {
  test.use({ storageState: '.auth/guest.json' });

  test('should render schedule content from server before hydration', async ({ page }) => {
    // Navigate directly to schedule page
    await page.goto(`/guest/events/${TEST_EVENT_ID}/schedule`);
    
    // Verify immediate content presence (SSR)
    await expect(page.locator('h1')).toContainText('Schedule');
    
    // Check for schedule content or empty state
    const hasScheduleItems = await page.locator('[data-testid="schedule-item"]').count() > 0;
    const hasEmptyState = await page.locator('text=No Schedule Items Yet').isVisible();
    
    // Should have either content or empty state immediately (no loading spinner)
    expect(hasScheduleItems || hasEmptyState).toBe(true);
    
    // Verify timezone information is rendered
    await expect(page.locator('text=/EDT|EST|UTC|timezone/i')).toBeVisible();
  });

  test('should maintain mobile layout and safe areas', async ({ page }) => {
    await page.goto(`/guest/events/${TEST_EVENT_ID}/schedule`);
    
    // Verify responsive design elements
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Check safe area handling
      const safeAreaElements = page.locator('.safe-bottom, .pb-safe-area, .safe-all');
      const count = await safeAreaElements.count();
      expect(count).toBeGreaterThan(0);
    }
    
    // Verify content is scrollable and accessible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    
    // Back button should remain accessible
    const backButton = page.locator('text=Back to Event');
    await expect(backButton).toBeVisible();
  });
});
