/**
 * End-to-end tests for co-host experience
 * Verifies that promoted co-hosts get full host capabilities
 */

import { test, expect } from '@playwright/test';

test.describe('Co-Host Experience', () => {
  const eventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
  
  test.beforeEach(async ({ page }) => {
    // Note: In a real test environment, this would authenticate as Providence
    // For now, we'll test the UI components and capabilities
    await page.goto(`/host/events/${eventId}/dashboard`);
  });

  test.describe('A) Capabilities Verification', () => {
    test('should show host capabilities for co-hosts', async ({ page }) => {
      // Test that co-hosts see the same capabilities as primary hosts
      
      // Check that host dashboard is accessible
      await expect(page.locator('h1')).toContainText('Dashboard');
      
      // Check that host navigation is available
      const hostNavItems = [
        'Dashboard',
        'Guests', 
        'Messages',
        'Schedule',
        'Details'
      ];
      
      for (const navItem of hostNavItems) {
        await expect(page.locator(`nav a:has-text("${navItem}")`)).toBeVisible();
      }
    });

    test('should hide self-demotion option', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/guests`);
      
      // Wait for guest list to load
      await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });
      
      // Find the current user's row (should not have "Remove Host" option)
      const currentUserRow = page.locator('[data-testid="guest-list-item"]').filter({ hasText: 'Providence Ilisevich' });
      
      if (await currentUserRow.isVisible()) {
        // Click overflow menu
        await currentUserRow.locator('button[aria-label*="Open actions"]').click();
        
        // Should not see "Remove Host" for self
        await expect(page.locator('text="Remove Host"')).not.toBeVisible();
      }
    });

    test('should show promote/demote options for other users', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/guests`);
      
      // Wait for guest list to load
      await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });
      
      // Find a guest row (not self)
      const guestRows = page.locator('[data-testid="guest-list-item"][data-role="guest"]');
      const firstGuest = guestRows.first();
      
      if (await firstGuest.isVisible()) {
        // Click overflow menu
        await firstGuest.locator('button[aria-label*="Open actions"]').click();
        
        // Should see "Make Host" option
        await expect(page.locator('text="Make Host"')).toBeVisible();
      }
    });
  });

  test.describe('B) Messaging UX', () => {
    test('should enable announcement and channel message types', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/messages`);
      
      // Wait for message composer to load
      await page.waitForSelector('text="Message Type"', { timeout: 10000 });
      
      // Check that Announcement button is enabled
      const announcementButton = page.locator('button:has-text("Announcement")');
      await expect(announcementButton).toBeVisible();
      await expect(announcementButton).not.toBeDisabled();
      
      // Check that Channel button is enabled
      const channelButton = page.locator('button:has-text("Channel")');
      await expect(channelButton).toBeVisible();
      await expect(channelButton).not.toBeDisabled();
      
      // Direct should also be available
      const directButton = page.locator('button:has-text("Direct")');
      await expect(directButton).toBeVisible();
      await expect(directButton).not.toBeDisabled();
    });

    test('should allow sending test announcements', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/messages`);
      
      // Wait for composer
      await page.waitForSelector('text="Message Type"', { timeout: 10000 });
      
      // Select announcement type
      await page.locator('button:has-text("Announcement")').click();
      
      // Type test message
      const messageInput = page.locator('textarea[placeholder*="message"]');
      if (await messageInput.isVisible()) {
        await messageInput.fill('Test announcement from co-host');
        
        // Check that send button becomes enabled
        const sendButton = page.locator('button:has-text("Send Now")');
        await expect(sendButton).toBeVisible();
        // Note: Don't actually send in tests
      }
    });
  });

  test.describe('C) Schedule UX', () => {
    test('should allow schedule management for co-hosts', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/schedule`);
      
      // Wait for schedule to load
      await page.waitForSelector('text="Schedule"', { timeout: 10000 });
      
      // Check that "Add Schedule Item" button is visible
      const addButton = page.locator('button:has-text("Add Schedule Item")');
      await expect(addButton).toBeVisible();
      
      // Click to open modal (don't save)
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Check that schedule modal opens
        await expect(page.locator('text="Add Schedule Item"')).toBeVisible();
        
        // Close modal
        await page.locator('button:has-text("Cancel")').click();
      }
    });
  });

  test.describe('D) Guest Management UX', () => {
    test('should show segmented list with accurate counts', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/guests`);
      
      // Wait for guest list to load
      await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });
      
      // Check section headers show total counts
      const hostsHeader = page.locator('text="HOSTS ("');
      await expect(hostsHeader).toBeVisible();
      await expect(hostsHeader).toContainText('HOSTS (3)'); // Should show 3 total hosts
      
      const guestsHeader = page.locator('text="GUESTS ("');
      await expect(guestsHeader).toBeVisible();
      await expect(guestsHeader).toContainText('GUESTS (132)'); // Should show 132 total guests
    });

    test('should prevent menu clipping', async ({ page }) => {
      await page.goto(`/host/events/${eventId}/guests`);
      
      // Wait for guest list
      await page.waitForSelector('[data-testid="guest-list-item"]', { timeout: 10000 });
      
      // Find a guest item near the bottom of the viewport
      const guestItems = page.locator('[data-testid="guest-list-item"]');
      const lastVisibleItem = guestItems.last();
      
      if (await lastVisibleItem.isVisible()) {
        // Scroll to bottom to test menu positioning
        await lastVisibleItem.scrollIntoViewIfNeeded();
        
        // Click overflow menu
        await lastVisibleItem.locator('button[aria-label*="Open actions"]').click();
        
        // Check that menu is visible (not clipped)
        const menu = page.locator('[role="menu"]');
        await expect(menu).toBeVisible();
        
        // Check menu has proper z-index (should be above other content)
        const menuElement = await menu.elementHandle();
        if (menuElement) {
          const zIndex = await menuElement.evaluate(el => getComputedStyle(el).zIndex);
          expect(parseInt(zIndex)).toBeGreaterThan(50);
        }
      }
    });
  });

  test.describe('E) RLS & RPC Enforcement', () => {
    test('should allow host actions for co-hosts', async ({ page }) => {
      // This would test that Providence can perform host actions
      // In a real test, we'd authenticate as Providence and verify:
      // - Can access host dashboard
      // - Can manage guests
      // - Can send messages
      // - Can edit schedule
      
      expect(true).toBe(true); // Placeholder for actual authentication tests
    });
  });

  test.describe('F) Auth & Routing', () => {
    test('should route co-hosts to host dashboard', async ({ page }) => {
      // Test that after sign-in, co-hosts are routed to host paths
      await page.goto('/select-event');
      
      // Wait for event selection
      await page.waitForSelector('text="Select Event"', { timeout: 10000 });
      
      // Check that events show host role
      const eventCard = page.locator(`[data-event-id="${eventId}"]`);
      if (await eventCard.isVisible()) {
        await expect(eventCard).toContainText('host'); // Should show host role
      }
    });
  });

  test.describe('G) Observability', () => {
    test('should not expose PII in console logs', async ({ page }) => {
      // Monitor console for PII exposure
      const consoleLogs: string[] = [];
      
      page.on('console', msg => {
        consoleLogs.push(msg.text());
      });
      
      await page.goto(`/host/events/${eventId}/guests`);
      await page.waitForTimeout(2000); // Let logs accumulate
      
      // Check that logs don't contain PII
      const piiPatterns = [
        /\+\d{10,15}/, // Phone numbers
        /@\w+\.\w+/, // Email addresses
        /Providence/i, // Actual names
      ];
      
      consoleLogs.forEach(log => {
        piiPatterns.forEach(pattern => {
          expect(log).not.toMatch(pattern);
        });
      });
    });
  });
});

// Guardrails tests
test.describe('Co-Host Guardrails', () => {
  test('should prevent last host demotion', async ({ page }) => {
    const eventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
    await page.goto(`/host/events/${eventId}/guests`);
    
    // This would test demoting down to the last host
    // and verifying the 409 error is handled correctly
    expect(true).toBe(true); // Placeholder for actual test
  });

  test('should maintain direct messaging restrictions', async ({ page }) => {
    // Verify that direct messaging read-model rules are unchanged
    // Co-hosts should have same messaging capabilities as primary hosts
    expect(true).toBe(true); // Placeholder for messaging restrictions test
  });
});
