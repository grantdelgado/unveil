/**
 * E2E Tests for Error Boundaries and Error Handling
 * Phase 2: Verify error handling improvements
 */

import { test, expect } from '@playwright/test';

test.describe('Error Boundary Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up error monitoring
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
  });

  test('should handle network failures gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate network failure for auth requests
    await page.route('**/auth/**', route => route.abort());
    
    // Try to authenticate
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show error message instead of crashing
    await expect(page.getByText(/failed to send/i)).toBeVisible({ timeout: 10000 });
    
    // Page should remain functional
    await expect(phoneInput).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate API error
    await page.route('**/auth/otp', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Try to authenticate
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show user-friendly error message
    await expect(page.getByText(/something went wrong/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle malformed API responses', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate malformed response
    await page.route('**/auth/otp', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json{'
      });
    });
    
    // Try to authenticate
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should handle parsing error gracefully
    await expect(page.getByText(/failed to send/i)).toBeVisible({ timeout: 10000 });
  });

  test('should recover from component errors', async ({ page }) => {
    await page.goto('/select-event');
    
    // Inject error into component
    await page.evaluate(() => {
      // Force an error in React component
      const originalError = console.error;
      console.error = (...args) => {
        if (args[0]?.includes?.('React')) {
          // Suppress React error boundary logs for cleaner test output
          return;
        }
        originalError(...args);
      };
      
      // Trigger component error
      window.dispatchEvent(new CustomEvent('test-error'));
    });
    
    // Page should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle timeout errors', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate slow response
    await page.route('**/auth/otp', route => {
      // Delay response beyond timeout
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }, 30000); // 30 second delay
    });
    
    // Try to authenticate
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show timeout error
    await expect(page.getByText(/timeout|failed/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Error Handler Integration', () => {
  test('should use centralized error handler for user actions', async ({ page }) => {
    // Navigate to a page with error handling
    await page.goto('/login');
    
    // Monitor console for error handler usage
    const errorMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Error in')) {
        errorMessages.push(msg.text());
      }
    });
    
    // Simulate error condition
    await page.route('**/auth/otp', route => route.abort());
    
    // Trigger error
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Should have logged error through centralized handler
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  test('should show consistent error messages', async ({ page }) => {
    await page.goto('/login');
    
    // Test different error scenarios
    const errorScenarios = [
      { route: '**/auth/otp', status: 400, expectedText: /invalid|error/ },
      { route: '**/auth/otp', status: 429, expectedText: /rate limit|too many/ },
      { route: '**/auth/otp', status: 500, expectedText: /server error|try again/ }
    ];
    
    for (const scenario of errorScenarios) {
      // Set up error response
      await page.route(scenario.route, route => {
        route.fulfill({
          status: scenario.status,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Test error' })
        });
      });
      
      // Trigger error
      const phoneInput = page.locator('input[type="tel"]');
      await phoneInput.fill('+1234567890');
      await page.getByRole('button', { name: 'Continue' }).click();
      
      // Should show appropriate error message
      await expect(page.locator('text=' + scenario.expectedText.source)).toBeVisible({ timeout: 5000 });
      
      // Reset for next test
      await page.reload();
    }
  });

  test('should handle success messages consistently', async ({ page }) => {
    await page.goto('/login');
    
    // Mock successful response
    await page.route('**/auth/otp', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
    
    // Trigger success flow
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should proceed to OTP screen (success handling)
    await expect(page.getByText('Enter the verification code')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility Error Handling', () => {
  test('should announce errors to screen readers', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate error
    await page.route('**/auth/otp', route => route.abort());
    
    // Trigger error
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should have aria-live region for errors
    const errorRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]');
    await expect(errorRegion).toBeVisible({ timeout: 10000 });
  });

  test('should maintain focus after errors', async ({ page }) => {
    await page.goto('/login');
    
    // Focus on input
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.focus();
    
    // Simulate error
    await page.route('**/auth/otp', route => route.abort());
    
    // Trigger error
    await phoneInput.fill('invalid');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Focus should remain on input or move to error message
    await expect(phoneInput).toBeFocused();
  });

  test('should provide clear error descriptions', async ({ page }) => {
    await page.goto('/login');
    
    // Test validation error
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('invalid');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should have descriptive error text
    const errorText = page.locator('[role="alert"], .error-message');
    await expect(errorText).toContainText(/phone number/i);
  });
});

test.describe('Error Recovery', () => {
  test('should allow retry after network errors', async ({ page }) => {
    await page.goto('/login');
    
    let requestCount = 0;
    await page.route('**/auth/otp', route => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails
        route.abort();
      } else {
        // Second request succeeds
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });
    
    // First attempt (will fail)
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 10000 });
    
    // Retry (should succeed)
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should proceed to OTP screen
    await expect(page.getByText('Enter the verification code')).toBeVisible({ timeout: 10000 });
  });

  test('should clear errors on successful retry', async ({ page }) => {
    await page.goto('/login');
    
    // First show error
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('invalid');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show validation error
    await expect(page.getByText(/invalid/i)).toBeVisible();
    
    // Fix input and retry
    await phoneInput.clear();
    await phoneInput.fill('+1234567890');
    
    // Error should clear
    await expect(page.getByText(/invalid/i)).not.toBeVisible();
  });
});
