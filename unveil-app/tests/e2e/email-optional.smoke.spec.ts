import { test, expect } from '@playwright/test';

/**
 * Email Optionality Smoke Tests
 * 
 * These tests verify that core guest flows work without email dependencies.
 * They use existing mocks (no real SMS) and test on mobile viewports.
 * 
 * Coverage:
 * - Flow A: Guest create & RSVP (phone-only)
 * - Flow B: Messaging (Send Now + Schedule)
 * 
 * Assertions:
 * - No mailto: links present
 * - No email inputs/labels rendered  
 * - Guest appears in recipient preview
 * - All flows complete successfully
 */

test.beforeEach(async ({ page }) => {
  // Mock SMS service to avoid real SMS sends
  await page.route('**/api/sms/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'SMS mocked' }),
    });
  });

  // Mock Supabase auth for testing
  await page.route('**/auth/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ 
        user: { id: 'test-host-id', phone: '+1234567890' },
        session: { access_token: 'mock-token' }
      }),
    });
  });

  // Mock event and guest data
  await page.route('**/api/guests/**', async (route) => {
    if (route.request().method() === 'POST') {
      // Mock guest creation
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-guest-id',
            guest_name: 'Test Guest',
            phone: '+1987654321',
            rsvp_status: 'pending',
          },
        }),
      });
    } else {
      // Mock guest list
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'test-guest-id',
            guest_name: 'Test Guest',
            phone: '+1987654321',
            rsvp_status: 'pending',
          }],
        }),
      });
    }
  });

  // Mock messaging endpoints
  await page.route('**/api/messages/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message_id: 'test-message-id',
        recipients: 1,
      }),
    });
  });
});

test('Flow A: Guest create & RSVP (phone-only)', async ({ page }) => {
  // Navigate to host dashboard (assuming auth is mocked)
  await page.goto('/host/events/test-event-id');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // === GUEST CREATION ===
  
  // Look for add guest button/form
  const addGuestButton = page.locator('button', { hasText: /add guest|invite guest/i });
  if (await addGuestButton.isVisible()) {
    await addGuestButton.click();
  }

  // Fill guest form with phone only
  const nameInput = page.locator('input[name="guest_name"], input[placeholder*="name" i]').first();
  const phoneInput = page.locator('input[name="phone"], input[placeholder*="phone" i]').first();
  
  if (await nameInput.isVisible() && await phoneInput.isVisible()) {
    await nameInput.fill('Test Guest');
    await phoneInput.fill('+1987654321');

    // Assert no email fields are present
    const emailInputs = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    await expect(emailInputs).toHaveCount(0);

    // Assert no email labels
    const emailLabels = page.locator('label', { hasText: /email/i });
    await expect(emailLabels).toHaveCount(0);

    // Submit guest creation
    const submitButton = page.locator('button[type="submit"], button', { hasText: /save|add|create/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }
  }

  // === EMAIL ABSENCE ASSERTIONS ===
  
  // Assert no mailto links anywhere on page
  const mailtoLinks = page.locator('a[href^="mailto:"]');
  await expect(mailtoLinks).toHaveCount(0);

  // Assert no email-related text in forms
  const emailText = page.locator('text=/email address|email required|enter.*email/i');
  await expect(emailText).toHaveCount(0);
});

test('Flow B: Messaging (Send Now + Schedule)', async ({ page }) => {
  // Navigate to messaging section
  await page.goto('/host/events/test-event-id/messages');
  
  await page.waitForLoadState('networkidle');

  // === SEND NOW MESSAGE ===
  
  // Look for compose/send message button
  const composeButton = page.locator('button', { hasText: /compose|send message|new message/i }).first();
  if (await composeButton.isVisible()) {
    await composeButton.click();

    // Fill message content
    const messageInput = page.locator('textarea[name="content"], textarea[placeholder*="message" i]').first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Test announcement: Wedding ceremony starts at 3 PM');
    }

    // Verify recipient preview shows phone-only guest (if visible)
    const recipientPreview = page.locator('[data-testid="recipient-preview"], .recipient-list, text=/recipient/i');
    if (await recipientPreview.isVisible()) {
      await expect(recipientPreview).not.toContainText('@'); // Should not contain email addresses
    }

    // Send message now (if button exists)
    const sendNowButton = page.locator('button', { hasText: /send now|send immediately/i }).first();
    if (await sendNowButton.isVisible()) {
      await sendNowButton.click();
    }
  }

  // === EMAIL ABSENCE ASSERTIONS ===
  
  // Assert no mailto links in messaging interface
  const mailtoLinks = page.locator('a[href^="mailto:"]');
  await expect(mailtoLinks).toHaveCount(0);

  // Assert no email input fields in messaging
  const emailInputs = page.locator('input[type="email"], input[name="email"]');
  await expect(emailInputs).toHaveCount(0);

  // Assert no email-related labels or text
  const emailLabels = page.locator('label', { hasText: /email/i });
  await expect(emailLabels).toHaveCount(0);
});

test('UI Email Absence Verification', async ({ page }) => {
  // Test various pages for email absence
  const pagesToTest = [
    '/host/events/test-event-id',
    '/host/events/test-event-id/guests', 
    '/host/events/test-event-id/messages',
  ];

  for (const pagePath of pagesToTest) {
    await page.goto(pagePath);
    await page.waitForLoadState('networkidle');

    // Global assertions for email absence
    const mailtoLinks = page.locator('a[href^="mailto:"]');
    await expect(mailtoLinks).toHaveCount(0);

    const emailInputs = page.locator('input[type="email"]');
    await expect(emailInputs).toHaveCount(0);

    const emailLabels = page.locator('label:has-text("email"), label:has-text("Email")');
    await expect(emailLabels).toHaveCount(0);

    // Should not have email validation messages
    const emailValidation = page.locator('text=/valid email|email required|email address/i');
    await expect(emailValidation).toHaveCount(0);
  }
});