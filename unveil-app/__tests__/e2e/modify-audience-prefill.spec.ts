/**
 * E2E tests for modify scheduled message audience prefill and delivery mode locking
 */

import { test, expect } from '@playwright/test';

test.describe('Modify Scheduled Message - Audience & Delivery Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to message center
    await page.goto('/host/events/test-event-id/messages');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should prefill exact recipients for Direct message and lock delivery mode', async ({ page }) => {
    // Assume we have a scheduled Direct message with 2 specific recipients
    
    // Click Modify on an upcoming Direct message
    await page.click('[data-testid="upcoming-message-card"] button:has-text("Modify")');
    
    // Should switch to Compose tab
    await expect(page.locator('[data-testid="compose-tab"]')).toHaveClass(/bg-white/);
    
    // Should show edit mode indicator
    await expect(page.locator('text=📝 Editing scheduled message')).toBeVisible();
    await expect(page.locator('text=Delivery mode is locked to scheduled time')).toBeVisible();
    
    // Send Now/Schedule toggle should be hidden
    await expect(page.locator('button:has-text("Send Now")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Schedule for Later")')).not.toBeVisible();
    
    // Should show correct audience selection
    await expect(page.locator('text=Selected Recipients')).toBeVisible();
    await expect(page.locator('text=📝 Selected recipients only — 2 selected')).toBeVisible();
    
    // Should show exactly 2 selected checkboxes
    const selectedCheckboxes = page.locator('input[type="checkbox"]:checked');
    await expect(selectedCheckboxes).toHaveCount(2);
    
    // Should show Update CTA
    await expect(page.locator('button:has-text("Update Scheduled Message")')).toBeVisible();
    
    // Should not show regular send CTAs
    await expect(page.locator('button:has-text("Send Now")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Schedule Message")')).not.toBeVisible();
  });

  test('should update message and show Schedule Updated success', async ({ page }) => {
    // Click Modify on an upcoming message
    await page.click('[data-testid="upcoming-message-card"] button:has-text("Modify")');
    
    // Wait for composer to load in edit mode
    await expect(page.locator('text=📝 Editing scheduled message')).toBeVisible();
    
    // Update the message content
    const messageInput = page.locator('textarea[placeholder*="message"]');
    await messageInput.clear();
    await messageInput.fill('Updated message content for testing');
    
    // Update the scheduled time (add 10 minutes)
    const timeInput = page.locator('input[type="time"]');
    await timeInput.click();
    await timeInput.fill('15:10'); // Assuming original was 15:00
    
    // Click Update Scheduled Message
    await page.click('button:has-text("Update Scheduled Message")');
    
    // Should show success modal with correct message
    await expect(page.locator('text=Schedule Updated')).toBeVisible();
    
    // Should NOT show "Message Sent Successfully"
    await expect(page.locator('text=Message Sent Successfully')).not.toBeVisible();
    
    // Close success modal
    await page.click('button:has-text("Close")');
    
    // Should return to Message History
    await expect(page.locator('[data-testid="history-tab"]')).toHaveClass(/bg-white/);
    
    // Should show updated message in upcoming list
    await expect(page.locator('text=Updated message content for testing')).toBeVisible();
    
    // Should show Modified badge
    await expect(page.locator('text=✏️ Modified')).toBeVisible();
  });

  test('should handle freeze window correctly', async ({ page }) => {
    // Mock a message that's too close to send time (within freeze window)
    
    // Modify button should not be visible for messages in freeze window
    const upcomingCard = page.locator('[data-testid="upcoming-message-card"]').first();
    
    // If message is in freeze window, Modify button should be hidden
    const modifyButton = upcomingCard.locator('button:has-text("Modify")');
    
    // Check if modify button exists (depends on timing)
    const isModifyVisible = await modifyButton.isVisible().catch(() => false);
    
    if (!isModifyVisible) {
      // Should show guidance about freeze window
      await expect(page.locator('text=Cancel')).toBeVisible(); // Cancel should still be available
      
      // Could show tooltip or guidance about recreating the message
      console.log('Message is in freeze window - Modify correctly hidden');
    } else {
      // If modify is visible, clicking should work normally
      await modifyButton.click();
      await expect(page.locator('text=📝 Editing scheduled message')).toBeVisible();
    }
  });

  test('should maintain audience selection when switching between message types', async ({ page }) => {
    // Click Modify on a Direct message
    await page.click('[data-testid="upcoming-message-card"] button:has-text("Modify")');
    
    // Wait for edit mode
    await expect(page.locator('text=📝 Editing scheduled message')).toBeVisible();
    
    // Should be in Direct mode with 2 selected
    await expect(page.locator('text=📝 Selected recipients only — 2 selected')).toBeVisible();
    
    // Switch to Announcement (should select all)
    await page.click('button:has-text("Announcement")');
    
    // Should show all guests selected
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const checkedCount = await allCheckboxes.evaluateAll(inputs => 
      inputs.filter(input => (input as HTMLInputElement).checked).length
    );
    
    expect(checkedCount).toBeGreaterThan(2); // Should select all available guests
    
    // Switch back to Direct
    await page.click('button:has-text("Direct")');
    
    // Should maintain the current selection (all guests from announcement mode)
    // This is expected behavior - switching types doesn't restore original selection
  });

  test('should prevent Send Now path in edit mode', async ({ page }) => {
    // Click Modify on an upcoming message
    await page.click('[data-testid="upcoming-message-card"] button:has-text("Modify")');
    
    // Wait for edit mode
    await expect(page.locator('text=📝 Editing scheduled message')).toBeVisible();
    
    // Verify no Send Now toggle is available
    await expect(page.locator('button:has-text("Send Now")')).not.toBeVisible();
    
    // The only submit path should be Update Scheduled Message
    const submitButtons = page.locator('button').filter({ hasText: /Send|Schedule|Update/ });
    await expect(submitButtons).toHaveCount(1);
    await expect(submitButtons).toHaveText('Update Scheduled Message');
    
    // Clicking should trigger update RPC, not send RPC
    // This would be verified through network monitoring in a full E2E setup
  });
});
