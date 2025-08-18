import { test, expect } from '@playwright/test';

test.describe('Select Event Page Scroll Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth to avoid redirect
    await page.route('**/auth/check-user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, user: { id: 'test-user' } })
      });
    });

    // Mock events API with small dataset
    await page.route('**/api/events**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            event_id: '1',
            title: 'Test Wedding 1',
            event_date: '2024-06-01',
            location: 'Test Venue',
            user_role: 'host',
            rsvp_status: null
          },
          {
            event_id: '2', 
            title: 'Test Wedding 2',
            event_date: '2024-07-01',
            location: 'Another Venue',
            user_role: 'guest',
            rsvp_status: 'attending'
          }
        ])
      });
    });
  });

  test('should not scroll when content fits within viewport - small dataset', async ({ page }) => {
    await page.goto('/select-event');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="event-card"], h1:has-text("Welcome!")', { timeout: 10000 });
    
    // Check if page scrollable area equals client area (no scroll needed)
    const isScrollable = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return scrollingElement.scrollHeight > scrollingElement.clientHeight;
    });
    
    expect(isScrollable).toBe(false);
    
    // Verify no scrollbars visible
    const hasVerticalScrollbar = await page.evaluate(() => {
      return window.innerWidth > document.documentElement.clientWidth;
    });
    
    expect(hasVerticalScrollbar).toBe(false);
  });

  test('should scroll naturally when content exceeds viewport - large dataset', async ({ page }) => {
    // Mock larger dataset that should exceed viewport
    await page.route('**/api/events**', async route => {
      const events = [];
      for (let i = 1; i <= 10; i++) {
        events.push({
          event_id: i.toString(),
          title: `Test Wedding ${i}`,
          event_date: '2024-06-01',
          location: `Test Venue ${i}`,
          user_role: i % 2 === 0 ? 'host' : 'guest',
          rsvp_status: 'attending'
        });
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json', 
        body: JSON.stringify(events)
      });
    });

    await page.goto('/select-event');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="event-card"], h1:has-text("Welcome!")', { timeout: 10000 });
    
    // Check if content exceeds viewport (scrollable)
    const isScrollable = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return scrollingElement.scrollHeight > scrollingElement.clientHeight;
    });
    
    expect(isScrollable).toBe(true);
    
    // Test that scrolling works smoothly
    const initialScrollTop = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(100);
    
    const newScrollTop = await page.evaluate(() => window.scrollY);
    expect(newScrollTop).toBeGreaterThan(initialScrollTop);
  });

  test('should handle safe areas properly on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/select-event');
    await page.waitForSelector('h1:has-text("Welcome!")', { timeout: 10000 });
    
    // Check that safe area padding is applied correctly
    const safeAreaStyles = await page.evaluate(() => {
      const shell = document.querySelector('[class*="safe-"]');
      if (!shell) return null;
      
      const computedStyle = window.getComputedStyle(shell);
      return {
        paddingTop: computedStyle.paddingTop,
        paddingBottom: computedStyle.paddingBottom,
        paddingLeft: computedStyle.paddingLeft,
        paddingRight: computedStyle.paddingRight,
      };
    });
    
    expect(safeAreaStyles).toBeTruthy();
    
    // Verify viewport height usage
    const usesCorrectViewportHeight = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="min-h-mobile"], [class*="h-mobile"]');
      return elements.length > 0;
    });
    
    expect(usesCorrectViewportHeight).toBe(true);
  });

  test('should maintain scroll behavior after navigation', async ({ page }) => {
    await page.goto('/select-event');
    await page.waitForSelector('h1:has-text("Welcome!")', { timeout: 10000 });
    
    // Store initial scroll state
    const initialScrollable = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return scrollingElement.scrollHeight > scrollingElement.clientHeight;
    });
    
    // Navigate to profile and back
    await page.click('[aria-label="Profile settings"]');
    await page.waitForURL('**/profile');
    
    await page.goBack();
    await page.waitForSelector('h1:has-text("Welcome!")', { timeout: 10000 });
    
    // Verify scroll state is consistent
    const finalScrollable = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return scrollingElement.scrollHeight > scrollingElement.clientHeight;
    });
    
    expect(finalScrollable).toBe(initialScrollable);
  });
});
