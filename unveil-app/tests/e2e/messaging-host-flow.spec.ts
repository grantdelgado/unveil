/**
 * Host Messaging Flow End-to-End Tests
 * 
 * Tests the complete host workflow: Compose → Schedule → Delivery → Analytics
 * Validates tag-based targeting, real-time updates, and delivery tracking
 */

import { test, expect } from '@playwright/test';
import { supabase } from '@/lib/supabase';

interface TestHostContext {
  hostUserId: string;
  hostEmail: string;
  eventId: string;
  guestIds: string[];
  taggedGuestIds: string[];
  messageId?: string;
  scheduledMessageId?: string;
}

test.describe('Host Messaging Flow', () => {
  let context: TestHostContext;

  test.beforeAll(async () => {
    context = await setupHostTestData();
  });

  test.afterAll(async () => {
    await cleanupHostTestData(context);
  });

  test.describe('Compose Message Flow', () => {
    test('host can compose and send immediate message to all guests', async ({ page }) => {
      // Navigate to event messages
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Wait for page to load
      await expect(page.getByText('Messages')).toBeVisible();
      
      // Click compose message
      await page.getByRole('button', { name: /compose/i }).click();
      
      // Fill message content
      const messageContent = 'Welcome to our wedding celebration! We are so excited to share this special day with you.';
      await page.getByLabel(/message content/i).fill(messageContent);
      
      // Select all guests (default targeting)
      await expect(page.getByText(/all guests/i)).toBeVisible();
      
      // Send immediately
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify success message
      await expect(page.getByText(/message sent successfully/i)).toBeVisible({ timeout: 10000 });
      
      // Verify message appears in message list
      await page.goto(`/host/events/${context.eventId}/messages`);
      await expect(page.getByText(messageContent.substring(0, 30))).toBeVisible();
      
      // Store message ID for later tests
      const messageData = await supabase
        .from('messages')
        .select('id')
        .eq('event_id', context.eventId)
        .eq('content', messageContent)
        .single();
      
      context.messageId = messageData.data?.id;
      expect(context.messageId).toBeDefined();
    });

    test('host can compose message with tag-based targeting', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Fill message content
      const vipMessage = 'Special VIP reception details will be shared closer to the date.';
      await page.getByLabel(/message content/i).fill(vipMessage);
      
      // Switch to tag targeting
      await page.getByRole('button', { name: /target by tags/i }).click();
      
      // Select VIP tag
      await page.getByLabel(/tags/i).click();
      await page.getByRole('option', { name: 'vip' }).click();
      
      // Verify recipient count shows tagged guests only
      await expect(page.getByText(/2 recipients/i)).toBeVisible();
      
      // Send message
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify success
      await expect(page.getByText(/message sent successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('host can preview message recipients before sending', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Fill message
      await page.getByLabel(/message content/i).fill('Test preview message');
      
      // Click preview recipients
      await page.getByRole('button', { name: /preview recipients/i }).click();
      
      // Verify recipient modal shows
      await expect(page.getByText(/message recipients/i)).toBeVisible();
      
      // Verify all guests are listed
      await expect(page.getByText('Alice Smith')).toBeVisible();
      await expect(page.getByText('Bob Johnson')).toBeVisible();
      await expect(page.getByText('Carol Wilson')).toBeVisible();
      
      // Close modal
      await page.getByRole('button', { name: /close/i }).click();
    });
  });

  test.describe('Schedule Message Flow', () => {
    test('host can schedule message for future delivery', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Fill message content
      const scheduledContent = 'Reminder: Our wedding is tomorrow! We can\'t wait to celebrate with you.';
      await page.getByLabel(/message content/i).fill(scheduledContent);
      
      // Switch to schedule mode
      await page.getByRole('button', { name: /schedule for later/i }).click();
      
      // Set future date/time (tomorrow at 10 AM)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      
      await page.getByLabel(/schedule date/i).fill(tomorrow.toISOString().split('T')[0]);
      await page.getByLabel(/schedule time/i).fill('10:00');
      
      // Schedule message
      await page.getByRole('button', { name: /schedule message/i }).click();
      
      // Verify success
      await expect(page.getByText(/message scheduled successfully/i)).toBeVisible({ timeout: 10000 });
      
      // Navigate to scheduled messages
      await page.goto(`/host/events/${context.eventId}/messages/scheduled`);
      
      // Verify scheduled message appears
      await expect(page.getByText(scheduledContent.substring(0, 30))).toBeVisible();
      await expect(page.getByText(/scheduled/i)).toBeVisible();
      
      // Store scheduled message ID
      const scheduledData = await supabase
        .from('scheduled_messages')
        .select('id')
        .eq('event_id', context.eventId)
        .eq('content', scheduledContent)
        .single();
      
      context.scheduledMessageId = scheduledData.data?.id;
    });

    test('host can edit scheduled message before send time', async ({ page }) => {
      if (!context.scheduledMessageId) {
        test.skip('No scheduled message to edit');
      }
      
      await page.goto(`/host/events/${context.eventId}/messages/scheduled`);
      
      // Find the scheduled message and click edit
      await page.getByText(/reminder.*wedding.*tomorrow/i).click();
      await page.getByRole('button', { name: /edit/i }).click();
      
      // Update message content
      const updatedContent = 'Updated: Our wedding is tomorrow! Don\'t forget to bring your dancing shoes!';
      await page.getByLabel(/message content/i).clear();
      await page.getByLabel(/message content/i).fill(updatedContent);
      
      // Save changes
      await page.getByRole('button', { name: /save changes/i }).click();
      
      // Verify update success
      await expect(page.getByText(/message updated successfully/i)).toBeVisible();
      await expect(page.getByText(/dancing shoes/i)).toBeVisible();
    });

    test('host can cancel scheduled message', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/scheduled`);
      
      // Create a new scheduled message to cancel
      await page.getByRole('button', { name: /new scheduled message/i }).click();
      
      const cancelContent = 'This message will be cancelled for testing';
      await page.getByLabel(/message content/i).fill(cancelContent);
      
      // Set future time
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 2);
      await page.getByLabel(/schedule time/i).fill(`${futureTime.getHours().toString().padStart(2, '0')}:00`);
      
      await page.getByRole('button', { name: /schedule message/i }).click();
      await expect(page.getByText(/message scheduled successfully/i)).toBeVisible();
      
      // Find and cancel the message
      await page.getByText(cancelContent.substring(0, 20)).click();
      await page.getByRole('button', { name: /cancel/i }).click();
      
      // Confirm cancellation
      await page.getByRole('button', { name: /confirm cancel/i }).click();
      
      // Verify message is removed
      await expect(page.getByText(cancelContent.substring(0, 20))).not.toBeVisible();
    });
  });

  test.describe('Message Delivery Tracking', () => {
    test('host can view delivery status for sent messages', async ({ page }) => {
      if (!context.messageId) {
        test.skip('No message to track');
      }
      
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Click on sent message to view details
      await page.getByText(/welcome to our wedding/i).click();
      
      // Verify delivery details modal
      await expect(page.getByText(/delivery details/i)).toBeVisible();
      
      // Check delivery status for each guest
      await expect(page.getByText('Alice Smith')).toBeVisible();
      await expect(page.getByText('Bob Johnson')).toBeVisible();
      await expect(page.getByText('Carol Wilson')).toBeVisible();
      
      // Verify delivery status indicators
      await expect(page.locator('[data-testid="delivery-status"]')).toHaveCount(5); // All 5 guests
      
      // Check for delivery timestamp
      await expect(page.getByText(/delivered at/i)).toBeVisible();
    });

    test('host can track read receipts for messages', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Simulate some guests reading the message
      await simulateGuestMessageRead(context.guestIds[0], context.messageId!);
      await simulateGuestMessageRead(context.guestIds[1], context.messageId!);
      
      // Refresh and check read status
      await page.reload();
      await page.getByText(/welcome to our wedding/i).click();
      
      // Verify read status is shown
      await expect(page.getByText(/2 of 5 read/i)).toBeVisible();
      
      // Check individual read indicators
      await expect(page.getByTestId('read-indicator-alice')).toHaveClass(/read/);
      await expect(page.getByTestId('read-indicator-bob')).toHaveClass(/read/);
      await expect(page.getByTestId('read-indicator-carol')).toHaveClass(/unread/);
    });

    test('host can retry failed message deliveries', async ({ page }) => {
      // Create a message with simulated delivery failure
      const failedMessage = await createMessageWithFailedDelivery(context.eventId, context.guestIds[0]);
      
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Find message with failed delivery
      await page.getByText(/failed delivery test/i).click();
      
      // Look for retry button on failed delivery
      await expect(page.getByRole('button', { name: /retry delivery/i })).toBeVisible();
      
      // Click retry
      await page.getByRole('button', { name: /retry delivery/i }).click();
      
      // Verify retry confirmation
      await expect(page.getByText(/delivery retry initiated/i)).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('host sees real-time message responses from guests', async ({ page, context: browserContext }) => {
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Open a new page to simulate guest response
      const guestPage = await browserContext.newPage();
      
      // Simulate guest login and response
      await simulateGuestResponse(guestPage, context.eventId, context.guestIds[0], context.messageId!, 'Thank you! We are so excited!');
      
      // Check if host page shows real-time update
      await expect(page.getByText(/thank you.*excited/i)).toBeVisible({ timeout: 10000 });
      
      // Verify response indicator
      await expect(page.getByText(/1 response/i)).toBeVisible();
      
      await guestPage.close();
    });

    test('host receives real-time notifications for new responses', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Simulate another guest response
      await simulateGuestResponse(page, context.eventId, context.guestIds[1], context.messageId!, 'Can\'t wait to celebrate with you both!');
      
      // Check for notification badge or indicator
      await expect(page.getByTestId('message-notification')).toBeVisible({ timeout: 5000 });
      
      // Verify updated response count
      await expect(page.getByText(/2 responses/i)).toBeVisible();
    });
  });

  test.describe('Analytics Integration', () => {
    test('host can view comprehensive message analytics', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/analytics`);
      
      // Wait for analytics to load
      await expect(page.getByText(/message analytics/i)).toBeVisible();
      
      // Verify key metrics are displayed
      await expect(page.getByText(/delivery rate/i)).toBeVisible();
      await expect(page.getByText(/read rate/i)).toBeVisible();
      await expect(page.getByText(/response rate/i)).toBeVisible();
      
      // Check for percentage values
      await expect(page.getByText(/%/)).toHaveCount.atLeast(3);
      
      // Verify top performing messages section
      await expect(page.getByText(/top performing messages/i)).toBeVisible();
      
      // Check for chart visualizations
      await expect(page.locator('svg')).toBeVisible(); // Chart should be rendered
    });

    test('host can export analytics data', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/analytics`);
      
      // Wait for data to load
      await page.waitForLoadState('networkidle');
      
      // Click export button
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /export/i }).click();
      
      // Select CSV export
      await page.getByRole('menuitem', { name: /export csv/i }).click();
      
      // Verify download starts
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('analytics');
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('analytics show accurate delivery and engagement metrics', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/analytics`);
      
      // Verify metrics match expected values based on test data
      // 5 guests, 1 message sent to all, 2 read receipts, 2 responses
      
      await expect(page.getByTestId('delivery-rate')).toContainText('100%'); // All 5 delivered
      await expect(page.getByTestId('read-rate')).toContainText('40%'); // 2 of 5 read
      await expect(page.getByTestId('response-rate')).toContainText('40%'); // 2 of 5 responded
      
      // Verify channel breakdown
      await expect(page.getByText(/sms delivery/i)).toBeVisible();
      await expect(page.getByText(/push notification/i)).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('host sees appropriate error messages for failed actions', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Try to send empty message
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify validation error
      await expect(page.getByText(/message content is required/i)).toBeVisible();
      
      // Try to schedule message in the past
      await page.getByLabel(/message content/i).fill('Test message');
      await page.getByRole('button', { name: /schedule for later/i }).click();
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await page.getByLabel(/schedule date/i).fill(yesterday.toISOString().split('T')[0]);
      
      await page.getByRole('button', { name: /schedule message/i }).click();
      
      // Verify error for past date
      await expect(page.getByText(/cannot schedule.*past/i)).toBeVisible();
    });

    test('host can recover from network errors', async ({ page }) => {
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to send a message
      await page.getByRole('button', { name: /compose/i }).click();
      await page.getByLabel(/message content/i).fill('Network test message');
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify error handling
      await expect(page.getByText(/network error/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
      
      // Restore network
      await page.unroute('**/api/**');
      
      // Retry action
      await page.getByRole('button', { name: /retry/i }).click();
      
      // Verify success after retry
      await expect(page.getByText(/message sent successfully/i)).toBeVisible({ timeout: 10000 });
    });
  });
});

