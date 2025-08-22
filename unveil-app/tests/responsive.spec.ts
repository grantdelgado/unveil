import { test, expect, Page } from '@playwright/test';

// Viewport configurations for comprehensive mobile testing
const viewports = [
  // Small phones
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Narrow Small', width: 320, height: 568 },
  { name: 'Tall Small', width: 360, height: 800 },

  // Modern iPhones
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },

  // Android devices
  { name: 'Pixel 5', width: 393, height: 851 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Galaxy S20', width: 412, height: 915 },
];

// Core routes to test for mobile responsiveness
const coreRoutes = [
  { path: '/login', name: 'Login/OTP' },
  { path: '/select-event', name: 'Event Selection' },
  // Note: Event-specific routes would need test data setup
  // { path: '/guest/events/[eventId]/home', name: 'Guest Event Home' },
  // { path: '/host/events/[eventId]/messages', name: 'Host Messaging' },
];

// Helper function to check for horizontal overflow
async function checkForOverflow(page: Page): Promise<boolean> {
  const hasOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  return hasOverflow;
}

// Helper function to check if critical elements are visible
async function checkCriticalElements(page: Page, route: string): Promise<void> {
  switch (route) {
    case '/login':
      // Check for OTP input and submit button
      await expect(page.getByRole('textbox')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /continue|submit|send/i }),
      ).toBeVisible();
      break;

    case '/select-event':
      // Check for welcome message and profile button
      await expect(page.getByText('Welcome!')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /profile/i }),
      ).toBeVisible();
      break;
  }
}

// Main responsive test suite
for (const viewport of viewports) {
  test.describe(`Responsive Design - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.beforeEach(async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      // Set user agent to mobile for iOS/Android specific behaviors
      const isMobile = viewport.width <= 430;
      if (isMobile) {
        const isIOS = viewport.name.includes('iPhone');
        const userAgent = isIOS
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';

        await page.setExtraHTTPHeaders({
          'User-Agent': userAgent,
        });
      }
    });

    for (const route of coreRoutes) {
      test(`${route.name} - Layout & Overflow Check`, async ({ page }) => {
        // Navigate to route
        await page.goto(route.path);

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Check for horizontal overflow
        const hasOverflow = await checkForOverflow(page);
        expect(hasOverflow).toBeFalsy(
          `Page has horizontal overflow on ${viewport.name}`,
        );

        // Check critical elements are visible
        await checkCriticalElements(page, route.path);

        // Take screenshot for visual regression
        await expect(page).toHaveScreenshot(
          `${route.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        );
      });

      test(`${route.name} - Touch Target Accessibility`, async ({ page }) => {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // Find all interactive elements
        const interactiveElements = await page
          .locator('button, [role="button"], a, input')
          .all();

        for (const element of interactiveElements) {
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            // Check minimum touch target size (44x44px for iOS, 48x48px for Android)
            const minSize = viewport.name.includes('iPhone') ? 44 : 48;
            expect(boundingBox.width).toBeGreaterThanOrEqual(minSize - 4); // 4px tolerance
            expect(boundingBox.height).toBeGreaterThanOrEqual(minSize - 4);
          }
        }
      });
    }

    test('Safe Area & Viewport Height Handling', async ({ page }) => {
      // Test with simulated safe area insets (for notched devices)
      await page.addStyleTag({
        content: `
          :root {
            --sat: 44px !important;
            --sab: 34px !important;
            --sal: 0px !important;
            --sar: 0px !important;
          }
        `,
      });

      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Check that content is not clipped by safe areas
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = viewport.height;

      // Content should fit within viewport considering safe areas
      expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 100); // 100px tolerance

      // Take screenshot with safe area simulation
      await expect(page).toHaveScreenshot(
        `safe-area-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`,
      );
    });
  });
}

// Dark mode and accessibility tests
test.describe('Dark Mode & Accessibility', () => {
  const testViewport = { width: 390, height: 844 }; // iPhone 12/13/14

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(testViewport);
  });

  test('Dark Mode Support', async ({ page }) => {
    // Set dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Take dark mode screenshot
    await expect(page).toHaveScreenshot('login-dark-mode.png');
  });

  test('Large Text Support (150% font scale)', async ({ page }) => {
    // Simulate large text preference
    await page.addStyleTag({
      content: `
        html {
          font-size: 150% !important;
        }
      `,
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check that content doesn't overflow with larger text
    const hasOverflow = await checkForOverflow(page);
    expect(hasOverflow).toBeFalsy(
      'Page has horizontal overflow with large text',
    );

    await expect(page).toHaveScreenshot('login-large-text.png');
  });

  test('Reduced Motion Support', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/select-event');
    await page.waitForLoadState('networkidle');

    // Verify animations are disabled
    const animationDuration = await page.evaluate(() => {
      const element = document.querySelector('[class*="animate-"]');
      if (element) {
        return getComputedStyle(element).animationDuration;
      }
      return null;
    });

    // Should be very short or none due to prefers-reduced-motion
    if (animationDuration) {
      expect(parseFloat(animationDuration)).toBeLessThan(0.1);
    }
  });
});

// Keyboard navigation and focus tests
test.describe('Keyboard Navigation', () => {
  const testViewport = { width: 390, height: 844 };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(testViewport);
  });

  test('Tab Navigation Flow', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Test tab navigation through interactive elements
    const interactiveElements = await page
      .locator('button, [role="button"], a, input')
      .all();

    for (let i = 0; i < Math.min(interactiveElements.length, 5); i++) {
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = await page.locator(':focus').first();
      await expect(focusedElement).toBeVisible();
    }
  });

  test('Virtual Keyboard Handling', async ({ page, isMobile }) => {
    // Skip on desktop
    test.skip(!isMobile, 'Virtual keyboard test only relevant on mobile');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Focus on input field to trigger virtual keyboard
    const input = page.getByRole('textbox').first();
    await input.focus();

    // Simulate virtual keyboard appearance (viewport height reduction)
    await page.setViewportSize({
      width: testViewport.width,
      height: testViewport.height - 300, // Simulate keyboard taking 300px
    });

    // Check that input remains visible and accessible
    await expect(input).toBeVisible();

    // Check that important UI elements are still accessible
    const submitButton = page.getByRole('button', {
      name: /continue|submit|send/i,
    });
    await expect(submitButton).toBeVisible();
  });
});

// Performance tests for mobile
test.describe('Mobile Performance', () => {
  test('Page Load Performance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Start performance measurement
    const startTime = Date.now();

    await page.goto('/select-event');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Page should load within reasonable time (5 seconds on mobile)
    expect(loadTime).toBeLessThan(5000);

    // Check for layout shifts
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const clsValue = entries.reduce((sum, entry) => {
            return sum + (entry as any).value;
          }, 0);
          resolve(clsValue);
        }).observe({ entryTypes: ['layout-shift'] });

        // Resolve after a short time if no layout shifts
        setTimeout(() => resolve(0), 1000);
      });
    });

    // Cumulative Layout Shift should be minimal
    expect(cls).toBeLessThan(0.1);
  });
});
