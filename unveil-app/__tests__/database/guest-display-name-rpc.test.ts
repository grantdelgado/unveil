/**
 * Integration tests for guest display name RPC function
 * Tests the actual database function behavior
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase/client';

// Note: These are integration tests that require a test database
// They should be run in a test environment with proper setup

describe('Guest Display Name RPC Function Integration', () => {
  let testEventId: string;
  let testUserId: string;
  let testGuestIds: string[] = [];

  beforeAll(async () => {
    // Skip tests if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      return;
    }

    // Create test event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        title: 'Test Event for Display Names',
        event_date: '2024-12-31',
        host_user_id: '00000000-0000-0000-0000-000000000000' // Mock UUID
      })
      .select()
      .single();

    if (eventError) {
      console.error('Failed to create test event:', eventError);
      return;
    }

    testEventId = eventData.id;

    // Create test user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        phone: '+1234567890',
        full_name: 'Test User Full Name',
        email: 'test@example.com'
      })
      .select()
      .single();

    if (userError) {
      console.error('Failed to create test user:', userError);
      return;
    }

    testUserId = userData.id;
  });

  afterAll(async () => {
    if (process.env.NODE_ENV !== 'test') {
      return;
    }

    // Clean up test data
    if (testGuestIds.length > 0) {
      await supabase
        .from('event_guests')
        .delete()
        .in('id', testGuestIds);
    }

    if (testUserId) {
      await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);
    }

    if (testEventId) {
      await supabase
        .from('events')
        .delete()
        .eq('id', testEventId);
    }
  });

  beforeEach(() => {
    testGuestIds = [];
  });

  afterEach(async () => {
    if (process.env.NODE_ENV !== 'test' || testGuestIds.length === 0) {
      return;
    }

    // Clean up guests created in this test
    await supabase
      .from('event_guests')
      .delete()
      .in('id', testGuestIds);

    testGuestIds = [];
  });

  describe('COALESCE Logic', () => {
    it('should return users.full_name when guest is linked to user with full_name', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create guest linked to user
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .insert({
          event_id: testEventId,
          user_id: testUserId,
          guest_name: 'Guest Import Name',
          phone: '+1234567890',
          guest_email: 'guest@example.com'
        })
        .select()
        .single();

      expect(guestError).toBeNull();
      expect(guestData).toBeDefined();
      testGuestIds.push(guestData.id);

      // Call RPC function
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      expect(rpcData?.length).toBe(1);
      
      const guest = rpcData?.[0];
      expect(guest?.guest_display_name).toBe('Test User Full Name');
      expect(guest?.guest_name).toBe('Guest Import Name');
      expect(guest?.user_full_name).toBe('Test User Full Name');
    });

    it('should return guest_name when guest is linked to user without full_name', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create user without full_name
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          phone: '+1234567891',
          full_name: null,
          email: 'noname@example.com'
        })
        .select()
        .single();

      expect(userError).toBeNull();
      const noNameUserId = userData.id;

      // Create guest linked to user without full_name
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .insert({
          event_id: testEventId,
          user_id: noNameUserId,
          guest_name: 'Guest Fallback Name',
          phone: '+1234567891',
          guest_email: 'guest2@example.com'
        })
        .select()
        .single();

      expect(guestError).toBeNull();
      testGuestIds.push(guestData.id);

      // Call RPC function
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      
      if (rpcData && guestData) {
        const guest = rpcData.find(g => g.id === guestData.id);
        expect(guest).toBeDefined();
        expect(guest?.guest_display_name).toBe('Guest Fallback Name');
        expect(guest?.guest_name).toBe('Guest Fallback Name');
        expect(guest?.user_full_name).toBeNull();
      }

      // Clean up the extra user
      await supabase
        .from('users')
        .delete()
        .eq('id', noNameUserId);
    });

    it('should return guest_name when guest is not linked to any user', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create unlinked guest
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .insert({
          event_id: testEventId,
          user_id: null,
          guest_name: 'Unlinked Guest Name',
          phone: '+1234567892',
          guest_email: 'unlinked@example.com'
        })
        .select()
        .single();

      expect(guestError).toBeNull();
      testGuestIds.push(guestData.id);

      // Call RPC function
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      
      if (rpcData && guestData) {
        const guest = rpcData.find(g => g.id === guestData.id);
        expect(guest).toBeDefined();
        expect(guest?.guest_display_name).toBe('Unlinked Guest Name');
        expect(guest?.guest_name).toBe('Unlinked Guest Name');
        expect(guest?.user_full_name).toBeNull();
        expect(guest?.user_id).toBeNull();
      }
    });

    it('should return "Unnamed Guest" when both guest_name and user full_name are null', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create guest with null name
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .insert({
          event_id: testEventId,
          user_id: null,
          guest_name: null,
          phone: '+1234567893',
          guest_email: 'unnamed@example.com'
        })
        .select()
        .single();

      expect(guestError).toBeNull();
      testGuestIds.push(guestData.id);

      // Call RPC function
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      
      if (rpcData && guestData) {
        const guest = rpcData.find(g => g.id === guestData.id);
        expect(guest).toBeDefined();
        expect(guest?.guest_display_name).toBe('Unnamed Guest');
        expect(guest?.guest_name).toBeNull();
        expect(guest?.user_full_name).toBeNull();
      }
    });
  });

  describe('Pagination Support', () => {
    it('should support limit and offset parameters', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create multiple guests
      const guests = [];
      for (let i = 0; i < 5; i++) {
        const { data: guestData, error: guestError } = await supabase
          .from('event_guests')
          .insert({
            event_id: testEventId,
            user_id: null,
            guest_name: `Guest ${i}`,
            phone: `+123456789${i}`,
            guest_email: `guest${i}@example.com`
          })
          .select()
          .single();

        expect(guestError).toBeNull();
        guests.push(guestData);
        testGuestIds.push(guestData.id);
      }

      // Test pagination
      const { data: page1Data, error: page1Error } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: 2,
          p_offset: 0
        });

      expect(page1Error).toBeNull();
      expect(page1Data).toBeDefined();
      expect(page1Data.length).toBe(2);

      const { data: page2Data, error: page2Error } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: 2,
          p_offset: 2
        });

      expect(page2Error).toBeNull();
      expect(page2Data).toBeDefined();
      expect(page2Data.length).toBe(2);

      // Ensure different guests on different pages
      const page1Ids = page1Data.map(g => g.id);
      const page2Ids = page2Data.map(g => g.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should handle null limit (no pagination)', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // Create a guest
      const { data: guestData, error: guestError } = await supabase
        .from('event_guests')
        .insert({
          event_id: testEventId,
          user_id: null,
          guest_name: 'No Limit Guest',
          phone: '+1234567894',
          guest_email: 'nolimit@example.com'
        })
        .select()
        .single();

      expect(guestError).toBeNull();
      testGuestIds.push(guestData.id);

      // Call without limit
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      expect(rpcData?.length).toBeGreaterThan(0);
    });
  });

  describe('Security and RLS', () => {
    it('should respect RLS policies', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      // This test would verify that RLS policies are enforced
      // For now, we just ensure the function doesn't error
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should execute efficiently with JOIN operation', async () => {
      if (process.env.NODE_ENV !== 'test') {
        return;
      }

      const startTime = Date.now();

      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_event_guests_with_display_names', {
          p_event_id: testEventId,
          p_limit: undefined,
          p_offset: 0
        });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(rpcError).toBeNull();
      expect(rpcData).toBeDefined();
      // Should execute reasonably quickly (under 1 second for test data)
      expect(executionTime).toBeLessThan(1000);
    });
  });
});