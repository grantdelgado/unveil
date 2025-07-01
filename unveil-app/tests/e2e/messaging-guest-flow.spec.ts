/**
 * Guest Messaging Flow End-to-End Tests
 * 
 * Tests the complete guest workflow: Receives → Reads → Responds → Updates tracked
 * Validates guest isolation, tag-based filtering, and real-time functionality
 */

import { test, expect } from '@playwright/test';
import { supabase } from '@/lib/supabase';

interface TestGuestContext {
  hostUserId: string;
  eventId: string;
  guest1Id: string;
  guest1Phone: string;
  guest2Id: string;
  guest2Phone: string;
  guestWithoutTagsId: string;
  broadcastMessageId?: string;
  taggedMessageId?: string;
  directMessageId?: string;
}

test.describe('Guest Messaging Flow', () => {
  let context: TestGuestContext;

  test.beforeAll(async () => {
    context = await setupGuestTestData();
  });

  test.afterAll(async () => {
    await cleanupGuestTestData(context);
  });

  test.describe('Message Reception & Display', () => {
    test('guest can view broadcast messages sent to all guests', async ({ page }) => {
      // Create broadcast message from host
      const broadcastContent = 'Welcome everyone! We are thrilled you can join our special day.';
      const messageId = await createHostMessage(context.eventId, broadcastContent, 'broadcast');
      context.broadcastMessageId = messageId;

      // Navigate to guest event page
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      
      // Navigate to messages section
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Verify broadcast message is visible
      await expect(page.getByText(broadcastContent)).toBeVisible();
      
      // Verify message metadata
      await expect(page.getByText(/from host/i)).toBeVisible();
      await expect(page.getByText(/just now|minute ago/i)).toBeVisible();
    });

    test('guest only sees messages targeted to them via tags', async ({ page }) => {
      // Create VIP-only message
      const vipContent = 'Special VIP reception information for our closest family and friends.';
      const vipMessageId = await createHostMessage(context.eventId, vipContent, 'tags', ['vip']);
      context.taggedMessageId = vipMessageId;

      // Create family-only message  
      const familyContent = 'Family photo session details - please arrive 30 minutes early.';
      await createHostMessage(context.eventId, familyContent, 'tags', ['family']);

      // Guest 1 (has VIP tag) should see VIP message
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      await expect(page.getByText(vipContent)).toBeVisible();
      await expect(page.getByText(familyContent)).not.toBeVisible(); // Guest 1 doesn't have family tag
      
      // Guest 2 (has family tag) should see family message but not VIP
      await authenticateAsGuest(page, context.guest2Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      await expect(page.getByText(familyContent)).toBeVisible();
      await expect(page.getByText(vipContent)).not.toBeVisible(); // Guest 2 doesn't have VIP tag
    });

    test('guest cannot see messages from other events', async ({ page }) => {
      // Create another event with a different host
      const { data: otherEvent } = await supabase
        .from('events')
        .insert({
          title: 'Other Wedding',
          host_user_id: context.hostUserId, // Same host for simplicity
          event_date: '2025-07-01',
          location: 'Other Venue'
        })
        .select()
        .single();

      // Add guest to other event
      await supabase
        .from('event_guests')
        .insert({
          event_id: otherEvent.id,
          guest_name: 'Guest Other Event',
          phone: context.guest1Phone,
          user_id: null
        });

      // Create message in other event
      const otherEventContent = 'Message from other event - should not be visible';
      await createHostMessage(otherEvent.id, otherEventContent, 'broadcast');

      // Navigate to original event
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Verify guest cannot see message from other event
      await expect(page.getByText(otherEventContent)).not.toBeVisible();
      
      // Cleanup
      await supabase.from('event_guests').delete().eq('event_id', otherEvent.id);
      await supabase.from('messages').delete().eq('event_id', otherEvent.id);
      await supabase.from('events').delete().eq('id', otherEvent.id);
    });

    test('guest sees real-time message updates', async ({ page, context: browserContext }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Open host page in another browser context
      const hostPage = await browserContext.newPage();
      await authenticateAsHost(hostPage, context.hostUserId);
      await hostPage.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Send real-time message from host
      const realtimeContent = 'Just posted: Updated timeline for tomorrow\'s events!';
      await hostPage.getByLabel(/message content/i).fill(realtimeContent);
      await hostPage.getByRole('button', { name: /send now/i }).click();
      
      // Verify guest receives message in real-time
      await expect(page.getByText(realtimeContent)).toBeVisible({ timeout: 15000 });
      
      await hostPage.close();
    });
  });

  test.describe('Message Reading & Tracking', () => {
    test('guest can mark messages as read and tracking updates', async ({ page }) => {
      if (!context.broadcastMessageId) {
        test.skip('No broadcast message available');
      }

      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Click on message to open and mark as read
      await page.getByText(/welcome everyone.*thrilled/i).click();
      
      // Verify message detail view opens
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Close message (this should mark it as read)
      await page.getByRole('button', { name: /close/i }).click();
      
      // Verify read status is updated in UI
      await expect(page.getByTestId('message-read-indicator')).toHaveClass(/read/);
      
      // Verify read tracking in database
      const { data: delivery } = await supabase
        .from('message_deliveries')
        .select('read_at')
        .match({ 
          message_id: context.broadcastMessageId,
          guest_id: context.guest1Id 
        })
        .single();
      
      expect(delivery?.read_at).toBeTruthy();
    });

    test('guest sees unread message indicators', async ({ page }) => {
      // Create new unread message
      const unreadContent = 'New unread message for testing indicators';
      const unreadMessageId = await createHostMessage(context.eventId, unreadContent, 'broadcast');
      
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      
      // Verify unread indicator on messages button
      await expect(page.getByTestId('unread-messages-badge')).toBeVisible();
      
      // Navigate to messages
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Verify unread indicator on specific message
      const unreadMessage = page.locator('[data-testid="message-item"]').filter({ hasText: unreadContent });
      await expect(unreadMessage.getByTestId('unread-indicator')).toBeVisible();
    });

    test('guest can view message thread history', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Verify chronological message ordering
      const messages = page.locator('[data-testid="message-item"]');
      await expect(messages).toHaveCount.atLeast(2);
      
      // Verify oldest message appears first
      await expect(messages.first()).toContainText(/welcome everyone/i);
      
      // Test message history pagination if there are many messages
      if (await messages.count() > 10) {
        await expect(page.getByRole('button', { name: /load more/i })).toBeVisible();
      }
    });
  });

  test.describe('Message Responses', () => {
    test('guest can respond to host messages', async ({ page }) => {
      if (!context.broadcastMessageId) {
        test.skip('No message to respond to');
      }

      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Click on message to open
      await page.getByText(/welcome everyone/i).click();
      
      // Click reply button
      await page.getByRole('button', { name: /reply/i }).click();
      
      // Type response
      const responseContent = 'Thank you so much! We are incredibly excited to celebrate with you both!';
      await page.getByLabel(/your response/i).fill(responseContent);
      
      // Send response
      await page.getByRole('button', { name: /send reply/i }).click();
      
      // Verify success message
      await expect(page.getByText(/response sent/i)).toBeVisible();
      
      // Verify response appears in conversation
      await expect(page.getByText(responseContent)).toBeVisible();
      
      // Verify response is saved in database
      const { data: response } = await supabase
        .from('messages')
        .select('*')
        .eq('content', responseContent)
        .eq('parent_message_id', context.broadcastMessageId)
        .single();
      
      expect(response).toBeTruthy();
    });

    test('guest can send multiple responses in a conversation', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Open conversation
      await page.getByText(/welcome everyone/i).click();
      
      // Send first response
      await page.getByRole('button', { name: /reply/i }).click();
      await page.getByLabel(/your response/i).fill('First response in conversation');
      await page.getByRole('button', { name: /send reply/i }).click();
      
      await expect(page.getByText(/response sent/i)).toBeVisible();
      
      // Send second response
      await page.getByRole('button', { name: /reply/i }).click();
      await page.getByLabel(/your response/i).fill('Second response with additional thoughts');
      await page.getByRole('button', { name: /send reply/i }).click();
      
      await expect(page.getByText(/response sent/i)).toBeVisible();
      
      // Verify both responses are visible
      await expect(page.getByText('First response in conversation')).toBeVisible();
      await expect(page.getByText('Second response with additional thoughts')).toBeVisible();
    });

    test('guest response triggers real-time update for host', async ({ page, context: browserContext }) => {
      // Open host view in parallel
      const hostPage = await browserContext.newPage();
      await authenticateAsHost(hostPage, context.hostUserId);
      await hostPage.goto(`/host/events/${context.eventId}/messages`);
      
      // Guest sends response
      await authenticateAsGuest(page, context.guest2Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      await page.getByText(/welcome everyone/i).click();
      
      await page.getByRole('button', { name: /reply/i }).click();
      const liveResponseContent = 'This is a real-time response test!';
      await page.getByLabel(/your response/i).fill(liveResponseContent);
      await page.getByRole('button', { name: /send reply/i }).click();
      
      // Verify host receives real-time notification
      await expect(hostPage.getByText(liveResponseContent)).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('new-response-notification')).toBeVisible({ timeout: 5000 });
      
      await hostPage.close();
    });

    test('guest cannot edit or delete sent responses', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Find a sent response
      await page.getByText(/thank you so much.*excited/i).click();
      
      // Verify no edit or delete options are available
      await expect(page.getByRole('button', { name: /edit/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible();
      
      // Verify response text is not editable
      const responseText = page.getByText(/thank you so much.*excited/i);
      await expect(responseText).not.toHaveAttribute('contenteditable', 'true');
    });
  });

  test.describe('Guest Isolation & Security', () => {
    test('guest cannot access other guests responses', async ({ page }) => {
      // Create response from guest 2
      const guest2Response = 'Private response from guest 2 - should not be visible to guest 1';
      await createGuestResponse(context.eventId, context.guest2Id, context.broadcastMessageId!, guest2Response);
      
      // Login as guest 1
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Open message conversation
      await page.getByText(/welcome everyone/i).click();
      
      // Verify guest 1 cannot see guest 2's response
      await expect(page.getByText(guest2Response)).not.toBeVisible();
      
      // Verify guest 1 only sees their own responses
      await expect(page.getByText(/thank you so much.*excited/i)).toBeVisible(); // Guest 1's response
    });

    test('guest cannot access host compose or analytics pages', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      
      // Try to access host compose page
      await page.goto(`/host/events/${context.eventId}/messages/compose`);
      
      // Should be redirected or show access denied
      await expect(page.getByText(/access denied|not authorized|404/i)).toBeVisible();
      
      // Try to access analytics page
      await page.goto(`/host/events/${context.eventId}/messages/analytics`);
      
      // Should be redirected or show access denied
      await expect(page.getByText(/access denied|not authorized|404/i)).toBeVisible();
    });

    test('guest sees only their own RSVP and profile information', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      
      // Verify guest sees their own RSVP status
      await expect(page.getByTestId('guest-rsvp-status')).toBeVisible();
      
      // Verify guest name is displayed correctly
      await expect(page.getByText('Guest One')).toBeVisible();
      
      // Verify guest cannot see other guests' names or RSVP statuses
      await expect(page.getByText('Guest Two')).not.toBeVisible();
      await expect(page.getByText('Guest Three')).not.toBeVisible();
    });

    test('guest cannot manipulate URL parameters to access other data', async ({ page }) => {
      await authenticateAsGuest(page, context.guest1Phone);
      
      // Try to access another guest's data by manipulating URLs
      const otherEventId = 'fake-event-id-12345';
      await page.goto(`/guest/events/${otherEventId}/home`);
      
      // Should show error or redirect
      await expect(page.getByText(/event not found|access denied/i)).toBeVisible();
      
      // Try to access with different guest parameters
      await page.goto(`/guest/events/${context.eventId}/home?guestId=${context.guest2Id}`);
      
      // Should still show guest 1's information, not guest 2's
      await expect(page.getByText('Guest One')).toBeVisible();
      await expect(page.getByText('Guest Two')).not.toBeVisible();
    });
  });

  test.describe('Mobile & Responsive Experience', () => {
    test('guest messaging works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      
      // Verify mobile navigation
      await expect(page.getByRole('button', { name: /messages/i })).toBeVisible();
      
      // Navigate to messages
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Verify messages display properly on mobile
      await expect(page.getByText(/welcome everyone/i)).toBeVisible();
      
      // Test mobile message interaction
      await page.getByText(/welcome everyone/i).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Test mobile response input
      await page.getByRole('button', { name: /reply/i }).click();
      await page.getByLabel(/your response/i).fill('Mobile response test');
      await page.getByRole('button', { name: /send reply/i }).click();
      
      await expect(page.getByText(/response sent/i)).toBeVisible();
    });

    test('guest can use pull-to-refresh for message updates', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await authenticateAsGuest(page, context.guest1Phone);
      await page.goto(`/guest/events/${context.eventId}/home`);
      await page.getByRole('button', { name: /messages/i }).click();
      
      // Simulate pull-to-refresh gesture
      await page.touchscreen.tap(200, 100);
      await page.mouse.move(200, 100);
      await page.mouse.down();
      await page.mouse.move(200, 300, { steps: 10 });
      await page.mouse.up();
      
      // Verify refresh indicator appears
      await expect(page.getByTestId('pull-refresh-indicator')).toBeVisible({ timeout: 3000 });
      
      // Verify messages are refreshed
      await expect(page.getByText(/welcome everyone/i)).toBeVisible();
    });
  });
});

