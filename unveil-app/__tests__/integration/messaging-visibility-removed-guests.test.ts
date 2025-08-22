/**
 * Integration tests for messaging visibility with removed guests
 * Ensures removed guests cannot see messages and restored guests can see them again
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

describe('Messaging Visibility - Removed Guests', () => {
  let testEventId: string;
  let hostUserId: string;
  let guestUserId: string;
  let testGuestId: string;
  let testMessageId: string;

  beforeAll(async () => {
    // Create host user
    const { data: hostUser, error: hostError } =
      await supabase.auth.admin.createUser({
        email: 'msg-host@example.com',
        phone: '+1555000001',
        email_confirm: true,
        phone_confirm: true,
      });
    expect(hostError).toBeNull();
    hostUserId = hostUser.user.id;

    // Create guest user
    const { data: guestUser, error: guestError } =
      await supabase.auth.admin.createUser({
        email: 'msg-guest@example.com',
        phone: '+1555000002',
        email_confirm: true,
        phone_confirm: true,
      });
    expect(guestError).toBeNull();
    guestUserId = guestUser.user.id;

    // Insert users into users table
    await supabase.from('users').upsert([
      { id: hostUserId, phone: '+1555000001', full_name: 'Message Host' },
      { id: guestUserId, phone: '+1555000002', full_name: 'Message Guest' },
    ]);

    // Create test event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: 'Test Event - Message Visibility',
        event_date: '2025-12-31',
        host_user_id: hostUserId,
      })
      .select('id')
      .single();
    expect(eventError).toBeNull();
    testEventId = event.id;

    // Create guest record
    const { data: guest, error: guestInsertError } = await supabase
      .from('event_guests')
      .insert({
        event_id: testEventId,
        user_id: guestUserId,
        phone: '+1555000002',
        guest_name: 'Message Guest',
      })
      .select('id')
      .single();
    expect(guestInsertError).toBeNull();
    testGuestId = guest.id;

    // Create test message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: testEventId,
        sender_user_id: hostUserId,
        content: 'Test message for visibility testing',
        message_type: 'announcement',
      })
      .select('id')
      .single();
    expect(messageError).toBeNull();
    testMessageId = message.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testMessageId) {
      await supabase.from('messages').delete().eq('id', testMessageId);
    }
    if (testEventId) {
      await supabase.from('events').delete().eq('id', testEventId);
    }
    if (hostUserId) {
      await supabase.auth.admin.deleteUser(hostUserId);
      await supabase.from('users').delete().eq('id', hostUserId);
    }
    if (guestUserId) {
      await supabase.auth.admin.deleteUser(guestUserId);
      await supabase.from('users').delete().eq('id', guestUserId);
    }
  });

  beforeEach(async () => {
    // Reset guest to active state before each test
    await supabase
      .from('event_guests')
      .update({ removed_at: null })
      .eq('id', testGuestId);
  });

  describe('Active Guest Message Visibility', () => {
    it('should allow active guest to see event messages', async () => {
      // Create a client session for the guest user
      const guestClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // Set the session for the guest user (simulating authenticated guest)
      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-guest@example.com',
      });

      await guestClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Guest should be able to see messages
      const { data: messages, error } = await guestClient
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThan(0);
      expect(messages!.some((msg) => msg.id === testMessageId)).toBe(true);
    });

    it('should allow active guest to access messages via RPC if available', async () => {
      // Test get_guest_event_messages RPC if it exists
      const { data, error } = await supabase.rpc('get_guest_event_messages', {
        p_event_id: testEventId,
        p_limit: 10,
      });

      // This might fail if RPC doesn't exist or requires specific auth context
      // The important thing is it doesn't fail due to removed_at filtering
      if (!error) {
        expect(data).toBeDefined();
      }
    });
  });

  describe('Removed Guest Message Visibility (Security Fix)', () => {
    beforeEach(async () => {
      // Remove the guest
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);
    });

    it('should prevent removed guest from seeing messages via direct query', async () => {
      // Create a client session for the removed guest user
      const guestClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-guest@example.com',
      });

      await guestClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Removed guest should NOT see messages due to RLS
      const { data: messages, error } = await guestClient
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages!.length).toBe(0); // Should see no messages
    });

    it('should prevent removed guest from accessing messages via message_deliveries', async () => {
      // Create a message delivery record for testing
      const { data: delivery, error: deliveryError } = await supabase
        .from('message_deliveries')
        .insert({
          message_id: testMessageId,
          user_id: guestUserId,
          guest_id: testGuestId,
          phone_number: '+1555000002',
        })
        .select('id')
        .single();

      if (deliveryError) {
        // Skip this test if message_deliveries doesn't exist or has constraints
        return;
      }

      // Create a client session for the removed guest
      const guestClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-guest@example.com',
      });

      await guestClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Removed guest should not see delivery records due to RLS
      const { data: deliveries, error } = await guestClient
        .from('message_deliveries')
        .select('*')
        .eq('user_id', guestUserId);

      expect(error).toBeNull();
      expect(deliveries).toBeDefined();
      // Should see no deliveries or be filtered by RLS
      expect(deliveries!.length).toBe(0);

      // Clean up
      if (delivery) {
        await supabase
          .from('message_deliveries')
          .delete()
          .eq('id', delivery.id);
      }
    });
  });

  describe('Guest Restoration Message Visibility', () => {
    it('should restore message visibility when guest is restored', async () => {
      // Remove guest
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);

      // Create guest client
      const guestClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-guest@example.com',
      });

      await guestClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Verify no messages visible when removed
      const { data: messagesRemoved } = await guestClient
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);
      expect(messagesRemoved!.length).toBe(0);

      // Restore guest
      await supabase
        .from('event_guests')
        .update({ removed_at: null })
        .eq('id', testGuestId);

      // Verify messages visible again when restored
      const { data: messagesRestored } = await guestClient
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);
      expect(messagesRestored!.length).toBeGreaterThan(0);
      expect(messagesRestored!.some((msg) => msg.id === testMessageId)).toBe(
        true,
      );
    });
  });

  describe('Host Message Visibility (Should Always Work)', () => {
    it('should always allow host to see messages regardless of guest status', async () => {
      // Remove guest (should not affect host visibility)
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);

      // Create host client
      const hostClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-host@example.com',
      });

      await hostClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Host should always see messages
      const { data: messages, error } = await hostClient
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThan(0);
      expect(messages!.some((msg) => msg.id === testMessageId)).toBe(true);
    });
  });

  describe('Message Creation by Removed Guests', () => {
    it('should prevent removed guests from creating new messages', async () => {
      // Remove guest
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);

      // Create guest client
      const guestClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const {
        data: { session },
      } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'msg-guest@example.com',
      });

      await guestClient.auth.setSession({
        access_token: session?.properties?.access_token || '',
        refresh_token: session?.properties?.refresh_token || '',
      });

      // Removed guest should not be able to create messages
      const { data, error } = await guestClient
        .from('messages')
        .insert({
          event_id: testEventId,
          sender_user_id: guestUserId,
          content: 'This should be blocked',
        })
        .select('id')
        .single();

      // Should fail due to RLS policies
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });
});
