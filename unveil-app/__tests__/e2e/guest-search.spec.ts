/**
 * E2E tests for guest search functionality
 * Tests the complete user flow from typing to seeing results
 */

import { test, expect } from '@playwright/test';

test.describe('Guest Search E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to guest management
    // This would need to be adapted based on your auth setup
    await page.goto('/host/events/test-event-id/guests');
  });

  test('should search for guests without losing focus', async ({ page }) => {
    // Wait for the search input to be visible
    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    await expect(searchInput).toBeVisible();

    // Type "Will" character by character to test focus stability
    await searchInput.click();
    await searchInput.type('W', { delay: 100 });
    
    // Verify input still has focus
    await expect(searchInput).toBeFocused();
    
    await searchInput.type('i', { delay: 100 });
    await expect(searchInput).toBeFocused();
    
    await searchInput.type('l', { delay: 100 });
    await expect(searchInput).toBeFocused();
    
    await searchInput.type('l', { delay: 100 });
    await expect(searchInput).toBeFocused();

    // Verify the search term is in the input
    await expect(searchInput).toHaveValue('Will');

    // Wait for debounced search to complete (300ms + buffer)
    await page.waitForTimeout(500);

    // Check if search results are displayed or loading state is shown
    const searchResults = page.locator('[data-testid="guest-list-item"]');
    const loadingState = page.locator('text=Searching...');
    const noResults = page.locator('text=No matching guests');

    // One of these should be visible
    await expect(
      searchResults.first().or(loadingState).or(noResults)
    ).toBeVisible();
  });

  test('should show searching state during debounce', async ({ page }) => {
    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    await searchInput.click();
    
    // Type quickly to trigger searching state
    await searchInput.type('Will');
    
    // Should show searching state immediately
    await expect(page.locator('text=Searching...')).toBeVisible();
    
    // Wait for debounce to complete
    await page.waitForTimeout(500);
    
    // Searching state should be gone
    await expect(page.locator('text=Searching...')).not.toBeVisible();
  });

  test('should clear search results when input is cleared', async ({ page }) => {
    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    
    // Type search term
    await searchInput.fill('Will');
    await page.waitForTimeout(500);
    
    // Clear the search
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    // Should show all guests again (not "No matching guests")
    await expect(page.locator('text=No matching guests')).not.toBeVisible();
  });

  test('should handle rapid typing without excessive API calls', async ({ page }) => {
    // Monitor network requests
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('get_event_guests_with_display_names')) {
        apiCalls.push(request.url());
      }
    });

    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    
    // Type rapidly (5 keystrokes in quick succession)
    await searchInput.click();
    await searchInput.type('W');
    await searchInput.type('i');
    await searchInput.type('l');
    await searchInput.type('l');
    await searchInput.type(' Behenna');
    
    // Wait for debounce to complete
    await page.waitForTimeout(500);
    
    // Should have made only 1-2 API calls due to debouncing
    // (1 for initial load, 1 for final search term)
    expect(apiCalls.length).toBeLessThanOrEqual(2);
  });

  test('should maintain search results when scrolling (if pagination enabled)', async ({ page }) => {
    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    
    // Perform search
    await searchInput.fill('Behenna');
    await page.waitForTimeout(500);
    
    // If there are search results, scrolling should not clear them
    const searchResults = page.locator('[data-testid="guest-list-item"]');
    const initialCount = await searchResults.count();
    
    if (initialCount > 0) {
      // Scroll down
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
      
      // Search results should still be visible
      await expect(searchResults.first()).toBeVisible();
      
      // Search input should still have the search term
      await expect(searchInput).toHaveValue('Behenna');
    }
  });

  test('should work with keyboard navigation', async ({ page }) => {
    const searchInput = page.locator('input[type="search"][aria-label="Search guests"]');
    
    // Tab to search input
    await page.keyboard.press('Tab');
    // Continue tabbing until we reach the search input
    // (This would need to be adapted based on your page structure)
    
    // Type using keyboard
    await page.keyboard.type('Will');
    
    // Verify input has the value
    await expect(searchInput).toHaveValue('Will');
    
    // Press Escape to clear (if supported)
    await page.keyboard.press('Escape');
    
    // Wait for any clear action to complete
    await page.waitForTimeout(200);
  });
});
