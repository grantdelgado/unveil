/**
 * Integration tests for removed guest access control
 * Tests the critical security fix for removed_at filtering
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
      persistSession: false
    }
  }
);

describe('Event Access Control - Removed Guests', () => {
  let testEventId: string;
  let testUserId: string;
  let testGuestId: string;
  let hostUserId: string;

  beforeAll(async () => {
    // Create test host user
    const { data: hostUser, error: hostError } = await supabase.auth.admin.createUser({
      email: 'test-host@example.com',
      phone: '+1234567890',
      email_confirm: true,
      phone_confirm: true
    });
    expect(hostError).toBeNull();
    hostUserId = hostUser.user.id;

    // Create test guest user
    const { data: guestUser, error: guestError } = await supabase.auth.admin.createUser({
      email: 'test-guest@example.com', 
      phone: '+1234567891',
      email_confirm: true,
      phone_confirm: true
    });
    expect(guestError).toBeNull();
    testUserId = guestUser.user.id;

    // Insert users into users table
    await supabase.from('users').upsert([
      { id: hostUserId, phone: '+1234567890', full_name: 'Test Host' },
      { id: testUserId, phone: '+1234567891', full_name: 'Test Guest' }
    ]);

    // Create test event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: 'Test Event - Removed Guest Access',
        event_date: '2025-12-31',
        host_user_id: hostUserId
      })
      .select('id')
      .single();
    expect(eventError).toBeNull();
    testEventId = event.id;

    // Create test guest record
    const { data: guest, error: guestInsertError } = await supabase
      .from('event_guests')
      .insert({
        event_id: testEventId,
        user_id: testUserId,
        phone: '+1234567891',
        guest_name: 'Test Guest'
      })
      .select('id')
      .single();
    expect(guestInsertError).toBeNull();
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testEventId) {
      await supabase.from('events').delete().eq('id', testEventId);
    }
    if (hostUserId) {
      await supabase.auth.admin.deleteUser(hostUserId);
      await supabase.from('users').delete().eq('id', hostUserId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
      await supabase.from('users').delete().eq('id', testUserId);
    }
  });

  beforeEach(async () => {
    // Reset guest to active state before each test
    await supabase
      .from('event_guests')
      .update({ removed_at: null })
      .eq('id', testGuestId);
  });

  describe('Active Guest Access', () => {
    it('should allow active guest to see event in get_user_events', async () => {
      const { data, error } = await supabase
        .rpc('get_user_events', { user_id_param: testUserId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.some(event => event.id === testEventId)).toBe(true);
    });

    it('should allow active guest access via is_event_guest function', async () => {
      // Set RLS context to guest user
      await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'test-guest@example.com'
      });

      const { data, error } = await supabase
        .rpc('is_event_guest', { p_event_id: testEventId });

      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    it('should allow active guest access via can_access_event function', async () => {
      const { data, error } = await supabase
        .rpc('can_access_event', { p_event_id: testEventId });

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  describe('Removed Guest Access (Security Fix)', () => {
    beforeEach(async () => {
      // Remove the guest (soft delete)
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);
    });

    it('should NOT show event to removed guest in get_user_events', async () => {
      const { data, error } = await supabase
        .rpc('get_user_events', { user_id_param: testUserId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      
      // Event should not appear for removed guest
      const hasEvent = data!.some(event => event.id === testEventId);
      expect(hasEvent).toBe(false);
    });

    it('should return false for removed guest via is_event_guest function', async () => {
      const { data, error } = await supabase
        .rpc('is_event_guest', { p_event_id: testEventId });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('should return false for removed guest via can_access_event function', async () => {
      const { data, error } = await supabase
        .rpc('can_access_event', { p_event_id: testEventId });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('should prevent removed guest from seeing messages', async () => {
      // First, create a test message
      const { data: message } = await supabase
        .from('messages')
        .insert({
          event_id: testEventId,
          sender_user_id: hostUserId,
          content: 'Test message'
        })
        .select('id')
        .single();

      // Try to query messages as removed guest - should get empty result
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', testEventId);

      // Due to RLS policies, removed guest should not see messages
      expect(error).toBeNull();
      expect(messages).toEqual([]);

      // Clean up
      if (message) {
        await supabase.from('messages').delete().eq('id', message.id);
      }
    });
  });

  describe('Guest Restoration', () => {
    it('should restore access when guest is re-added (removed_at cleared)', async () => {
      // Remove guest
      await supabase
        .from('event_guests')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', testGuestId);

      // Verify no access
      const { data: eventsRemoved } = await supabase
        .rpc('get_user_events', { user_id_param: testUserId });
      expect(eventsRemoved!.some(event => event.id === testEventId)).toBe(false);

      // Restore guest (clear removed_at)
      await supabase
        .from('event_guests')
        .update({ removed_at: null })
        .eq('id', testGuestId);

      // Verify access restored
      const { data: eventsRestored } = await supabase
        .rpc('get_user_events', { user_id_param: testUserId });
      expect(eventsRestored!.some(event => event.id === testEventId)).toBe(true);
    });
  });

  describe('Host Access (Should Always Work)', () => {
    it('should always allow host access regardless of guest status', async () => {
      const { data, error } = await supabase
        .rpc('get_user_events', { user_id_param: hostUserId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.some(event => event.id === testEventId)).toBe(true);
    });

    it('should return true for host via is_event_host function', async () => {
      const { data, error } = await supabase
        .rpc('is_event_host', { p_event_id: testEventId });

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });
});
