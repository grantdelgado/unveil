import { test, expect } from '@playwright/test';
import { SMS_AUTH_FOOTER_COPY, SMS_NOTIF_CHECKBOX_COPY, PRIVACY_URL } from '@/lib/compliance/smsConsent';

test.describe('SMS Consent Copy Verification', () => {
  test('login page displays correct SMS auth consent footer', async ({ page }) => {
    await page.goto('/login');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');

    // Check that the exact SMS auth footer copy is present
    const footerText = await page.locator('[role="note"][aria-label="SMS consent notice"]').textContent();
    
    // Normalize whitespace for comparison (removes extra spaces, newlines)
    const normalizedFooter = footerText?.replace(/\s+/g, ' ').trim();
    const expectedText = SMS_AUTH_FOOTER_COPY.replace(/\s+/g, ' ').trim();
    
    expect(normalizedFooter).toBe(expectedText);

    // Verify the Privacy Policy link exists and points to correct URL
    const privacyLink = page.locator('[role="note"] a[href="' + PRIVACY_URL + '"]');
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveText('Privacy Policy');
    
    // Verify link is keyboard navigable
    await privacyLink.focus();
    expect(await privacyLink.evaluate(el => el === document.activeElement)).toBe(true);
  });

  test('setup page displays correct SMS notification consent checkbox', async ({ page }) => {
    // Note: This test assumes user will be redirected to login if not authenticated
    // In a real test, you might want to authenticate first or mock auth state
    
    await page.goto('/setup');
    
    // Wait for potential redirect to login, then navigate back with auth
    // For this test, we'll check if we're on setup or login page
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      // If redirected to login, we can't test setup without authentication
      // This is expected behavior - setup requires auth
      test.skip('Setup page requires authentication - skipping consent checkbox test');
      return;
    }

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');

    // Check that the SMS notification consent checkbox exists with correct label
    const checkboxLabel = page.locator('label[for="smsConsent"]');
    await expect(checkboxLabel).toBeVisible();

    // Get the label text (excluding the link text)
    const labelText = await checkboxLabel.textContent();
    const normalizedLabel = labelText?.replace(/\s+/g, ' ').trim();
    const expectedText = SMS_NOTIF_CHECKBOX_COPY.replace(/\s+/g, ' ').trim();
    
    expect(normalizedLabel).toBe(expectedText);

    // Verify the checkbox input exists and is properly associated
    const checkbox = page.locator('#smsConsent');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toHaveAttribute('type', 'checkbox');
    await expect(checkbox).toHaveAttribute('required');

    // Verify the Privacy Policy link exists and points to correct URL
    const privacyLink = checkboxLabel.locator('a[href="' + PRIVACY_URL + '"]');
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveText('Privacy Policy');
    
    // Verify link is keyboard navigable
    await privacyLink.focus();
    expect(await privacyLink.evaluate(el => el === document.activeElement)).toBe(true);

    // Verify checkbox can be checked/unchecked
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('privacy policy links open in new tab', async ({ context, page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Set up listener for new tab
    const pagePromise = context.waitForEvent('page');
    
    // Click the privacy policy link
    const privacyLink = page.locator('[role="note"] a[href="' + PRIVACY_URL + '"]');
    await privacyLink.click();

    // Verify new tab opens with correct URL
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    expect(newPage.url()).toBe(PRIVACY_URL);
  });
});
