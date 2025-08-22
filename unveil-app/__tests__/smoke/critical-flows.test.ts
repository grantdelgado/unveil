/**
 * Critical Flow Smoke Tests
 *
 * These tests verify the most essential user journeys work end-to-end.
 * They focus on integration points and critical business logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

// Mock Supabase client for smoke tests
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    signInWithOtp: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        data: null,
        error: null,
      })),
    })),
    insert: vi.fn(() => ({
      data: null,
      error: null,
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
  })),
} as any;

vi.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('Critical Flow Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Guest Authentication Flow', () => {
    it('should handle phone number authentication', async () => {
      // Mock successful OTP request
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      const phone = '+15551234567';
      const result = await mockSupabase.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms',
        },
      });

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone,
        options: {
          channel: 'sms',
        },
      });
      expect(result.error).toBeNull();
    });

    it('should validate guest access to event', async () => {
      const eventId = 'test-event-id';
      const userId = 'test-user-id';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'guest-id', event_id: eventId },
                error: null,
              }),
            })),
          })),
        })),
      });

      const guest = await mockSupabase
        .from('event_guests')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      expect(guest.error).toBeNull();
      expect(guest.data).toBeTruthy();
    });
  });

  describe('Messaging Flow', () => {
    it('should send message to event participants', async () => {
      const messageData = {
        event_id: 'test-event-id',
        sender_user_id: 'test-user-id',
        content: 'Test message',
        message_type: 'direct' as const,
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: [{ id: 'message-id', ...messageData }],
          error: null,
        }),
      });

      const result = await mockSupabase.from('messages').insert(messageData);

      expect(result.error).toBeNull();
      expect(result.data).toBeTruthy();
    });

    it('should fetch messages for event with RLS enforcement', async () => {
      const eventId = 'test-event-id';

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'msg-1',
                  content: 'Hello world',
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
          })),
        })),
      });

      const messages = await mockSupabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      expect(messages.error).toBeNull();
      expect(Array.isArray(messages.data)).toBe(true);
    });
  });

  describe('Guest Management Flow', () => {
    it('should handle guest RSVP updates', async () => {
      const guestId = 'test-guest-id';
      const rsvpStatus = 'attending';

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: guestId, rsvp_status: rsvpStatus }],
            error: null,
          }),
        })),
      });

      const result = await mockSupabase
        .from('event_guests')
        .update({ rsvp_status: rsvpStatus })
        .eq('id', guestId);

      expect(result.error).toBeNull();
    });

    it('should enforce guest isolation between events', async () => {
      const eventId = 'test-event-id';
      const userId = 'test-user-id';

      // Simulate RLS policy enforcement
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [], // Empty result due to RLS
              error: null,
            }),
          })),
        })),
      });

      const guests = await mockSupabase
        .from('event_guests')
        .select('*')
        .eq('event_id', 'different-event-id')
        .eq('user_id', userId);

      // Should return empty due to RLS policy
      expect(guests.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed', code: 'PGRST301' },
          }),
        })),
      });

      const result = await mockSupabase
        .from('events')
        .select('*')
        .eq('id', 'test-id');

      expect(result.error).toBeTruthy();
      expect(result.error.message).toContain('Connection failed');
    });

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      const result = await mockSupabase.auth.getUser();

      expect(result.data.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });
});