// Helper functions

async function setupGuestTestData(): Promise<TestGuestContext> {
  // Create host user
  const { data: hostAuth } = await supabase.auth.signUp({
    email: 'guest-e2e-host@test.com',
    password: 'testpassword123'
  });

  const hostUserId = hostAuth.user!.id;

  // Create event
  const { data: event } = await supabase
    .from('events')
    .insert({
      title: 'Guest E2E Test Wedding',
      host_user_id: hostUserId,
      event_date: '2025-06-20',
      location: 'Guest Test Venue'
    })
    .select()
    .single();

  // Create test guests
  const { data: guests } = await supabase
    .from('event_guests')
    .insert([
      {
        event_id: event.id,
        guest_name: 'Guest One',
        phone: '+14155558001',
        guest_tags: ['vip'],
        user_id: null
      },
      {
        event_id: event.id,
        guest_name: 'Guest Two',
        phone: '+14155558002',
        guest_tags: ['family'],
        user_id: null
      },
      {
        event_id: event.id,
        guest_name: 'Guest Three',
        phone: '+14155558003',
        guest_tags: null,
        user_id: null
      }
    ])
    .select();

  return {
    hostUserId,
    eventId: event.id,
    guest1Id: guests![0].id,
    guest1Phone: '+14155558001',
    guest2Id: guests![1].id,
    guest2Phone: '+14155558002',
    guestWithoutTagsId: guests![2].id
  };
}

