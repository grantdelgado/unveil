import { test, expect } from '@playwright/test';

/**
 * Production Build Verification Tests
 *
 * These tests ensure that development-only utilities are properly excluded
 * from production builds and don't leak sensitive debugging information.
 */

test.describe('Production Build Verification', () => {
  test('should exclude debug utilities in production', async ({ page }) => {
    // Set production environment
    await page.addInitScript(() => {
      // Mock production environment
      Object.defineProperty(process, 'env', {
        value: { ...process.env, NODE_ENV: 'production' },
        writable: true,
      });
    });

    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');

    // Debug panel should not be visible in production
    const debugPanel = page.locator('[data-testid="realtime-debug-panel"]');
    await expect(debugPanel).not.toBeVisible();

    // window.realtimeTests should not be available
    const realtimeTests = await page.evaluate(() => {
      return typeof (window as any).realtimeTests;
    });
    expect(realtimeTests).toBe('undefined');

    // Check that RealtimeDebugPanel is not rendered
    const debugPanelElement = await page
      .locator('.realtime-debug-panel')
      .count();
    expect(debugPanelElement).toBe(0);
  });

  test('should not expose sensitive debugging information', async ({
    page,
  }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');

    // Check console for any debug information leaks
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.waitForTimeout(2000);

    // Should not have debug utility logs in production
    const debugUtilityLogs = consoleLogs.filter(
      (log) =>
        log.includes('realtimeTests') ||
        log.includes('Debug panel') ||
        log.includes('🧪 Realtime test utilities'),
    );

    expect(debugUtilityLogs).toHaveLength(0);
  });

  test('should have clean console output in production', async ({ page }) => {
    await page.goto('/guest/events/test-event-id/home');
    await page.waitForLoadState('networkidle');

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.waitForTimeout(5000);

    // Should not have development-related errors or warnings
    const devRelatedErrors = consoleErrors.filter(
      (error) =>
        error.includes('development') ||
        error.includes('debug') ||
        error.includes('test'),
    );

    const devRelatedWarnings = consoleWarnings.filter(
      (warning) =>
        warning.includes('development') ||
        warning.includes('debug') ||
        warning.includes('test'),
    );

    expect(devRelatedErrors).toHaveLength(0);
    expect(devRelatedWarnings).toHaveLength(0);
  });
});
