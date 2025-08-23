import { test, expect } from '@playwright/test';

test.describe('Schedule Expiry Guard in Confirmation Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to message composer
    await page.goto('/host/events/test-event-id/messages');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="message-composer"]', { timeout: 10000 });
  });

  test('should disable CTA and show banner when schedule expires in modal', async ({ page }) => {
    // Set up a scheduled message that will expire soon
    await page.selectOption('[data-testid="message-type-selector"]', 'announcement');
    await page.fill('[data-testid="message-input"]', 'Test scheduled message');
    
    // Switch to schedule mode
    await page.click('[data-testid="schedule-mode-toggle"]');
    
    // Set a time that's close to the 3-minute buffer (will expire while modal is open)
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 3.5 * 60 * 1000); // 3.5 minutes from now
    
    const dateStr = scheduledTime.toISOString().split('T')[0];
    const timeStr = scheduledTime.toTimeString().slice(0, 5);
    
    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[type="time"]', timeStr);
    
    // Select some recipients
    await page.click('[data-testid="select-all-guests"]');
    
    // Open the confirmation modal
    await page.click('[data-testid="send-message-button"]');
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]');
    
    // Initially, the CTA should be enabled
    const scheduleButton = page.locator('button:has-text("Schedule Message")');
    await expect(scheduleButton).toBeEnabled();
    
    // No warning banner should be visible initially
    await expect(page.locator('[role="alert"]:has-text("Scheduled time has passed")')).not.toBeVisible();
    
    // Simulate time passing by injecting a script that advances the clock
    await page.addInitScript(() => {
      const originalDate = Date;
      let mockTime = originalDate.now();
      
      // Override Date.now() to simulate time passing
      (globalThis as any).Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockTime);
          } else {
            super(...args);
          }
        }
        
        static now() {
          return mockTime;
        }
      };
      
      // Function to advance mock time
      (globalThis as any).advanceMockTime = (ms: number) => {
        mockTime += ms;
        // Trigger any time-based updates
        window.dispatchEvent(new Event('focus'));
      };
    });
    
    // Advance time by 2 minutes (now only 1.5 minutes left, which is < 3 min buffer)
    await page.evaluate(() => {
      (globalThis as any).advanceMockTime(2 * 60 * 1000);
    });
    
    // Wait a moment for the hook to update
    await page.waitForTimeout(100);
    
    // Now the warning banner should appear
    await expect(page.locator('[role="alert"]:has-text("Scheduled time has passed")')).toBeVisible();
    
    // The CTA should be disabled
    await expect(scheduleButton).toBeDisabled();
    
    // The banner should show the current scheduled time
    await expect(page.locator('text=Event time:')).toBeVisible();
    await expect(page.locator('text=Your time:')).toBeVisible();
  });

  test('should allow quick-fix with "Use 5 minutes from now" button', async ({ page }) => {
    // Set up a scheduled message that's already expired
    await page.selectOption('[data-testid="message-type-selector"]', 'announcement');
    await page.fill('[data-testid="message-input"]', 'Test expired message');
    
    // Switch to schedule mode
    await page.click('[data-testid="schedule-mode-toggle"]');
    
    // Set a time that's already too soon (1 minute from now)
    const now = new Date();
    const expiredTime = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute from now
    
    const dateStr = expiredTime.toISOString().split('T')[0];
    const timeStr = expiredTime.toTimeString().slice(0, 5);
    
    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[type="time"]', timeStr);
    
    // Select some recipients
    await page.click('[data-testid="select-all-guests"]');
    
    // Open the confirmation modal
    await page.click('[data-testid="send-message-button"]');
    
    // Wait for modal and warning banner to appear
    await page.waitForSelector('[role="dialog"]');
    await page.waitForSelector('[role="alert"]:has-text("Scheduled time has passed")');
    
    // The CTA should be disabled
    const scheduleButton = page.locator('button:has-text("Schedule Message")');
    await expect(scheduleButton).toBeDisabled();
    
    // Click the "Use 5 minutes from now" button
    await page.click('button:has-text("Use 5 minutes from now")');
    
    // Wait for the modal to close and form to update
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    
    // Verify the date/time inputs were updated
    const updatedDate = await page.inputValue('input[type="date"]');
    const updatedTime = await page.inputValue('input[type="time"]');
    
    // The date should be today or tomorrow
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect([today, tomorrow]).toContain(updatedDate);
    
    // The time should be approximately 5 minutes from now
    const updatedDateTime = new Date(`${updatedDate}T${updatedTime}`);
    const expectedTime = new Date(Date.now() + 5 * 60 * 1000);
    const timeDiff = Math.abs(updatedDateTime.getTime() - expectedTime.getTime());
    expect(timeDiff).toBeLessThan(2 * 60 * 1000); // Within 2 minutes tolerance
  });

  test('should allow editing time with "Edit time" button', async ({ page }) => {
    // Set up a scheduled message that's expired
    await page.selectOption('[data-testid="message-type-selector"]', 'announcement');
    await page.fill('[data-testid="message-input"]', 'Test message for editing');
    
    // Switch to schedule mode
    await page.click('[data-testid="schedule-mode-toggle"]');
    
    // Set an expired time
    const now = new Date();
    const expiredTime = new Date(now.getTime() + 1 * 60 * 1000);
    
    const dateStr = expiredTime.toISOString().split('T')[0];
    const timeStr = expiredTime.toTimeString().slice(0, 5);
    
    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[type="time"]', timeStr);
    
    // Select recipients and open modal
    await page.click('[data-testid="select-all-guests"]');
    await page.click('[data-testid="send-message-button"]');
    
    // Wait for modal and warning banner
    await page.waitForSelector('[role="dialog"]');
    await page.waitForSelector('[role="alert"]:has-text("Scheduled time has passed")');
    
    // Click "Edit time" button
    await page.click('button:has-text("Edit time")');
    
    // Modal should close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    
    // The date input should be focused and scrolled into view
    await expect(page.locator('input[type="date"]')).toBeFocused();
  });

  test('should re-enable CTA when schedule becomes valid again', async ({ page }) => {
    // This test simulates the user updating the schedule to a valid time
    // after seeing the expiry warning
    
    await page.selectOption('[data-testid="message-type-selector"]', 'announcement');
    await page.fill('[data-testid="message-input"]', 'Test re-validation');
    
    await page.click('[data-testid="schedule-mode-toggle"]');
    
    // Set expired time initially
    const now = new Date();
    const expiredTime = new Date(now.getTime() + 1 * 60 * 1000);
    
    await page.fill('input[type="date"]', expiredTime.toISOString().split('T')[0]);
    await page.fill('input[type="time"]', expiredTime.toTimeString().slice(0, 5));
    
    await page.click('[data-testid="select-all-guests"]');
    await page.click('[data-testid="send-message-button"]');
    
    // Confirm warning appears and CTA is disabled
    await page.waitForSelector('[role="alert"]:has-text("Scheduled time has passed")');
    await expect(page.locator('button:has-text("Schedule Message")')).toBeDisabled();
    
    // Use the quick-fix to set a valid time
    await page.click('button:has-text("Use 5 minutes from now")');
    
    // Modal closes, now reopen it
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    await page.click('[data-testid="send-message-button"]');
    
    // Now the warning should be gone and CTA should be enabled
    await page.waitForSelector('[role="dialog"]');
    await expect(page.locator('[role="alert"]:has-text("Scheduled time has passed")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Schedule Message")')).toBeEnabled();
  });
});
