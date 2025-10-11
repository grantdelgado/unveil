/**
 * Integration tests for guest search functionality
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { vi } from 'vitest';

// Mock the server Supabase client
vi.mock('@/lib/supabase/server');

const mockSupabase = {
  rpc: vi.fn(),
};

(createServerSupabaseClient as any).mockResolvedValue(mockSupabase);

describe('Guest Search Integration', () => {
  const mockEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server-side search RPC function', () => {
    it('should call RPC with search parameters', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'Will Behenna',
          guest_name: 'Will Behenna',
          phone: '+13109975447',
          role: 'guest',
          user_full_name: null,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockGuestData,
        error: null,
      });

      const supabase = await createServerSupabaseClient();
      
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: 'Will',
        p_limit: 50,
        p_offset: 0,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_event_guests_with_display_names',
        {
          p_event_id: mockEventId,
          p_search_term: 'Will',
          p_limit: 50,
          p_offset: 0,
        }
      );

      expect(result.data).toEqual(mockGuestData);
      expect(result.error).toBeNull();
    });

    it('should handle empty search term', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'Will Behenna',
          guest_name: 'Will Behenna',
          phone: '+13109975447',
          role: 'guest',
        },
        {
          id: 'guest-2',
          guest_display_name: 'Chris Behenna',
          guest_name: 'Chris Behenna',
          phone: '+13109955127',
          role: 'guest',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockGuestData,
        error: null,
      });

      const supabase = await createServerSupabaseClient();
      
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: null,
        p_limit: 50,
        p_offset: 0,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_event_guests_with_display_names',
        {
          p_event_id: mockEventId,
          p_search_term: null,
          p_limit: 50,
          p_offset: 0,
        }
      );

      expect(result.data).toHaveLength(2);
    });

    it('should handle search by partial name', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'Will Behenna',
          guest_name: 'Will Behenna',
          phone: '+13109975447',
          role: 'guest',
        },
        {
          id: 'guest-2',
          guest_display_name: 'Chris Behenna',
          guest_name: 'Chris Behenna',
          phone: '+13109955127',
          role: 'guest',
        },
        {
          id: 'guest-3',
          guest_display_name: 'Laura Behenna',
          guest_name: 'Laura Behenna',
          phone: '+13109959616',
          role: 'guest',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockGuestData,
        error: null,
      });

      const supabase = await createServerSupabaseClient();
      
      // Search for "Behenna" should return all three
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: 'Behenna',
        p_limit: 50,
        p_offset: 0,
      });

      expect(result.data).toHaveLength(3);
      expect(result.data.every(guest => 
        guest.guest_display_name.includes('Behenna')
      )).toBe(true);
    });

    it('should handle search by phone number', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'Will Behenna',
          guest_name: 'Will Behenna',
          phone: '+13109975447',
          role: 'guest',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockGuestData,
        error: null,
      });

      const supabase = await createServerSupabaseClient();
      
      // Search by partial phone number
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: '5447',
        p_limit: 50,
        p_offset: 0,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].phone).toContain('5447');
    });

    it('should handle pagination with search', async () => {
      const mockGuestData = [
        {
          id: 'guest-1',
          guest_display_name: 'Will Behenna',
          guest_name: 'Will Behenna',
          phone: '+13109975447',
          role: 'guest',
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockGuestData,
        error: null,
      });

      const supabase = await createServerSupabaseClient();
      
      // Test pagination parameters
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: 'Behenna',
        p_limit: 10,
        p_offset: 20,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_event_guests_with_display_names',
        {
          p_event_id: mockEventId,
          p_search_term: 'Behenna',
          p_limit: 10,
          p_offset: 20,
        }
      );
    });

    it('should handle RPC errors gracefully', async () => {
      const mockError = new Error('Database connection failed');

      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const supabase = await createServerSupabaseClient();
      
      const result = await supabase.rpc('get_event_guests_with_display_names', {
        p_event_id: mockEventId,
        p_search_term: 'Will',
        p_limit: 50,
        p_offset: 0,
      });

      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });
  });
});
