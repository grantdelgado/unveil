/**
 * Tests for guest display name functionality in React hooks
 * Tests useGuestData, useGuests, and related hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGuestData } from '@/hooks/guests/useGuestData';
import { useGuests } from '@/hooks/guests/useGuests';
import { supabase } from '@/lib/supabase/client';

// Mock the supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ count: 3 }))
      }))
    }))
  }
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    databaseError: vi.fn(),
    api: vi.fn()
  }
}));

// Mock realtime hooks
vi.mock('@/hooks/realtime', () => ({
  useEventSubscription: vi.fn(() => ({
    // Return mock subscription
  }))
}));

// Mock debounce hook
vi.mock('@/hooks/common', () => ({
  useDebounce: vi.fn((value) => value)
}));

describe('Guest Display Name in Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useGuestData Hook', () => {
    it('should return guests with guest_display_name from RPC function', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          event_id: 'event-1',
          user_id: 'user-1',
          guest_name: 'John From Guest',
          guest_email: 'john@example.com',
          phone: '+1234567890',
          rsvp_status: 'attending',
          notes: null,
          guest_tags: null,
          role: 'guest',
          invited_at: null,
          phone_number_verified: false,
          sms_opt_out: false,
          preferred_communication: 'sms',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          guest_display_name: 'John Smith', // Computed from users.full_name
          user_full_name: 'John Smith',
          user_email: 'john@example.com',
          user_phone: '+1234567890',
          user_avatar_url: null,
          user_created_at: '2024-01-01T00:00:00Z',
          user_updated_at: '2024-01-01T00:00:00Z',
          user_intended_redirect: null,
          user_onboarding_completed: true
        },
        {
          id: 'guest-2',
          event_id: 'event-1',
          user_id: null,
          guest_name: 'Jane Doe',
          guest_email: 'jane@example.com',
          phone: '+1234567891',
          rsvp_status: 'pending',
          notes: null,
          guest_tags: null,
          role: 'guest',
          invited_at: null,
          phone_number_verified: false,
          sms_opt_out: false,
          preferred_communication: 'sms',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          guest_display_name: 'Jane Doe', // No user linked, uses guest_name
          user_full_name: null,
          user_email: null,
          user_phone: null,
          user_avatar_url: null,
          user_created_at: null,
          user_updated_at: null,
          user_intended_redirect: null,
          user_onboarding_completed: null
        }
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockGuestData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuestData({ 
          eventId: 'event-1',
          pageSize: 50,
          enablePagination: true 
        })
      );

      // Wait for the hook to finish loading
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.guests).toHaveLength(2);
      
      // Test first guest with linked user
      expect(result.current.guests[0].guest_display_name).toBe('John Smith');
      expect(result.current.guests[0].guest_name).toBe('John From Guest');
      expect(result.current.guests[0].users?.full_name).toBe('John Smith');

      // Test second guest without linked user
      expect(result.current.guests[1].guest_display_name).toBe('Jane Doe');
      expect(result.current.guests[1].guest_name).toBe('Jane Doe');
      expect(result.current.guests[1].users).toBeNull();
    });

    it('should call RPC function with correct parameters', async () => {
      const mockGuestData = [];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockGuestData,
        error: null
      });

      renderHook(() => 
        useGuestData({ 
          eventId: 'event-1',
          pageSize: 25,
          enablePagination: true 
        })
      );

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('get_event_guests_with_display_names', {
          p_event_id: 'event-1',
          p_limit: 25,
          p_offset: 0
        });
      });
    });

    it('should handle search functionality with guest_display_name', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'John Smith',
          guest_name: 'Johnny',
          guest_email: 'john@example.com',
          // ... other required fields
        }
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockGuestData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuestData({ 
          eventId: 'event-1'
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Search should work with display name
      result.current.setSearchTerm('Smith');
      
      // The search filtering happens in the component, but we can verify
      // the guest_display_name is available for filtering
      expect(result.current.guests[0].guest_display_name).toBe('John Smith');
    });

    it('should handle pagination correctly', async () => {
      const mockGuestData = Array.from({ length: 10 }, (_, i) => ({
        id: `guest-${i}`,
        guest_display_name: `Guest ${i}`,
        // ... other required fields
      }));

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockGuestData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuestData({ 
          eventId: 'event-1',
          pageSize: 5,
          enablePagination: true 
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Test going to next page
      await result.current.goToPage(2);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('get_event_guests_with_display_names', {
          p_event_id: 'event-1',
          p_limit: 5,
          p_offset: 5 // Second page
        });
      });
    });
  });

  describe('useGuests Hook', () => {
    it('should return guests with guest_display_name', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          event_id: 'event-1',
          user_id: 'user-1',
          guest_name: 'Original Name',
          guest_display_name: 'Display Name',
          user_full_name: 'Display Name',
          rsvp_status: 'attending',
          // ... other required fields
        }
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockGuestData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuests({ 
          eventId: 'event-1',
          pageSize: 50,
          enablePagination: true 
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.guests).toHaveLength(1);
      expect(result.current.guests[0].guest_display_name).toBe('Display Name');
      expect(result.current.guests[0].guest_name).toBe('Original Name');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      const { result } = renderHook(() => 
        useGuests({ 
          eventId: 'event-1'
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.guests).toEqual([]);
    });
  });

  describe('Data Transformation', () => {
    it('should properly transform RPC data to OptimizedGuest format', async () => {
      const mockRpcData = [
        {
          id: 'guest-1',
          event_id: 'event-1',
          user_id: 'user-1',
          guest_name: 'Guest Name',
          guest_email: 'guest@example.com',
          phone: '+1234567890',
          rsvp_status: 'attending',
          notes: 'Some notes',
          guest_tags: ['tag1', 'tag2'],
          role: 'guest',
          invited_at: '2024-01-01T00:00:00Z',
          phone_number_verified: true,
          sms_opt_out: false,
          preferred_communication: 'sms',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          guest_display_name: 'User Full Name',
          user_full_name: 'User Full Name',
          user_email: 'user@example.com',
          user_phone: '+1234567890',
          user_avatar_url: 'https://example.com/avatar.jpg',
          user_created_at: '2024-01-01T00:00:00Z',
          user_updated_at: '2024-01-01T00:00:00Z',
          user_intended_redirect: '/dashboard',
          user_onboarding_completed: true
        }
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockRpcData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuestData({ eventId: 'event-1' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const guest = result.current.guests[0];
      
      // Verify all fields are properly mapped
      expect(guest.id).toBe('guest-1');
      expect(guest.guest_display_name).toBe('User Full Name');
      expect(guest.guest_name).toBe('Guest Name');
      expect(guest.users?.full_name).toBe('User Full Name');
      expect(guest.users?.intended_redirect).toBe('/dashboard');
      expect(guest.users?.onboarding_completed).toBe(true);
    });

    it('should handle null user data correctly', async () => {
      const mockRpcData = [
        {
          id: 'guest-1',
          user_id: null,
          guest_display_name: 'Guest Only Name',
          user_full_name: null,
          user_email: null,
          // ... other fields
        }
      ];

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockRpcData,
        error: null
      });

      const { result } = renderHook(() => 
        useGuestData({ eventId: 'event-1' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const guest = result.current.guests[0];
      expect(guest.users).toBeNull();
      expect(guest.guest_display_name).toBe('Guest Only Name');
    });
  });

  describe('Performance', () => {
    it('should only call RPC function once per data fetch', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null
      });

      renderHook(() => 
        useGuestData({ eventId: 'event-1' })
      );

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
      });
    });

    it('should properly handle count query for pagination', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: [],
        error: null
      });

      renderHook(() => 
        useGuestData({ 
          eventId: 'event-1',
          enablePagination: true 
        })
      );

      await waitFor(() => {
        // Should call RPC for data and count query for total
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.from).toHaveBeenCalledWith('event_guests');
      });
    });
  });
});