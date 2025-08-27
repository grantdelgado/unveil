/**
 * Integration test for get_guest_event_messages_v2 RPC function
 * Tests the current V2 implementation with union read model
 * Updated: 2025-08-27 - Aligned with V2 patterns per versioned functions cleanup
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase/client';
import { createTestEvent, createTestGuest, createTestUser, cleanupTestData } from '../helpers/testHelpers';

describe('get_guest_event_messages_v2 RPC Integration', () => {
  let testEventId: string;
  let testUserId: string;
  let testGuestId: string;

  beforeAll(async () => {
    // Create test data
    const hostUser = await createTestUser();
    const event = await createTestEvent(hostUser.id);
    testEventId = event.id;

    const guestUser = await createTestUser();
    testUserId = guestUser.id;
    
    const guest = await createTestGuest(testEventId, guestUser.id);
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData([testEventId], [testUserId]);
  });

  it('should return correct schema without 400 error', async () => {
    // Mock authentication for the guest user
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: `test-${testUserId}@example.com`,
      password: 'test-password'
    });

    expect(authData.user).toBeTruthy();

    // Call the current V2 RPC function
    const { data, error } = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 10,
      p_before: undefined
    });

    // Should not return a 400 error
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);

    // Verify the schema matches expected structure
    if (data && data.length > 0) {
      const message = data[0];
      
      // Check all expected fields are present
      expect(message).toHaveProperty('message_id');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('created_at');
      expect(message).toHaveProperty('delivery_status');
      expect(message).toHaveProperty('sender_name');
      expect(message).toHaveProperty('sender_avatar_url');
      expect(message).toHaveProperty('message_type');
      expect(message).toHaveProperty('is_own_message');
      expect(message).toHaveProperty('source');
      expect(message).toHaveProperty('is_catchup');
      expect(message).toHaveProperty('channel_tags');

      // Verify field types
      expect(typeof message.message_id).toBe('string');
      expect(typeof message.content).toBe('string');
      expect(typeof message.created_at).toBe('string');
      expect(typeof message.delivery_status).toBe('string');
      expect(typeof message.sender_name).toBe('string');
      expect(typeof message.is_own_message).toBe('boolean');
      expect(typeof message.source).toBe('string');
      expect(typeof message.is_catchup).toBe('boolean');
      expect(Array.isArray(message.channel_tags)).toBe(true);
    }

    await supabase.auth.signOut();
  });

  it('should handle empty result set correctly', async () => {
    // Mock authentication for the guest user
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: `test-${testUserId}@example.com`,
      password: 'test-password'
    });

    expect(authData.user).toBeTruthy();

    // Call with a very old timestamp to get empty results
    const { data, error } = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 10,
      p_before: '2020-01-01T00:00:00Z'
    });

    // Should not return a 400 error even with empty results
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);

    await supabase.auth.signOut();
  });

  it('should enforce authentication', async () => {
    // Ensure user is signed out
    await supabase.auth.signOut();

    // Call without authentication
    const { data, error } = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 10,
      p_before: undefined
    });

    // Should return an authentication error, not a 400 schema error
    expect(error).toBeTruthy();
    expect(error?.message).toContain('Authentication required');
    expect(data).toBeNull();
  });

  it('should enforce event access permissions', async () => {
    // Create a different user who is not a guest of this event
    const unauthorizedUser = await createTestUser();
    
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: `test-${unauthorizedUser.id}@example.com`,
      password: 'test-password'
    });

    expect(authData.user).toBeTruthy();

    // Call with unauthorized user
    const { data, error } = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 10,
      p_before: undefined
    });

    // Should return an access denied error, not a 400 schema error
    expect(error).toBeTruthy();
    expect(error?.message).toContain('Access denied');
    expect(data).toBeNull();

    await supabase.auth.signOut();
    await cleanupTestData([], [unauthorizedUser.id]);
  });
});
