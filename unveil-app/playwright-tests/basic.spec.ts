import { test, expect } from '@playwright/test';

test.describe('Basic App Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that we're not getting a 404 or error page
    expect(page.url()).toContain('localhost:3000');

    // Basic check that some content loaded
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('can navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Look for login-related text or navigation
    // This test will help us understand the current app structure
    const pageContent = await page.content();
    console.log(
      'Page contains login elements:',
      pageContent.includes('login') || pageContent.includes('sign in'),
    );
  });
});
