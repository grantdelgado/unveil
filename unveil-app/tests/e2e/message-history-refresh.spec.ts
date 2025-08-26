import { test, expect } from '@playwright/test';
import { createTestEvent, createTestUser, cleanupTestData } from '../helpers/test-setup';

test.describe('Message History - Instant Refresh', () => {
  let eventId: string;
  let userId: string;

  test.beforeEach(async ({ page }) => {
    // Create test user and event
    const user = await createTestUser();
    userId = user.id;
    
    const event = await createTestEvent(userId);
    eventId = event.id;

    // Login and navigate to event
    await page.goto('/login');
    // ... login flow
    await page.goto(`/host/${eventId}/messages`);
  });

  test.afterEach(async () => {
    await cleanupTestData(eventId, userId);
  });

  test('newly scheduled message appears immediately without reload', async ({ page }) => {
    // Navigate to compose tab
    await page.click('[data-testid="compose-tab"]');
    
    // Fill in message
    await page.fill('[data-testid="message-content"]', 'Test scheduled message');
    
    // Set to schedule mode
    await page.click('[data-testid="schedule-mode"]');
    
    // Set future time (30 minutes from now)
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    await page.fill('[data-testid="schedule-date"]', futureTime.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', futureTime.toTimeString().slice(0, 5));
    
    // Send the message
    await page.click('[data-testid="send-button"]');
    
    // Wait for success modal and close it
    await expect(page.locator('[data-testid="send-success-modal"]')).toBeVisible();
    await page.click('[data-testid="close-success-modal"]');
    
    // Navigate to history tab
    await page.click('[data-testid="history-tab"]');
    
    // Assert message appears within 3 seconds without manual reload
    await expect(page.locator('[data-testid="scheduled-message"]').filter({ hasText: 'Test scheduled message' }))
      .toBeVisible({ timeout: 3000 });
    
    // Verify no "0" is displayed for recipient count
    const messageCard = page.locator('[data-testid="scheduled-message"]').filter({ hasText: 'Test scheduled message' });
    await expect(messageCard.locator('text=Recipients: 0')).not.toBeVisible();
    await expect(messageCard.locator('text=Recipients: TBD')).toBeVisible();
  });

  test('modified scheduled message updates via realtime', async ({ page }) => {
    // First create a scheduled message
    await page.click('[data-testid="compose-tab"]');
    await page.fill('[data-testid="message-content"]', 'Original message');
    await page.click('[data-testid="schedule-mode"]');
    
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    await page.fill('[data-testid="schedule-date"]', futureTime.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', futureTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="send-button"]');
    await page.click('[data-testid="close-success-modal"]');
    
    // Go to history and find the message
    await page.click('[data-testid="history-tab"]');
    await expect(page.locator('text=Original message')).toBeVisible();
    
    // Click modify button
    await page.click('[data-testid="modify-message-button"]');
    
    // Update the message
    await page.fill('[data-testid="message-content"]', 'Updated message');
    await page.click('[data-testid="update-button"]');
    
    // Verify the update appears immediately in history
    await expect(page.locator('text=Updated message')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Original message')).not.toBeVisible();
  });

  test('cancelled scheduled message disappears immediately', async ({ page }) => {
    // Create scheduled message
    await page.click('[data-testid="compose-tab"]');
    await page.fill('[data-testid="message-content"]', 'Message to cancel');
    await page.click('[data-testid="schedule-mode"]');
    
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    await page.fill('[data-testid="schedule-date"]', futureTime.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', futureTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="send-button"]');
    await page.click('[data-testid="close-success-modal"]');
    
    // Go to history
    await page.click('[data-testid="history-tab"]');
    await expect(page.locator('text=Message to cancel')).toBeVisible();
    
    // Cancel the message
    await page.click('[data-testid="cancel-message-button"]');
    await page.click('[data-testid="confirm-cancel-button"]');
    
    // Verify message disappears immediately
    await expect(page.locator('text=Message to cancel')).not.toBeVisible({ timeout: 3000 });
  });

  test('no "0" metrics displayed on scheduled cards', async ({ page }) => {
    // Create scheduled message
    await page.click('[data-testid="compose-tab"]');
    await page.fill('[data-testid="message-content"]', 'Check metrics display');
    await page.click('[data-testid="schedule-mode"]');
    
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    await page.fill('[data-testid="schedule-date"]', futureTime.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', futureTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="send-button"]');
    await page.click('[data-testid="close-success-modal"]');
    
    // Go to history
    await page.click('[data-testid="history-tab"]');
    
    const messageCard = page.locator('[data-testid="scheduled-message"]').filter({ hasText: 'Check metrics display' });
    
    // Verify no "0" metrics are shown
    await expect(messageCard.locator('text=0 delivered')).not.toBeVisible();
    await expect(messageCard.locator('text=Recipients: 0')).not.toBeVisible();
    
    // Verify appropriate placeholder text is shown
    await expect(messageCard.locator('text=Recipients: TBD')).toBeVisible();
  });

  test('timezone toggle still works correctly', async ({ page }) => {
    // Create scheduled message
    await page.click('[data-testid="compose-tab"]');
    await page.fill('[data-testid="message-content"]', 'Timezone test message');
    await page.click('[data-testid="schedule-mode"]');
    
    const futureTime = new Date(Date.now() + 30 * 60 * 1000);
    await page.fill('[data-testid="schedule-date"]', futureTime.toISOString().split('T')[0]);
    await page.fill('[data-testid="schedule-time"]', futureTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="send-button"]');
    await page.click('[data-testid="close-success-modal"]');
    
    // Go to history
    await page.click('[data-testid="history-tab"]');
    
    // Verify timezone toggle is present and functional
    const timezoneToggle = page.locator('[data-testid="timezone-toggle"]');
    await expect(timezoneToggle).toBeVisible();
    
    // Click toggle and verify time display changes
    const initialTimeText = await page.locator('[data-testid="scheduled-time"]').textContent();
    await timezoneToggle.click();
    
    // Wait for time display to update
    await page.waitForTimeout(500);
    const updatedTimeText = await page.locator('[data-testid="scheduled-time"]').textContent();
    
    // Times should be different (different timezone display)
    expect(initialTimeText).not.toBe(updatedTimeText);
  });
});
