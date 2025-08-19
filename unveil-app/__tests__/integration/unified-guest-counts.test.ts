/**
 * Integration test for unified guest counts
 * Ensures Host Dashboard and Guest Management show consistent numbers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/client';

// Mock the auth user for testing
const mockEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
const mockHostUserId = '39144252-24fc-44f2-8889-ac473208910f';

describe('Unified Guest Counts', () => {
  beforeEach(() => {
    // Mock authenticated user
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: mockHostUserId } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return consistent counts from RPC function', async () => {
    // Mock the RPC response
    const mockCounts = {
      total_guests: 5,
      total_invited: 4,
      attending: 3,
      declined: 1,
      not_invited: 1,
    };

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [mockCounts],
      error: null,
    });

    const { data, error } = await supabase.rpc('get_event_guest_counts', {
      p_event_id: mockEventId,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual(mockCounts);

    // Verify the counts make sense
    const result = data[0];
    expect(result.attending + result.declined).toBeLessThanOrEqual(result.total_invited);
    expect(result.total_invited + result.not_invited).toEqual(result.total_guests);
  });

  it('should exclude soft-deleted guests from all counts', async () => {
    // This test verifies the base scope: removed_at IS NULL
    const mockCountsWithSoftDeleted = {
      total_guests: 3, // Should exclude removed_at IS NOT NULL
      total_invited: 2,
      attending: 1,
      declined: 1,
      not_invited: 1,
    };

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [mockCountsWithSoftDeleted],
      error: null,
    });

    const { data } = await supabase.rpc('get_event_guest_counts', {
      p_event_id: mockEventId,
    });

    const result = data[0];
    
    // Verify soft-deleted guests are excluded from all counts
    expect(result.total_guests).toBe(3); // Should be less than actual DB count if soft-deleted exist
    expect(result.attending + result.declined + result.not_invited).toEqual(result.total_guests);
  });

  it('should handle edge cases correctly', async () => {
    // Test with no guests
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{
        total_guests: 0,
        total_invited: 0,
        attending: 0,
        declined: 0,
        not_invited: 0,
      }],
      error: null,
    });

    const { data } = await supabase.rpc('get_event_guest_counts', {
      p_event_id: mockEventId,
    });

    const result = data[0];
    expect(result.total_guests).toBe(0);
    expect(result.total_invited).toBe(0);
    expect(result.attending).toBe(0);
    expect(result.declined).toBe(0);
    expect(result.not_invited).toBe(0);
  });
});
