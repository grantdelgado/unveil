import { test, expect, type Page } from '@playwright/test';
import { addTestUser, cleanupTestUsers } from '../src/test/test-helpers';

/**
 * MVP Critical User Flows E2E Test Suite
 * 
 * Tests the complete user journey from event creation to guest interaction
 */

// Test data
const TEST_EVENT = {
  name: 'E2E Test Wedding',
  date: '2024-12-25',
  description: 'End-to-end test event for MVP validation',
  venue: {
    name: 'Test Venue',
    address: '123 Test Street, Test City, TC 12345'
  }
};

const TEST_GUESTS = [
  { name: 'Alice Johnson', phone: '+1234567890', email: 'alice@test.com' },
  { name: 'Bob Smith', phone: '+1234567891', email: 'bob@test.com' },
  { name: 'Carol Wilson', phone: '+1234567892', email: 'carol@test.com' }
];

let hostUserId: string;
let guestUserId: string;
let eventId: string;

test.describe('MVP Critical User Flows', () => {
  
  test.beforeAll(async () => {
    // Set up test users
    const host = await addTestUser('e2e-host@test.com', '+1234567800', 'Host User');
    const guest = await addTestUser('e2e-guest@test.com', '+1234567801', 'Guest User');
    
    hostUserId = host.id;
    guestUserId = guest.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    await cleanupTestUsers([hostUserId, guestUserId]);
  });

  test('Complete Host Workflow: Create Event → Import Guests → Send Invites', async ({ page }) => {
    await test.step('Host Authentication', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="phone-input"]', '+1234567800');
      await page.click('[data-testid="login-button"]');
      
      // In development, bypass SMS verification
      if (process.env.NODE_ENV === 'development') {
        await page.fill('[data-testid="verification-code"]', '123456');
        await page.click('[data-testid="verify-button"]');
      }
      
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    await test.step('Create New Event', async () => {
      await page.click('[data-testid="create-event-button"]');
      
      // Fill event details
      await page.fill('[data-testid="event-name"]', TEST_EVENT.name);
      await page.fill('[data-testid="event-date"]', TEST_EVENT.date);
      await page.fill('[data-testid="event-description"]', TEST_EVENT.description);
      await page.fill('[data-testid="venue-name"]', TEST_EVENT.venue.name);
      await page.fill('[data-testid="venue-address"]', TEST_EVENT.venue.address);
      
      await page.click('[data-testid="create-event-submit"]');
      
      // Verify event creation
      await expect(page.locator('[data-testid="event-created-success"]')).toBeVisible();
      await expect(page.locator('h1')).toContainText(TEST_EVENT.name);
      
      // Extract event ID from URL
      const url = page.url();
      eventId = url.split('/events/')[1].split('/')[0];
    });

    await test.step('Import Guest List', async () => {
      await page.click('[data-testid="guest-management-tab"]');
      await page.click('[data-testid="import-guests-button"]');
      
      // Simulate CSV import by adding guests manually
      for (const guest of TEST_GUESTS) {
        await page.click('[data-testid="add-guest-button"]');
        await page.fill('[data-testid="guest-name-input"]', guest.name);
        await page.fill('[data-testid="guest-phone-input"]', guest.phone);
        await page.fill('[data-testid="guest-email-input"]', guest.email);
        await page.click('[data-testid="save-guest-button"]');
      }
      
      // Verify guest list
      await expect(page.locator('[data-testid="guest-list-item"]')).toHaveCount(TEST_GUESTS.length);
    });

    await test.step('Send SMS Invitations', async () => {
      // Select all guests
      await page.click('[data-testid="select-all-guests"]');
      
      // Send invitations (mock in development)
      await page.click('[data-testid="send-invitations-button"]');
      
      if (process.env.NODE_ENV === 'development') {
        // Verify mock SMS panel
        await expect(page.locator('[data-testid="sms-test-panel"]')).toBeVisible();
        await expect(page.locator('[data-testid="mock-sms-count"]')).toContainText('3');
      }
      
      // Verify invitation status
      await expect(page.locator('[data-testid="invitation-sent-status"]')).toHaveCount(TEST_GUESTS.length);
    });
  });

  test('Complete Guest Workflow: Receive Invite → RSVP → Upload Media → Send Messages', async ({ page }) => {
    // Create a new context for guest user
    await test.step('Guest Authentication', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="phone-input"]', '+1234567801');
      await page.click('[data-testid="login-button"]');
      
      // In development, bypass SMS verification
      if (process.env.NODE_ENV === 'development') {
        await page.fill('[data-testid="verification-code"]', '123456');
        await page.click('[data-testid="verify-button"]');
      }
      
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    await test.step('Access Event via Invitation Link', async () => {
      // Navigate directly to event (simulating invitation link)
      await page.goto(`/guest/events/${eventId}`);
      
      // Verify event details are visible
      await expect(page.locator('h1')).toContainText(TEST_EVENT.name);
      await expect(page.locator('[data-testid="event-date"]')).toContainText('December 25, 2024');
    });

    await test.step('RSVP to Event', async () => {
      // Update RSVP status
      await page.click('[data-testid="rsvp-attending"]');
      await page.fill('[data-testid="rsvp-notes"]', 'Looking forward to the celebration!');
      await page.click('[data-testid="update-rsvp-button"]');
      
      // Verify RSVP confirmation
      await expect(page.locator('[data-testid="rsvp-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="rsvp-status"]')).toContainText('Attending');
    });

    await test.step('Upload Event Media', async () => {
      await page.click('[data-testid="media-gallery-tab"]');
      
      // Test file upload (use a small test image)
      const fileInput = page.locator('[data-testid="media-upload-input"]');
      
      // Create a test file
      const testImagePath = 'src/test/fixtures/test-image.jpg';
      await fileInput.setInputFiles(testImagePath);
      
      // Verify upload progress
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      
      // Wait for upload completion
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      
      // Verify image appears in gallery
      await expect(page.locator('[data-testid="media-gallery-item"]')).toHaveCount(1);
    });

    await test.step('Send Real-time Messages', async () => {
      await page.click('[data-testid="messages-tab"]');
      
      // Send a message
      const testMessage = 'Excited for the big day! 🎉';
      await page.fill('[data-testid="message-input"]', testMessage);
      await page.click('[data-testid="send-message-button"]');
      
      // Verify message appears in chat
      await expect(page.locator('[data-testid="message-item"]').last()).toContainText(testMessage);
      
      // Verify real-time indicator
      await expect(page.locator('[data-testid="realtime-status"]')).toContainText('Connected');
    });
  });

  test('Cross-Device Real-time Synchronization', async ({ browser }) => {
    // Create two browser contexts to simulate different devices
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await test.step('Setup Both Devices', async () => {
      // Host device setup
      await hostPage.goto('/login');
      await hostPage.fill('[data-testid="phone-input"]', '+1234567800');
      await hostPage.click('[data-testid="login-button"]');
      if (process.env.NODE_ENV === 'development') {
        await hostPage.fill('[data-testid="verification-code"]', '123456');
        await hostPage.click('[data-testid="verify-button"]');
      }
      await hostPage.goto(`/host/events/${eventId}/dashboard`);
      
      // Guest device setup
      await guestPage.goto('/login');
      await guestPage.fill('[data-testid="phone-input"]', '+1234567801');
      await guestPage.click('[data-testid="login-button"]');
      if (process.env.NODE_ENV === 'development') {
        await guestPage.fill('[data-testid="verification-code"]', '123456');
        await guestPage.click('[data-testid="verify-button"]');
      }
      await guestPage.goto(`/guest/events/${eventId}`);
    });

    await test.step('Test Real-time Message Sync', async () => {
      // Navigate both to messages
      await hostPage.click('[data-testid="messages-tab"]');
      await guestPage.click('[data-testid="messages-tab"]');
      
      // Host sends message
      const hostMessage = 'Welcome everyone! From the host device 📱';
      await hostPage.fill('[data-testid="message-input"]', hostMessage);
      await hostPage.click('[data-testid="send-message-button"]');
      
      // Verify message appears on guest device in real-time
      await expect(guestPage.locator('[data-testid="message-item"]').last())
        .toContainText(hostMessage, { timeout: 5000 });
      
      // Guest responds
      const guestMessage = 'Thank you! Excited to be here! 🎊';
      await guestPage.fill('[data-testid="message-input"]', guestMessage);
      await guestPage.click('[data-testid="send-message-button"]');
      
      // Verify response appears on host device
      await expect(hostPage.locator('[data-testid="message-item"]').last())
        .toContainText(guestMessage, { timeout: 5000 });
    });

    await test.step('Test RSVP Sync', async () => {
      // Guest changes RSVP
      await guestPage.click('[data-testid="rsvp-attending"]');
      await guestPage.click('[data-testid="update-rsvp-button"]');
      
      // Check host dashboard reflects change
      await hostPage.click('[data-testid="guest-management-tab"]');
      await expect(hostPage.locator('[data-testid="rsvp-count-attending"]'))
        .toContainText('1', { timeout: 5000 });
    });

    // Cleanup contexts
    await hostContext.close();
    await guestContext.close();
  });

  test('Mobile-Specific Features', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await test.step('Mobile Authentication', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="phone-input"]', '+1234567801');
      await page.click('[data-testid="login-button"]');
      
      if (process.env.NODE_ENV === 'development') {
        await page.fill('[data-testid="verification-code"]', '123456');
        await page.click('[data-testid="verify-button"]');
      }
    });

    await test.step('Mobile Media Upload (Camera)', async () => {
      await page.goto(`/guest/events/${eventId}`);
      await page.click('[data-testid="media-gallery-tab"]');
      
      // Test mobile camera upload
      await page.click('[data-testid="camera-upload-button"]');
      
      // Verify camera permissions prompt (would be handled in real mobile browser)
      await expect(page.locator('[data-testid="camera-permission-prompt"]')).toBeVisible();
    });

    await test.step('Pull-to-Refresh', async () => {
      // Simulate pull-to-refresh gesture
      await page.mouse.move(187, 100);
      await page.mouse.down();
      await page.mouse.move(187, 300, { steps: 10 });
      await page.mouse.up();
      
      // Verify refresh indicator
      await expect(page.locator('[data-testid="pull-refresh-indicator"]')).toBeVisible();
    });

    await test.step('Mobile Navigation', async () => {
      // Test mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test touch interactions
      await page.click('[data-testid="messages-tab"]');
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    });
  });

  test('Error Handling and Recovery', async ({ page }) => {
    await test.step('Network Error Simulation', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="phone-input"]', '+1234567801');
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      await page.click('[data-testid="login-button"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Restore network and retry
      await page.unroute('**/api/**');
      await page.click('[data-testid="retry-button"]');
      
      // Verify recovery
      if (process.env.NODE_ENV === 'development') {
        await page.fill('[data-testid="verification-code"]', '123456');
        await page.click('[data-testid="verify-button"]');
      }
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    await test.step('File Upload Error Handling', async () => {
      await page.goto(`/guest/events/${eventId}`);
      await page.click('[data-testid="media-gallery-tab"]');
      
      // Try to upload oversized file
      const oversizedFile = 'src/test/fixtures/oversized-file.jpg'; // > 50MB
      await page.locator('[data-testid="media-upload-input"]').setInputFiles(oversizedFile);
      
      // Verify error message
      await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-size-error"]')).toContainText('50MB');
    });
  });

  test('Performance Validation', async ({ page }) => {
    // Add performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = [];
      const observer = new PerformanceObserver((list) => {
        window.performanceMetrics.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['navigation', 'measure', 'mark'] });
    });

    await test.step('Page Load Performance', async () => {
      const startTime = Date.now();
      await page.goto(`/guest/events/${eventId}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within acceptable time
      expect(loadTime).toBeLessThan(3000); // 3 second limit
    });

    await test.step('Media Upload Performance', async () => {
      await page.click('[data-testid="media-gallery-tab"]');
      
      const uploadStart = Date.now();
      await page.locator('[data-testid="media-upload-input"]').setInputFiles('src/test/fixtures/test-image.jpg');
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      const uploadTime = Date.now() - uploadStart;
      
      // Verify upload completes within acceptable time
      expect(uploadTime).toBeLessThan(10000); // 10 second limit for 5MB file
    });

    await test.step('Real-time Message Performance', async () => {
      await page.click('[data-testid="messages-tab"]');
      
      const messageStart = Date.now();
      await page.fill('[data-testid="message-input"]', 'Performance test message');
      await page.click('[data-testid="send-message-button"]');
      
      // Verify message appears quickly
      await expect(page.locator('[data-testid="message-item"]').last())
        .toContainText('Performance test message', { timeout: 1000 });
      const messageTime = Date.now() - messageStart;
      
      expect(messageTime).toBeLessThan(1000); // 1 second limit
    });
  });
}); 