// Helper functions

async function setupHostTestData(): Promise<TestHostContext> {
  // Create test host user
  const { data: hostAuth } = await supabase.auth.signUp({
    email: 'host-e2e@test.com',
    password: 'testpassword123',
    phone: '+14155559000'
  });

  const hostUserId = hostAuth.user!.id;

  // Create test event
  const { data: event } = await supabase
    .from('events')
    .insert({
      title: 'E2E Test Wedding',
      host_user_id: hostUserId,
      event_date: '2025-06-15',
      location: 'Test Venue'
    })
    .select()
    .single();

  // Create test guests
  const guestData = [
    { name: 'Alice Smith', phone: '+14155559001', tags: ['family', 'vip'] },
    { name: 'Bob Johnson', phone: '+14155559002', tags: ['friends', 'vip'] },
    { name: 'Carol Wilson', phone: '+14155559003', tags: ['family'] },
    { name: 'David Brown', phone: '+14155559004', tags: ['friends'] },
    { name: 'Eve Davis', phone: '+14155559005', tags: ['work'] }
  ];

  const { data: guests } = await supabase
    .from('event_guests')
    .insert(
      guestData.map(guest => ({
        event_id: event.id,
        guest_name: guest.name,
        phone: guest.phone,
        guest_tags: guest.tags,
        user_id: null
      }))
    )
    .select();

  const guestIds = guests?.map(g => g.id) || [];
  const taggedGuestIds = guests?.filter(g => g.guest_tags?.includes('vip')).map(g => g.id) || [];

  return {
    hostUserId,
    hostEmail: 'host-e2e@test.com',
    eventId: event.id,
    guestIds,
    taggedGuestIds
  };
}

