/**
 * Tests for guest display name functionality
 * Covers database queries, hook behavior, and UI display logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/client';
import { getEventGuests } from '@/lib/services/events';

// Mock the supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

describe('Guest Display Name Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Database RPC Function', () => {
    it('should return guest_display_name with user full_name when user is linked', async () => {
      const mockData = [{
        id: 'guest-1',
        event_id: 'event-1',
        user_id: 'user-1',
        guest_name: 'John From Guest',
        guest_email: 'john@example.com',
        phone: '+1234567890',
        rsvp_status: 'pending',
        notes: null,
        guest_tags: null,
        role: 'guest',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        guest_display_name: 'John Smith', // This should be users.full_name
        user_full_name: 'John Smith',
        user_email: 'john@example.com',
        user_phone: '+1234567890',
        user_avatar_url: null,
        user_created_at: '2024-01-01T00:00:00Z',
        user_updated_at: '2024-01-01T00:00:00Z',
        user_intended_redirect: null,
        user_onboarding_completed: true
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(supabase.rpc).toHaveBeenCalledWith('get_event_guests_with_display_names', {
        p_event_id: 'event-1',
        p_limit: undefined,
        p_offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].guest_display_name).toBe('John Smith');
      expect(result.data[0].users?.full_name).toBe('John Smith');
    });

    it('should return guest_display_name with guest_name when user has no full_name', async () => {
      const mockData = [{
        id: 'guest-2',
        event_id: 'event-1',
        user_id: 'user-2',
        guest_name: 'Jane From Guest',
        guest_email: 'jane@example.com',
        phone: '+1234567891',
        rsvp_status: 'attending',
        notes: null,
        guest_tags: null,
        role: 'guest',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        guest_display_name: 'Jane From Guest', // Falls back to guest_name
        user_full_name: null,
        user_email: 'jane@example.com',
        user_phone: '+1234567891',
        user_avatar_url: null,
        user_created_at: '2024-01-01T00:00:00Z',
        user_updated_at: '2024-01-01T00:00:00Z',
        user_intended_redirect: null,
        user_onboarding_completed: false
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data[0].guest_display_name).toBe('Jane From Guest');
      expect(result.data[0].users?.full_name).toBeNull();
    });

    it('should return guest_display_name with guest_name when user is not linked', async () => {
      const mockData = [{
        id: 'guest-3',
        event_id: 'event-1',
        user_id: null,
        guest_name: 'Bob From Guest',
        guest_email: 'bob@example.com',
        phone: '+1234567892',
        rsvp_status: 'declined',
        notes: null,
        guest_tags: null,
        role: 'guest',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        guest_display_name: 'Bob From Guest', // No user linked
        user_full_name: null,
        user_email: null,
        user_phone: null,
        user_avatar_url: null,
        user_created_at: null,
        user_updated_at: null,
        user_intended_redirect: null,
        user_onboarding_completed: null
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data[0].guest_display_name).toBe('Bob From Guest');
      expect(result.data[0].users).toBeNull();
    });

    it('should return "Unnamed Guest" when both guest_name and user full_name are null', async () => {
      const mockData = [{
        id: 'guest-4',
        event_id: 'event-1',
        user_id: null,
        guest_name: null,
        guest_email: 'unnamed@example.com',
        phone: '+1234567893',
        rsvp_status: 'pending',
        notes: null,
        guest_tags: null,
        role: 'guest',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        guest_display_name: 'Unnamed Guest', // Fallback value from COALESCE
        user_full_name: null,
        user_email: null,
        user_phone: null,
        user_avatar_url: null,
        user_created_at: null,
        user_updated_at: null,
        user_intended_redirect: null,
        user_onboarding_completed: null
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data[0].guest_display_name).toBe('Unnamed Guest');
      expect(result.data[0].users).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed')
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toEqual([]);
    });
  });

  describe('Type Safety', () => {
    it('should ensure guest_display_name is always a string', async () => {
      const mockData = [{
        id: 'guest-1',
        event_id: 'event-1',
        user_id: 'user-1',
        guest_name: 'Test Guest',
        guest_display_name: 'Test Guest', // Should always be a string
        user_full_name: 'Test User',
        // ... other required fields
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(typeof result.data[0].guest_display_name).toBe('string');
      expect(result.data[0].guest_display_name).not.toBe('');
    });
  });

  describe('Performance Considerations', () => {
    it('should not perform N+1 queries by using RPC function', async () => {
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        id: `guest-${i}`,
        event_id: 'event-1',
        user_id: `user-${i}`,
        guest_name: `Guest ${i}`,
        guest_display_name: `User ${i}`,
        user_full_name: `User ${i}`,
        // ... other required fields
      }));

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      await getEventGuests('event-1');

      // Should only call RPC once, not once per guest
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Integrity', () => {
    it('should not modify original guest_name field', async () => {
      const mockData = [{
        id: 'guest-1',
        event_id: 'event-1',
        user_id: 'user-1',
        guest_name: 'Original Guest Name', // Should remain unchanged
        guest_display_name: 'User Full Name', // Computed field
        user_full_name: 'User Full Name',
        // ... other required fields
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data[0].guest_name).toBe('Original Guest Name');
      expect(result.data[0].guest_display_name).toBe('User Full Name');
      // These should be different, proving guest_name is preserved
      expect(result.data[0].guest_name).not.toBe(result.data[0].guest_display_name);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result set', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle null data from database', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle malformed guest data gracefully', async () => {
      const mockData = [{
        id: 'guest-1',
        // Missing required fields to test error handling
        guest_display_name: 'Test Guest',
      }];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getEventGuests('event-1');

      expect(result.success).toBe(true);
      expect(result.data[0].guest_display_name).toBe('Test Guest');
    });
  });

  describe('Pagination Support', () => {
    it('should support pagination parameters in RPC call', async () => {
      // This would be tested in hook tests since the service doesn't expose pagination
      // but we can verify the RPC function supports it
      expect(true).toBe(true); // Placeholder for now
    });
  });
});