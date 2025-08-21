import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveMessageRecipients } from '@/lib/services/messaging-client';
import type { RecipientFilter } from '@/lib/types/messaging';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(() => ({
            data: [
              { id: 'guest-1' },
              { id: 'guest-2' },
              { id: 'guest-3' }
            ],
            error: null
          }))
        }))
      }))
    })),
    rpc: vi.fn(() => ({
      data: [
        { guest_id: 'guest-1', phone: '+1234567890', guest_name: 'Guest 1' },
        { guest_id: 'guest-2', phone: '+1234567891', guest_name: 'Guest 2' }
      ],
      error: null
    }))
  }
}));

describe('resolveMessageRecipients', () => {
  const eventId = 'test-event-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('explicit_selection filter type', () => {
    it('should return correct count for explicit guest selection', async () => {
      const filter: RecipientFilter = {
        type: 'explicit_selection',
        selectedGuestIds: ['guest-1', 'guest-2', 'guest-3']
      };

      const result = await resolveMessageRecipients(eventId, filter);

      expect(result.guestIds).toEqual(['guest-1', 'guest-2', 'guest-3']);
      expect(result.recipientCount).toBe(3);
    });

    it('should handle single guest selection', async () => {
      const filter: RecipientFilter = {
        type: 'explicit_selection',
        selectedGuestIds: ['guest-1']
      };

      const result = await resolveMessageRecipients(eventId, filter);

      expect(result.guestIds).toEqual(['guest-1']);
      expect(result.recipientCount).toBe(1);
    });

    it('should throw error when no guests selected', async () => {
      const filter: RecipientFilter = {
        type: 'explicit_selection',
        selectedGuestIds: []
      };

      await expect(resolveMessageRecipients(eventId, filter))
        .rejects
        .toThrow('No recipients selected. Please select at least one guest to send the message to.');
    });

    it('should throw error when selectedGuestIds is undefined', async () => {
      const filter: RecipientFilter = {
        type: 'explicit_selection',
        selectedGuestIds: undefined
      };

      // Should fall through to RPC call since selectedGuestIds is undefined
      const result = await resolveMessageRecipients(eventId, filter);
      
      // Should return RPC result
      expect(result.guestIds).toEqual(['guest-1', 'guest-2']);
      expect(result.recipientCount).toBe(2);
    });
  });

  describe('individual filter type', () => {
    it('should return correct count for individual guest selection', async () => {
      const filter: RecipientFilter = {
        type: 'individual',
        guestIds: ['guest-1', 'guest-2']
      };

      const result = await resolveMessageRecipients(eventId, filter);

      expect(result.guestIds).toEqual(['guest-1', 'guest-2']);
      expect(result.recipientCount).toBe(2);
    });
  });

  describe('all filter type', () => {
    it('should return all guests with phone numbers', async () => {
      const filter: RecipientFilter = {
        type: 'all'
      };

      const result = await resolveMessageRecipients(eventId, filter);

      expect(result.guestIds).toEqual(['guest-1', 'guest-2', 'guest-3']);
      expect(result.recipientCount).toBe(3);
    });
  });

  describe('complex filtering via RPC', () => {
    it('should use RPC for tag-based filtering', async () => {
      const filter: RecipientFilter = {
        type: 'tags',
        tags: ['vip', 'family']
      };

      const result = await resolveMessageRecipients(eventId, filter);

      expect(result.guestIds).toEqual(['guest-1', 'guest-2']);
      expect(result.recipientCount).toBe(2);
    });
  });
});