async function cleanupHostTestData(context: TestHostContext) {
  // Clean up in reverse order
  await supabase.from('message_deliveries').delete().match({ guest_id: context.guestIds });
  await supabase.from('messages').delete().eq('event_id', context.eventId);
  await supabase.from('scheduled_messages').delete().eq('event_id', context.eventId);
  await supabase.from('event_guests').delete().eq('event_id', context.eventId);
  await supabase.from('events').delete().eq('id', context.eventId);
  await supabase.auth.admin.deleteUser(context.hostUserId);
}

async function simulateGuestMessageRead(guestId: string, messageId: string) {
  await supabase
    .from('message_deliveries')
    .update({ 
      status: 'delivered',
      read_at: new Date().toISOString()
    })
    .match({ guest_id: guestId, message_id: messageId });
}

async function simulateGuestResponse(page: any, eventId: string, guestId: string, originalMessageId: string, responseContent: string) {
  // This would typically involve navigating to guest view and posting response
  // For E2E testing, we'll create the response directly
  // Note: parent_message_id field doesn't exist in current schema - message threading not implemented
  await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      content: responseContent,
      // TODO: Implement message threading in future schema update
      message_type: 'direct'
    });
}

async function createMessageWithFailedDelivery(eventId: string, guestId: string) {
  const { data: message } = await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      content: 'Failed delivery test message',
      message_type: 'direct'
    })
    .select()
    .single();

  await supabase
    .from('message_deliveries')
    .insert({
      message_id: message.id,
      guest_id: guestId,
      status: 'failed',
      error_message: 'SMS delivery failed'
    });

  return message;
} 