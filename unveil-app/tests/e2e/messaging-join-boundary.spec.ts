import { test, expect } from '@playwright/test';

test.describe('Guest Message Join Boundary', () => {
  test('should show join boundary for guest who joined after messages were sent', async ({
    page,
  }) => {
    // This test assumes we have test data set up with:
    // 1. An event with messages sent before a guest joined
    // 2. A guest who joined after some messages were already sent

    // Navigate to guest message feed
    await page.goto('/guest/events/test-event-id/messages');

    // Wait for messages to load
    await expect(page.locator('[role="log"]')).toBeVisible();

    // Check that the join boundary is present
    const joinBoundary = page.locator('[role="separator"]');
    await expect(joinBoundary).toBeVisible();

    // Verify the boundary has the correct aria-label format
    await expect(joinBoundary).toHaveAttribute(
      'aria-label',
      /You joined this event on .+ Messages above were sent before you joined\./,
    );

    // Check that the boundary contains the expected text
    await expect(joinBoundary.locator('text=You joined on')).toBeVisible();

    // Verify that messages before the boundary have archival styling
    const messagesBeforeBoundary = page.locator('[role="log"] > div').first();
    await expect(messagesBeforeBoundary).toHaveClass(/opacity-80/);
    await expect(messagesBeforeBoundary).toHaveClass(/grayscale-\[0\.2\]/);

    // Verify that messages after the boundary don't have archival styling
    const messagesAfterBoundary = page.locator('[role="log"] > div').last();
    await expect(messagesAfterBoundary).not.toHaveClass(/opacity-80/);
    await expect(messagesAfterBoundary).not.toHaveClass(/grayscale-\[0\.2\]/);

    // Verify the boundary is accessible
    await expect(joinBoundary).toBeVisible();
    await expect(joinBoundary).toHaveAttribute('role', 'separator');
  });

  test('should not show join boundary if guest joined before any messages', async ({
    page,
  }) => {
    // This test assumes we have test data set up with:
    // 1. An event where the guest joined before any messages were sent

    await page.goto('/guest/events/test-event-early-joiner/messages');

    // Wait for messages to load
    await expect(page.locator('[role="log"]')).toBeVisible();

    // Check that no join boundary is present
    const joinBoundary = page.locator('[role="separator"]');
    await expect(joinBoundary).not.toBeVisible();

    // Verify all messages have normal styling (no archival treatment)
    const allMessages = page.locator('[role="log"] > div');
    const messageCount = await allMessages.count();

    for (let i = 0; i < messageCount; i++) {
      const message = allMessages.nth(i);
      await expect(message).not.toHaveClass(/opacity-80/);
      await expect(message).not.toHaveClass(/grayscale-\[0\.2\]/);
    }
  });

  test('should not show join boundary if guest joined after all messages', async ({
    page,
  }) => {
    // This test assumes we have test data set up with:
    // 1. An event where the guest joined after all existing messages were sent

    await page.goto('/guest/events/test-event-late-joiner/messages');

    // Wait for messages to load
    await expect(page.locator('[role="log"]')).toBeVisible();

    // Check that no join boundary is present (since all messages are pre-join)
    const joinBoundary = page.locator('[role="separator"]');
    await expect(joinBoundary).not.toBeVisible();

    // Verify all messages have archival styling
    const allMessages = page.locator('[role="log"] > div');
    const messageCount = await allMessages.count();

    for (let i = 0; i < messageCount; i++) {
      const message = allMessages.nth(i);
      await expect(message).toHaveClass(/opacity-80/);
      await expect(message).toHaveClass(/grayscale-\[0\.2\]/);
    }
  });

  test('boundary should be mobile-friendly and accessible', async ({
    page,
  }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/guest/events/test-event-id/messages');

    // Wait for messages to load
    await expect(page.locator('[role="log"]')).toBeVisible();

    const joinBoundary = page.locator('[role="separator"]');
    await expect(joinBoundary).toBeVisible();

    // Check that boundary doesn't overlap with header
    const header = page.locator('h2:has-text("Event Messages")').first();
    const headerBox = await header.boundingBox();
    const boundaryBox = await joinBoundary.boundingBox();

    if (headerBox && boundaryBox) {
      // Boundary should be below the header
      expect(boundaryBox.y).toBeGreaterThan(headerBox.y + headerBox.height);
    }

    // Verify touch target is adequate (at least 44px height)
    if (boundaryBox) {
      expect(boundaryBox.height).toBeGreaterThanOrEqual(44);
    }

    // Test keyboard accessibility
    await page.keyboard.press('Tab');
    // The boundary itself shouldn't be focusable, but should be announced by screen readers
    await expect(joinBoundary).toHaveAttribute('role', 'separator');
  });

  test('should handle timezone formatting correctly', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/messages');

    // Wait for messages to load
    await expect(page.locator('[role="log"]')).toBeVisible();

    const joinBoundary = page.locator('[role="separator"]');
    await expect(joinBoundary).toBeVisible();

    // Check that the date is formatted correctly (e.g., "Mon Jan 15, 2024")
    const dateText = await joinBoundary
      .locator('text=You joined on')
      .textContent();
    expect(dateText).toMatch(/You joined on \w{3} \w{3} \d{1,2}, \d{4}/);
  });
});
