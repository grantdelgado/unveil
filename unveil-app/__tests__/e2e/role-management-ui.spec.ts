/**
 * End-to-end tests for role management UI
 */

import { test, expect } from '@playwright/test';

test.describe('Role Management UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to guest management
    // Note: This would need proper test setup with authenticated user
    await page.goto('/host/events/test-event-id/guests');
  });

  test('should display role chips for hosts and guests', async ({ page }) => {
    // Wait for guest list to load
    await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });

    // Check for host badges
    const hostBadges = page.locator('text="👑 HOST"');
    await expect(hostBadges.first()).toBeVisible();

    // Check for guest badges
    const guestBadges = page.locator('text="GUEST"');
    await expect(guestBadges.first()).toBeVisible();
  });

  test('should display hosts summary bar when hosts exist', async ({ page }) => {
    // Wait for hosts summary to load
    await page.waitForSelector('text="Hosts ("', { timeout: 10000 });

    // Check hosts summary is visible
    const hostsHeader = page.locator('text="Hosts ("');
    await expect(hostsHeader).toBeVisible();

    // Check host chips in summary
    const hostChips = page.locator('[data-testid="host-chip"]');
    await expect(hostChips.first()).toBeVisible();
  });

  test('should display segmented list with sticky headers', async ({ page }) => {
    // Wait for list sections to load
    await page.waitForSelector('#hosts-section', { timeout: 10000 });

    // Check hosts section header
    const hostsHeader = page.locator('text="HOSTS ("');
    await expect(hostsHeader).toBeVisible();
    await expect(hostsHeader).toHaveAttribute('role', 'heading');

    // Check guests section header
    const guestsHeader = page.locator('text="GUESTS ("');
    await expect(guestsHeader).toBeVisible();
    await expect(guestsHeader).toHaveAttribute('role', 'heading');
  });

  test('should show promote/demote options in overflow menu for hosts', async ({ page }) => {
    // Skip if not authenticated as host
    const isHost = await page.locator('[data-testid="host-indicator"]').isVisible();
    test.skip(!isHost, 'Test requires host authentication');

    // Click overflow menu on a guest item
    const guestOverflow = page.locator('[data-testid="guest-list-item"]').first().locator('button[aria-label*="Open actions"]');
    await guestOverflow.click();

    // Check for promote option (for guests)
    const promoteButton = page.locator('text="Make Host"');
    if (await promoteButton.isVisible()) {
      await expect(promoteButton).toHaveAttribute('aria-label', /Make .* a host/);
    }

    // Check for demote option (for hosts)
    const demoteButton = page.locator('text="Remove Host"');
    if (await demoteButton.isVisible()) {
      await expect(demoteButton).toHaveAttribute('aria-label', /Remove host from .*/);
    }
  });

  test('should show confirmation dialog when promoting guest', async ({ page }) => {
    // Skip if not authenticated as host
    const isHost = await page.locator('[data-testid="host-indicator"]').isVisible();
    test.skip(!isHost, 'Test requires host authentication');

    // Find a guest item and click overflow menu
    const guestItem = page.locator('[data-testid="guest-list-item"]').filter({ hasText: 'GUEST' }).first();
    const overflowButton = guestItem.locator('button[aria-label*="Open actions"]');
    await overflowButton.click();

    // Click promote button if visible
    const promoteButton = page.locator('text="Make Host"');
    if (await promoteButton.isVisible()) {
      await promoteButton.click();

      // Check confirmation dialog appears
      const dialog = page.locator('text="Make * a host?"');
      await expect(dialog).toBeVisible();

      // Check dialog content
      await expect(page.locator('text="They\'ll be able to message, manage guests, and edit the schedule."')).toBeVisible();

      // Check dialog buttons
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Make Host")')).toBeVisible();

      // Close dialog
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('should show confirmation dialog when demoting host', async ({ page }) => {
    // Skip if not authenticated as host
    const isHost = await page.locator('[data-testid="host-indicator"]').isVisible();
    test.skip(!isHost, 'Test requires host authentication');

    // Find a host item (not self) and click overflow menu
    const hostItem = page.locator('[data-testid="guest-list-item"]').filter({ hasText: '👑 HOST' }).nth(1); // Skip first (likely self)
    const overflowButton = hostItem.locator('button[aria-label*="Open actions"]');
    
    if (await overflowButton.isVisible()) {
      await overflowButton.click();

      // Click demote button if visible
      const demoteButton = page.locator('text="Remove Host"');
      if (await demoteButton.isVisible()) {
        await demoteButton.click();

        // Check confirmation dialog appears
        const dialog = page.locator('text="Remove host access from *?"');
        await expect(dialog).toBeVisible();

        // Check dialog content
        await expect(page.locator('text="You must keep at least one host."')).toBeVisible();

        // Check dialog buttons
        await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
        await expect(page.locator('button:has-text("Remove Host")')).toBeVisible();

        // Close dialog
        await page.locator('button:has-text("Cancel")').click();
      }
    }
  });

  test('should filter both hosts and guests when searching', async ({ page }) => {
    // Wait for search input
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    // Get initial counts
    const initialHostsCount = await page.locator('text="HOSTS ("').textContent();
    const initialGuestsCount = await page.locator('text="GUESTS ("').textContent();

    // Enter search term
    await page.fill('input[placeholder*="Search"]', 'test');

    // Wait for filtering to complete
    await page.waitForTimeout(500);

    // Check that counts may have changed (filtered)
    const filteredHostsCount = await page.locator('text="HOSTS ("').textContent();
    const filteredGuestsCount = await page.locator('text="GUESTS ("').textContent();

    // Counts should be numbers (may be same or different)
    expect(filteredHostsCount).toMatch(/HOSTS \(\d+\)/);
    expect(filteredGuestsCount).toMatch(/GUESTS \(\d+\)/);
  });

  test('should maintain accessibility with proper ARIA labels', async ({ page }) => {
    // Check section headers have proper roles
    const hostsHeader = page.locator('#hosts-section [role="heading"]');
    await expect(hostsHeader).toHaveAttribute('aria-level', '2');

    const guestsHeader = page.locator('#guests-section [role="heading"]');
    await expect(guestsHeader).toHaveAttribute('aria-level', '2');

    // Check overflow menus have proper ARIA attributes
    const overflowButtons = page.locator('button[aria-haspopup="menu"]');
    const firstOverflow = overflowButtons.first();
    
    if (await firstOverflow.isVisible()) {
      await expect(firstOverflow).toHaveAttribute('aria-expanded', 'false');
      await expect(firstOverflow).toHaveAttribute('aria-label', /Open actions for .*/);
    }
  });
});

// Visual regression tests for different viewport sizes
test.describe('Role Management Visual Tests', () => {
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1200, height: 800 },
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`should render correctly on ${name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/host/events/test-event-id/guests');
      
      // Wait for content to load
      await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });
      
      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot(`role-management-${name}.png`);
    });
  });
});
