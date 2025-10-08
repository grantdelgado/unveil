import { test, expect } from '@playwright/test';

/**
 * Smoke test for deterministic first paint
 * Verifies that the app renders successfully on first load
 */
test.describe('Health Check Smoke Test', () => {
  test('should render health check page with visible status', async ({ page }) => {
    // Navigate to health check endpoint
    await page.goto('/healthz');

    // Wait for the health status to be visible
    const healthStatus = page.getByTestId('health-status');
    await expect(healthStatus).toBeVisible();

    // Verify the expected content is present
    await expect(healthStatus).toContainText('Unveil is healthy');

    // Verify page loads within reasonable time (should be fast with deterministic first paint)
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Log load time for observability
    console.log(`Health check page loaded in ${loadTime}ms`);
    
    // Expect reasonable load time (should be under 3 seconds for iOS)
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have no console errors on first paint', async ({ page }) => {
    const errors: string[] = [];
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to health check
    await page.goto('/healthz');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Verify no console errors occurred
    expect(errors).toHaveLength(0);
  });
});
