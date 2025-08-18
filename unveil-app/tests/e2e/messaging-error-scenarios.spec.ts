/**
 * Messaging Error Scenario Tests
 * 
 * Tests error handling and recovery for:
 * - SMS delivery failures and fallback logic
 * - Push notification failures and SMS fallback
 * - Network interruptions during message sending
 * - Invalid guest or event data handling
 * - CRON processor error recovery
 */

import { test, expect } from '@playwright/test';
import { supabase } from '@/lib/supabase';

interface ErrorTestContext {
  hostUserId: string;
  eventId: string;
  validGuestId: string;
  invalidGuestId: string;
  validGuestPhone: string;
  invalidGuestPhone: string;
}

test.describe('Messaging Error Scenarios', () => {
  let context: ErrorTestContext;

  test.beforeAll(async () => {
    context = await setupErrorTestData();
  });

  test.afterAll(async () => {
    await cleanupErrorTestData(context);
  });

  test.describe('SMS Delivery Failures', () => {
    test('handles SMS delivery failure with proper error tracking', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Compose message to invalid phone number
      const failureTestMessage = 'This message should fail SMS delivery due to invalid phone';
      await page.getByLabel(/message content/i).fill(failureTestMessage);
      
      // Mock SMS delivery failure by using invalid phone number
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Should still show success for message creation
      await expect(page.getByText(/message sent successfully/i)).toBeVisible({ timeout: 10000 });
      
      // Navigate to messages to check delivery status
      await page.goto(`/host/events/${context.eventId}/messages`);
      await page.getByText(failureTestMessage.substring(0, 30)).click();
      
      // Verify delivery failure is tracked
      await expect(page.getByText(/delivery failed/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: /retry delivery/i })).toBeVisible();
      
      // Verify error details are logged
      const { data: delivery } = await supabase
        .from('message_deliveries')
        .select('status, error_message')
        .eq('guest_id', context.invalidGuestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      expect(delivery?.status).toBe('failed');
      expect(delivery?.error_message).toBeTruthy();
    });

    test('SMS fallback works when push notifications fail', async ({ page }) => {
      // Create guest with valid phone but simulate push token failure
      const testMessage = 'Testing push failure fallback to SMS';
      
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      await page.getByLabel(/message content/i).fill(testMessage);
      await page.getByRole('button', { name: /send now/i }).click();
      
      await expect(page.getByText(/message sent successfully/i)).toBeVisible();
      
      // Simulate push delivery failure
      await simulatePushDeliveryFailure(context.validGuestId);
      
      // Trigger message processing
      await triggerMessageProcessing();
      
      // Verify SMS fallback is attempted
      const { data: deliveries } = await supabase
        .from('message_deliveries')
        .select('delivery_method, status, error_message')
        .eq('guest_id', context.validGuestId)
        .order('created_at', { ascending: false })
        .limit(2);
      
      // Should have both push (failed) and SMS (attempted) deliveries
      expect(deliveries).toHaveLength(2);
      
      const pushDelivery = deliveries?.find(d => d.delivery_method === 'push');
      const smsDelivery = deliveries?.find(d => d.delivery_method === 'sms');
      
      expect(pushDelivery?.status).toBe('failed');
      expect(smsDelivery?.status).toBeOneOf(['sent', 'delivered']);
    });

    test('retry mechanism works for failed SMS deliveries', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Create a failed delivery to retry
      const retryMessage = await createMessageWithFailedSMS(context.eventId, context.validGuestId);
      
      await page.reload();
      await page.getByText(/failed SMS test message/i).click();
      
      // Click retry button
      await page.getByRole('button', { name: /retry delivery/i }).click();
      
      // Confirm retry
      await page.getByRole('button', { name: /confirm retry/i }).click();
      
      await expect(page.getByText(/retry initiated/i)).toBeVisible();
      
      // Verify retry attempt is logged
      const { data: retryAttempts } = await supabase
        .from('message_deliveries')
        .select('*')
        .eq('message_id', retryMessage.id)
        .eq('guest_id', context.validGuestId);
      
      expect(retryAttempts).toHaveLength.atLeast(2); // Original + retry
    });

    test('SMS rate limiting is handled gracefully', async ({ page }) => {
      // Send multiple messages rapidly to trigger rate limiting
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      const rapidMessages = 5;
      for (let i = 0; i < rapidMessages; i++) {
        await page.getByLabel(/message content/i).fill(`Rapid fire message ${i + 1}`);
        await page.getByRole('button', { name: /send now/i }).click();
        
        if (i < rapidMessages - 1) {
          await expect(page.getByText(/message sent successfully/i)).toBeVisible();
          await page.getByLabel(/message content/i).clear();
        }
      }
      
      // Check that rate limiting is handled without user-facing errors
      await expect(page.getByText(/rate limit.*please wait/i)).toBeVisible({ timeout: 5000 });
      
      // Verify some messages are queued for later delivery
      const { data: queuedMessages } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('event_id', context.eventId)
        .eq('status', 'queued');
      
      expect(queuedMessages).toHaveLength.atLeast(1);
    });
  });

  test.describe('Network Interruption Handling', () => {
    test('handles network failure during message composition', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Fill message
      await page.getByLabel(/message content/i).fill('Network interruption test message');
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to send message
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify error handling
      await expect(page.getByText(/network error|connection failed/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
      
      // Restore network
      await page.unroute('**/api/**');
      
      // Retry sending
      await page.getByRole('button', { name: /retry/i }).click();
      
      // Verify success after retry
      await expect(page.getByText(/message sent successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('real-time connection recovers from network interruption', async ({ page, context: browserContext }) => {
      // Set up guest page with real-time connection
      const guestPage = await browserContext.newPage();
      await authenticateAsGuest(guestPage, context.validGuestPhone);
      await guestPage.goto(`/guest/events/${context.eventId}/home`);
      await guestPage.getByRole('button', { name: /messages/i }).click();
      
      // Send initial message to verify connection
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      const beforeInterruptionMessage = 'Before network interruption';
      await page.getByLabel(/message content/i).fill(beforeInterruptionMessage);
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Verify guest receives message
      await expect(guestPage.getByText(beforeInterruptionMessage)).toBeVisible({ timeout: 10000 });
      
      // Simulate network interruption on guest page
      await guestPage.route('**/realtime/**', route => route.abort());
      
      // Send message during interruption
      await page.getByLabel(/message content/i).clear();
      const duringInterruptionMessage = 'During network interruption';
      await page.getByLabel(/message content/i).fill(duringInterruptionMessage);
      await page.getByRole('button', { name: /send now/i }).click();
      
      // Wait a moment
      await page.waitForTimeout(2000);
      
      // Restore network connection
      await guestPage.unroute('**/realtime/**');
      
      // Verify connection recovery and message appears
      await expect(guestPage.getByText(duringInterruptionMessage)).toBeVisible({ timeout: 15000 });
      
      await guestPage.close();
    });

    test('offline mode gracefully degrades functionality', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Go offline
      await page.context().setOffline(true);
      
      // Try to navigate to compose
      await page.getByRole('button', { name: /compose/i }).click();
      
      // Verify offline indicator
      await expect(page.getByText(/offline|no connection/i)).toBeVisible({ timeout: 5000 });
      
      // Verify functionality is appropriately disabled
      await expect(page.getByRole('button', { name: /send now/i })).toBeDisabled();
      
      // Go back online
      await page.context().setOffline(false);
      
      // Verify functionality is restored
      await expect(page.getByText(/online|connected/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /send now/i })).not.toBeDisabled();
    });
  });

  test.describe('Invalid Data Handling', () => {
    test('handles invalid guest data gracefully', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      
      // Try to send message to event with invalid guest
      const invalidMessage = await createMessageForInvalidGuest(context.eventId);
      
      // Trigger processing
      await triggerMessageProcessing();
      
      // Navigate to messages and check status
      await page.goto(`/host/events/${context.eventId}/messages`);
      await page.getByText(/invalid guest test/i).click();
      
      // Verify error handling
      await expect(page.getByText(/delivery failed.*invalid guest/i)).toBeVisible();
      
      // Verify error is logged properly
      const { data: delivery } = await supabase
        .from('message_deliveries')
        .select('status, error_message')
        .eq('message_id', invalidMessage.id)
        .single();
      
      expect(delivery?.status).toBe('failed');
      expect(delivery?.error_message).toContain('guest');
    });

    test('validates message content before sending', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Try to send empty message
      await page.getByRole('button', { name: /send now/i }).click();
      
      await expect(page.getByText(/message content.*required/i)).toBeVisible();
      
      // Try to send message that's too long
      const longMessage = 'A'.repeat(2000); // Assuming 1600 char limit
      await page.getByLabel(/message content/i).fill(longMessage);
      await page.getByRole('button', { name: /send now/i }).click();
      
      await expect(page.getByText(/message.*too long|character limit/i)).toBeVisible();
      
      // Try to send valid message
      await page.getByLabel(/message content/i).clear();
      await page.getByLabel(/message content/i).fill('Valid message content');
      await page.getByRole('button', { name: /send now/i }).click();
      
      await expect(page.getByText(/message sent successfully/i)).toBeVisible();
    });

    test('handles unauthorized access attempts', async ({ page }) => {
      // Try to access another event's messages
      const unauthorizedEventId = 'unauthorized-event-12345';
      
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${unauthorizedEventId}/messages`);
      
      // Should be redirected or show error
      await expect(page.getByText(/not found|access denied|unauthorized/i)).toBeVisible();
      
      // Try to send message to unauthorized event
      await page.goto(`/host/events/${unauthorizedEventId}/messages`);
      
      await expect(page.getByText(/not found|access denied|unauthorized/i)).toBeVisible();
    });

    test('validates tag targeting with non-existent tags', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      await page.getByLabel(/message content/i).fill('Tag targeting test');
      
      // Switch to tag targeting
      await page.getByRole('button', { name: /target by tags/i }).click();
      
      // Try to use non-existent tag
      await page.getByLabel(/tags/i).fill('nonexistent-tag');
      
      // Should show no recipients found
      await expect(page.getByText(/no recipients.*found|0 recipients/i)).toBeVisible();
      
      // Should prevent sending
      await page.getByRole('button', { name: /send now/i }).click();
      await expect(page.getByText(/no recipients.*selected/i)).toBeVisible();
    });
  });

  test.describe('CRON Processor Error Recovery', () => {
    test('CRON processor handles database connection errors', async ({ page }) => {
      // Create scheduled messages
      const { data: scheduledMessage } = await supabase
        .from('scheduled_messages')
        .insert({
          event_id: context.eventId,
          content: 'CRON error recovery test',
          send_at: new Date().toISOString(),
          status: 'scheduled',
          target_all_guests: true
        })
        .select()
        .single();
      
      // Simulate CRON processing with error
      const response = await fetch('/api/cron/process-messages', {
        method: 'POST',
        headers: {
          'X-Simulate-Error': 'database-connection'
        }
      });
      
      // CRON should handle error gracefully
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.errors).toBeDefined();
      expect(result.retryCount).toBeGreaterThan(0);
      
      // Message should remain in scheduled state for retry
      const { data: messageAfterError } = await supabase
        .from('scheduled_messages')
        .select('status, retry_count')
        .eq('id', scheduledMessage.id)
        .single();
      
      expect(messageAfterError?.status).toBe('scheduled');
      expect(messageAfterError?.retry_count).toBeGreaterThan(0);
    });

    test('CRON processor respects maximum retry limits', async ({ page }) => {
      // Create message that will consistently fail
      const { data: failingMessage } = await supabase
        .from('scheduled_messages')
        .insert({
          event_id: 'invalid-event-id-for-retry-test',
          content: 'This message should fail and exhaust retries',
          send_at: new Date().toISOString(),
          status: 'scheduled',
          target_all_guests: true,
          retry_count: 2 // Already has 2 retries
        })
        .select()
        .single();
      
      // Process with final retry
      await fetch('/api/cron/process-messages', {
        method: 'POST'
      });
      
      // Message should be marked as permanently failed
      const { data: finalState } = await supabase
        .from('scheduled_messages')
        .select('status, retry_count')
        .eq('id', failingMessage.id)
        .single();
      
      expect(finalState?.status).toBe('failed');
      expect(finalState?.retry_count).toBe(3); // Max retries reached
    });

    test('CRON processor handles partial batch failures', async ({ page }) => {
      // Create mix of valid and invalid scheduled messages
      const validMessageData = {
        event_id: context.eventId,
        content: 'Valid message for batch test',
        send_at: new Date().toISOString(),
        status: 'scheduled',
        target_all_guests: true
      };
      
      const invalidMessageData = {
        event_id: 'invalid-event-batch-test',
        content: 'Invalid message for batch test',
        send_at: new Date().toISOString(),
        status: 'scheduled',
        target_all_guests: true
      };
      
      const { data: validMessage } = await supabase
        .from('scheduled_messages')
        .insert(validMessageData)
        .select()
        .single();
      
      const { data: invalidMessage } = await supabase
        .from('scheduled_messages')
        .insert(invalidMessageData)
        .select()
        .single();
      
      // Process batch
      const response = await fetch('/api/cron/process-messages', {
        method: 'POST'
      });
      
      const result = await response.json();
      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      
      // Verify individual message states
      const { data: processedMessages } = await supabase
        .from('scheduled_messages')
        .select('id, status')
        .in('id', [validMessage.id, invalidMessage.id]);
      
      const validProcessed = processedMessages?.find(m => m.id === validMessage.id);
      const invalidProcessed = processedMessages?.find(m => m.id === invalidMessage.id);
      
      expect(validProcessed?.status).toBe('sent');
      expect(invalidProcessed?.status).toBe('failed');
    });

    test('CRON processor timeout handling', async ({ page }) => {
      // Create many scheduled messages to test timeout
      const messageCount = 50;
      const messageInserts = [];
      
      for (let i = 0; i < messageCount; i++) {
        messageInserts.push({
          event_id: context.eventId,
          content: `Timeout test message ${i + 1}`,
          send_at: new Date().toISOString(),
          status: 'scheduled',
          target_all_guests: true
        });
      }
      
      await supabase
        .from('scheduled_messages')
        .insert(messageInserts);
      
      // Process with simulated timeout
      const startTime = Date.now();
      const response = await fetch('/api/cron/process-messages', {
        method: 'POST',
        headers: {
          'X-Simulate-Timeout': '30000' // 30 second timeout
        }
      });
      const endTime = Date.now();
      
      // Should complete within timeout period
      expect(endTime - startTime).toBeLessThan(35000);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.timedOut).toBe(true);
      expect(result.processed).toBeGreaterThan(0); // Some messages should be processed
    });
  });

  test.describe('Error Recovery & User Experience', () => {
    test('error boundaries prevent application crashes', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      
      // Navigate to messages page
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Simulate component error by corrupting data
      await page.route('**/api/messages/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Simulated component error' })
        });
      });
      
      // Refresh to trigger error
      await page.reload();
      
      // Error boundary should catch and display fallback
      await expect(page.getByText(/something went wrong|error occurred/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /try again|retry/i })).toBeVisible();
      
      // Restore normal behavior
      await page.unroute('**/api/messages/**');
      
      // Retry should work
      await page.getByRole('button', { name: /try again|retry/i }).click();
      await expect(page.getByText(/messages/i)).toBeVisible({ timeout: 10000 });
    });

    test('graceful degradation when features are unavailable', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Simulate analytics service unavailable
      await page.route('**/api/analytics/**', route => route.abort());
      
      // Navigate to analytics
      await page.goto(`/host/events/${context.eventId}/messages/analytics`);
      
      // Should show degraded experience, not crash
      await expect(page.getByText(/analytics.*unavailable|unable to load analytics/i)).toBeVisible({ timeout: 10000 });
      
      // Basic message functionality should still work
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      await page.getByLabel(/message content/i).fill('Graceful degradation test');
      await page.getByRole('button', { name: /send now/i }).click();
      
      await expect(page.getByText(/message sent successfully/i)).toBeVisible();
    });

    test('user-friendly error messages for common scenarios', async ({ page }) => {
      await authenticateAsHost(page, context.hostUserId);
      await page.goto(`/host/events/${context.eventId}/messages`);
      
      // Test various validation errors
      const errorScenarios = [
        {
          action: async () => {
            await page.getByRole('button', { name: /send now/i }).click();
          },
          expectedError: /message content.*required/i
        },
        {
          action: async () => {
            await page.getByLabel(/message content/i).fill('Valid message');
            await page.getByRole('button', { name: /target by tags/i }).click();
            await page.getByRole('button', { name: /send now/i }).click();
          },
          expectedError: /no recipients.*selected|select at least one/i
        }
      ];
      
      for (const scenario of errorScenarios) {
        await scenario.action();
        await expect(page.getByText(scenario.expectedError)).toBeVisible();
        
        // Clear state for next test
        await page.getByLabel(/message content/i).clear();
        await page.reload();
      }
    });
  });
});

// Helper functions

async function setupErrorTestData(): Promise<ErrorTestContext> {
  const { data: hostAuth } = await supabase.auth.signUp({
    email: 'error-test-host@test.com',
    password: 'testpassword123'
  });

  const hostUserId = hostAuth.user!.id;

  const { data: event } = await supabase
    .from('events')
    .insert({
      title: 'Error Test Wedding',
      host_user_id: hostUserId,
      event_date: '2025-08-01',
      location: 'Error Test Venue'
    })
    .select()
    .single();

  // Create valid and invalid guests
  const { data: validGuest } = await supabase
    .from('event_guests')
    .insert({
      event_id: event.id,
      guest_name: 'Valid Guest',
      phone: '+14155557001',
      guest_tags: ['family'],
      user_id: null
    })
    .select()
    .single();

  const { data: invalidGuest } = await supabase
    .from('event_guests')
    .insert({
      event_id: event.id,
      guest_name: 'Invalid Guest',
      phone: 'invalid-phone-number',
      guest_tags: ['test'],
      user_id: null
    })
    .select()
    .single();

  return {
    hostUserId,
    eventId: event.id,
    validGuestId: validGuest.id,
    invalidGuestId: invalidGuest.id,
    validGuestPhone: '+14155557001',
    invalidGuestPhone: 'invalid-phone-number'
  };
}

async function cleanupErrorTestData(context: ErrorTestContext) {
  await supabase.from('message_deliveries').delete().in('guest_id', [context.validGuestId, context.invalidGuestId]);
  await supabase.from('messages').delete().eq('event_id', context.eventId);
  await supabase.from('scheduled_messages').delete().eq('event_id', context.eventId);
  await supabase.from('event_guests').delete().eq('event_id', context.eventId);
  await supabase.from('events').delete().eq('id', context.eventId);
  await supabase.auth.admin.deleteUser(context.hostUserId);
}

async function createMessageWithFailedSMS(eventId: string, guestId: string) {
  const { data: message } = await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      content: 'Failed SMS test message',
      message_type: 'direct'
    })
    .select()
    .single();

  await supabase
    .from('message_deliveries')
    .insert({
      message_id: message.id,
      guest_id: guestId,
      delivery_method: 'sms',
      status: 'failed',
      error_message: 'SMS delivery failed - invalid number'
    });

  return message;
}

async function simulatePushDeliveryFailure(guestId: string) {
  // This would normally involve mocking the push notification service
  // For testing, we'll create a failed delivery record
  const { data: latestMessage } = await supabase
    .from('messages')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  await supabase
    .from('message_deliveries')
    .insert({
      message_id: latestMessage.id,
      guest_id: guestId,
      delivery_method: 'push',
      status: 'failed',
      error_message: 'Push notification failed - invalid token'
    });
}

async function createMessageForInvalidGuest(eventId: string) {
  const { data: message } = await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      content: 'Invalid guest test message',
      message_type: 'direct'
    })
    .select()
    .single();

  // Create delivery record with non-existent guest
  await supabase
    .from('message_deliveries')
    .insert({
      message_id: message.id,
      guest_id: 'invalid-guest-id-12345',
      delivery_method: 'sms',
      status: 'pending'
    });

  return message;
}

async function triggerMessageProcessing() {
  await fetch('/api/cron/process-messages', {
    method: 'POST'
  });
}

async function authenticateAsHost(page: any, userId: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('error-test-host@test.com');
  await page.getByLabel(/password/i).fill('testpassword123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/host/**');
}

async function authenticateAsGuest(page: any, phone: string) {
  await page.goto(`/login?phone=${encodeURIComponent(phone)}`);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL('**/select-event');
} 