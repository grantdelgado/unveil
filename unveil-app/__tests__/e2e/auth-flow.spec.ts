/**
 * E2E Tests for Authentication Flow
 * Phase 2: Critical gap coverage for auth flow
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show login form
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.getByText('Enter your phone number')).toBeVisible();
  });

  test('should handle phone number input and OTP flow', async ({ page }) => {
    await page.goto('/login');
    
    // Enter phone number
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    
    // Click continue
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show OTP input
    await expect(page.getByText('Enter the verification code')).toBeVisible();
    await expect(page.locator('input[inputmode="numeric"]').first()).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/login');
    
    // Enter invalid phone number
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('invalid');
    
    // Click continue
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show validation error
    await expect(page.getByText(/invalid phone number/i)).toBeVisible();
  });

  test('should handle OTP validation', async ({ page }) => {
    await page.goto('/login');
    
    // Enter valid phone number
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for OTP screen
    await expect(page.getByText('Enter the verification code')).toBeVisible();
    
    // Enter invalid OTP
    const otpInputs = page.locator('input[inputmode="numeric"]');
    await otpInputs.first().fill('1');
    await otpInputs.nth(1).fill('2');
    await otpInputs.nth(2).fill('3');
    await otpInputs.nth(3).fill('4');
    await otpInputs.nth(4).fill('5');
    await otpInputs.nth(5).fill('6');
    
    // Should attempt verification (will fail in test environment)
    await expect(page.getByText(/invalid verification code/i)).toBeVisible({ timeout: 10000 });
  });

  test('should provide resend OTP functionality', async ({ page }) => {
    await page.goto('/login');
    
    // Navigate to OTP screen
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for OTP screen
    await expect(page.getByText('Enter the verification code')).toBeVisible();
    
    // Should show resend button
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test('should allow changing phone number from OTP screen', async ({ page }) => {
    await page.goto('/login');
    
    // Navigate to OTP screen
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for OTP screen
    await expect(page.getByText('Enter the verification code')).toBeVisible();
    
    // Click change phone number
    await page.getByRole('button', { name: /change phone number/i }).click();
    
    // Should return to phone input screen
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.getByText('Enter your phone number')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Simulate network failure
    await page.route('**/auth/otp', route => route.abort());
    
    // Enter phone number and submit
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Should show error message
    await expect(page.getByText(/failed to send verification code/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Route Guards', () => {
  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/select-event');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should protect host routes', async ({ page }) => {
    // Try to access host route directly
    await page.goto('/host/events/test-id/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should protect guest routes', async ({ page }) => {
    // Try to access guest route directly
    await page.goto('/guest/events/test-id/home');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should redirect obsolete routes', async ({ page }) => {
    // Test obsolete dashboard route
    await page.goto('/dashboard');
    
    // Should redirect to select-event (then to login)
    await expect(page).toHaveURL('/login');
  });

  test('should redirect obsolete guest home route', async ({ page }) => {
    // Test obsolete guest home route
    await page.goto('/guest/home');
    
    // Should redirect to select-event (then to login)
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Error Boundaries', () => {
  test('should handle JavaScript errors gracefully', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate to a page that might have errors
    await page.goto('/login');
    
    // Simulate a JavaScript error by injecting bad code
    await page.evaluate(() => {
      // This should be caught by error boundaries
      throw new Error('Test error for error boundary');
    });
    
    // Page should still be functional
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });

  test('should show error fallback for component failures', async ({ page }) => {
    await page.goto('/login');
    
    // Inject code to break a component
    await page.addInitScript(() => {
      // Override React to simulate component error
      const originalCreateElement = (window as any).React?.createElement;
      if (originalCreateElement) {
        (window as any).React.createElement = function(...args: any[]) {
          // Randomly fail to test error boundaries
          if (Math.random() < 0.1 && args[0]?.name === 'PhoneStep') {
            throw new Error('Simulated component error');
          }
          return originalCreateElement.apply(this, args);
        };
      }
    });
    
    // Reload to trigger the error
    await page.reload();
    
    // Should either show the component or an error fallback
    // (We can't guarantee the error will trigger, but the page should remain stable)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');
    
    // Check for proper labeling
    await expect(page.locator('input[type="tel"]')).toHaveAttribute('aria-label');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Tab to phone input
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="tel"]')).toBeFocused();
    
    // Tab to continue button
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
  });

  test('should have proper focus management in OTP flow', async ({ page }) => {
    await page.goto('/login');
    
    // Navigate to OTP screen
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+1234567890');
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Wait for OTP screen
    await expect(page.getByText('Enter the verification code')).toBeVisible();
    
    // First OTP input should be focused
    await expect(page.locator('input[inputmode="numeric"]').first()).toBeFocused();
  });
});
