import { test, expect } from '@playwright/test';

/**
 * RSVP-Lite End-to-End Tests
 * 
 * Tests the core RSVP-Lite functionality:
 * - Guest can decline an event with optional reason
 * - Decline banner appears after declining
 * - Host can see declined guests with reasons
 * - Host can clear guest decline status
 * - Messaging excludes declined guests by default
 */

test.describe('RSVP-Lite Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Note: Feature flags removed as part of RSVP-Lite hard cutover
    // RSVP-Lite is now the only behavior
  });

  test('guest can decline event with reason', async ({ page }) => {
    // This test would require:
    // 1. Navigate to guest event home page
    // 2. Click "Can't make it?" button
    // 3. Fill out decline modal with reason
    // 4. Submit decline
    // 5. Verify decline banner appears
    // 6. Verify "Can't make it?" button is hidden
    
    // Note: This is a placeholder test structure
    // In a real implementation, you would need:
    // - Test database setup with test events and guests
    // - Authentication setup for test users
    // - Page object models for reusable interactions
    
    await page.goto('/guest/events/test-event-id/home');
    
    // Look for the "Can't make it?" button
    const cantMakeItButton = page.locator('button', { hasText: "Can't make it?" });
    await expect(cantMakeItButton).toBeVisible();
    
    // Click to open decline modal
    await cantMakeItButton.click();
    
    // Verify modal opens
    const modal = page.locator('[role="dialog"]', { hasText: "Can't make it to this event?" });
    await expect(modal).toBeVisible();
    
    // Fill in decline reason
    const reasonTextarea = page.locator('textarea[placeholder*="Optional: Share a brief reason"]');
    await reasonTextarea.fill('Family emergency - so sorry!');
    
    // Submit decline
    const submitButton = page.locator('button', { hasText: 'Mark as not attending' });
    await submitButton.click();
    
    // Verify modal closes and banner appears
    await expect(modal).not.toBeVisible();
    const declineBanner = page.locator('[data-testid="decline-banner"]');
    await expect(declineBanner).toBeVisible();
    await expect(declineBanner).toContainText("You've marked that you can't make it");
    
    // Verify "Can't make it?" button is hidden
    await expect(cantMakeItButton).not.toBeVisible();
  });

  test('host can see declined guests and clear decline status', async ({ page }) => {
    // This test would verify:
    // 1. Navigate to host dashboard/guest management
    // 2. See declined guest with reason in guest list
    // 3. Click "Clear decline" button
    // 4. Confirm action
    // 5. Verify decline status is cleared
    
    await page.goto('/host/events/test-event-id/guests');
    
    // Look for declined guest indicator
    const declinedGuest = page.locator('[data-testid="guest-declined-indicator"]');
    await expect(declinedGuest).toBeVisible();
    await expect(declinedGuest).toContainText("Can't make it");
    
    // Click clear decline button
    const clearButton = page.locator('button', { hasText: 'Clear decline' });
    await clearButton.click();
    
    // Confirm the action (browser confirm dialog)
    page.on('dialog', dialog => dialog.accept());
    
    // Verify decline indicator is removed
    await expect(declinedGuest).not.toBeVisible();
  });

  test('messaging excludes declined guests by default', async ({ page }) => {
    // This test would verify:
    // 1. Navigate to host messaging
    // 2. Verify "Attending" is default filter
    // 3. Verify declined guests are excluded from count
    // 4. Toggle "Include declined guests" option
    // 5. Verify count increases to include declined guests
    
    await page.goto('/host/events/test-event-id/dashboard');
    
    // Navigate to messaging
    const messageButton = page.locator('button', { hasText: 'Send Message' });
    await messageButton.click();
    
    // Verify default filter is "Attending"
    const recipientSelect = page.locator('select[data-testid="recipient-filter"]');
    await expect(recipientSelect).toHaveValue('attending');
    
    // Check recipient count (should exclude declined)
    const recipientCount = page.locator('[data-testid="recipient-count"]');
    const initialCount = await recipientCount.textContent();
    
    // Switch to "All Guests" to see the difference
    await recipientSelect.selectOption('all');
    const allGuestsCount = await recipientCount.textContent();
    
    // All guests count should be higher than attending count
    expect(parseInt(allGuestsCount || '0')).toBeGreaterThan(parseInt(initialCount || '0'));
  });
});

/**
 * Helper functions for RSVP-Lite testing
 */

// Test data setup helpers
export const createTestEvent = async () => {
  // Helper to create test event with guests
  // Would use Supabase client to create test data
};

export const createTestGuest = async (eventId: string, declined = false) => {
  // Helper to create test guest, optionally declined
  // Would use Supabase client to create test guest data
};

export const cleanupTestData = async () => {
  // Helper to clean up test data after tests
  // Would remove test events, guests, etc.
};