async function cleanupGuestTestData(context: TestGuestContext) {
  await supabase.from('message_deliveries').delete().in('guest_id', [context.guest1Id, context.guest2Id, context.guestWithoutTagsId]);
  await supabase.from('messages').delete().eq('event_id', context.eventId);
  await supabase.from('event_guests').delete().eq('event_id', context.eventId);
  await supabase.from('events').delete().eq('id', context.eventId);
  await supabase.auth.admin.deleteUser(context.hostUserId);
}

async function createHostMessage(eventId: string, content: string, type: 'broadcast' | 'tags' | 'direct', tags?: string[]): Promise<string> {
  const messageData: any = {
    event_id: eventId,
    content: content,
    message_type: 'announcement'
  };

  if (type === 'tags' && tags) {
    messageData.target_tags = tags;
  }

  const { data: message } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  return message.id;
}

async function createGuestResponse(eventId: string, guestId: string, parentMessageId: string, content: string) {
  await supabase
    .from('messages')
    .insert({
      event_id: eventId,
      content: content,
      parent_message_id: parentMessageId,
      message_type: 'direct'
    });
}

async function authenticateAsGuest(page: any, phone: string) {
  // Navigate to login with phone
  await page.goto(`/login?phone=${encodeURIComponent(phone)}`);
  
  // For E2E testing, simulate successful phone auth
  // This would normally involve OTP verification
  await page.getByRole('button', { name: /continue/i }).click();
  
  // Wait for authentication to complete
  await page.waitForURL('**/select-event');
}

async function authenticateAsHost(page: any, userId: string) {
  // Host authentication would typically use email/password
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('guest-e2e-host@test.com');
  await page.getByLabel(/password/i).fill('testpassword123');
  await page.getByRole('button', { name: /sign in/i }).click();
  
  await page.waitForURL('**/host/**');
} 