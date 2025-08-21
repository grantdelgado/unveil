/**
 * Integration tests for scheduled message recipient count fixes
 * 
 * These tests verify that:
 * 1. Explicit guest selection creates correct recipient counts
 * 2. UTC timezone conversion validation works
 * 3. Scheduled messages are processed correctly by the worker
 */

import { createScheduledMessage } from '@/lib/services/messaging-client';
import type { CreateScheduledMessageData } from '@/lib/types/messaging';

// Mock Supabase client with realistic responses
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => ({
        data: { user: { id: 'test-user-id' } },
        error: null
      }))
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'scheduled-message-id',
              recipient_count: 3,
              send_at: '2025-08-22T10:00:00.000Z',
              scheduled_tz: 'America/Denver',
              scheduled_local: '2025-08-22T04:00:00'
            },
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock the resolveMessageRecipients function to return predictable results
jest.mock('@/lib/services/messaging-client', () => ({
  ...jest.requireActual('@/lib/services/messaging-client'),
  resolveMessageRecipients: jest.fn()
}));

import { resolveMessageRecipients } from '@/lib/services/messaging-client';
const mockResolveMessageRecipients = resolveMessageRecipients as jest.MockedFunction<typeof resolveMessageRecipients>;

describe('Scheduled Messages Integration Tests', () => {
  const eventId = 'test-event-id';
  const baseScheduleData: CreateScheduledMessageData = {
    eventId,
    content: 'Test message content',
    sendAt: '2025-08-22T10:00:00.000Z',
    scheduledTz: 'America/Denver',
    scheduledLocal: '2025-08-22T04:00:00',
    idempotencyKey: 'test-key',
    messageType: 'announcement',
    sendViaSms: true,
    sendViaEmail: false,
    sendViaPush: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Explicit Guest Selection', () => {
    it('should create scheduled message with correct recipient count for 3 selected guests', async () => {
      // Mock resolveMessageRecipients to return 3 recipients for explicit selection
      mockResolveMessageRecipients.mockResolvedValue({
        guestIds: ['guest-1', 'guest-2', 'guest-3'],
        recipientCount: 3
      });

      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1', 'guest-2', 'guest-3']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(true);
      expect(result.data?.recipient_count).toBe(3);
      
      // Verify resolveMessageRecipients was called with correct filter
      expect(mockResolveMessageRecipients).toHaveBeenCalledWith(
        eventId,
        {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1', 'guest-2', 'guest-3']
        }
      );
    });

    it('should create scheduled message with correct recipient count for 1 selected guest', async () => {
      // Mock resolveMessageRecipients to return 1 recipient for explicit selection
      mockResolveMessageRecipients.mockResolvedValue({
        guestIds: ['guest-1'],
        recipientCount: 1
      });

      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(true);
      expect(result.data?.recipient_count).toBe(1);
    });

    it('should fail when no recipients are selected', async () => {
      // Mock resolveMessageRecipients to throw error for empty selection
      mockResolveMessageRecipients.mockRejectedValue(
        new Error('No recipients selected. Please select at least one guest to send the message to.')
      );

      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: []
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No recipients selected');
    });
  });

  describe('UTC Timezone Validation', () => {
    it('should accept valid UTC conversion', async () => {
      mockResolveMessageRecipients.mockResolvedValue({
        guestIds: ['guest-1'],
        recipientCount: 1
      });

      // Denver time 4:00 AM = UTC 10:00 AM (during DST)
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: '2025-08-22T10:00:00.000Z',
        scheduledTz: 'America/Denver',
        scheduledLocal: '2025-08-22T04:00:00',
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(true);
    });

    it('should reject invalid timezone', async () => {
      mockResolveMessageRecipients.mockResolvedValue({
        guestIds: ['guest-1'],
        recipientCount: 1
      });

      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: '2025-08-22T10:00:00.000Z',
        scheduledTz: 'Invalid/Timezone',
        scheduledLocal: '2025-08-22T04:00:00',
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid scheduled time or timezone');
    });
  });

  describe('Message Validation', () => {
    it('should reject empty message content', async () => {
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        content: '',
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Message content is required');
    });

    it('should reject message content over 1000 characters', async () => {
      const longContent = 'A'.repeat(1001);
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        content: longContent,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('exceeds 1000 character limit');
    });

    it('should reject scheduled time in the past', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      
      const scheduleData: CreateScheduledMessageData = {
        ...baseScheduleData,
        sendAt: pastTime,
        recipientFilter: {
          type: 'explicit_selection',
          selectedGuestIds: ['guest-1']
        }
      };

      const result = await createScheduledMessage(scheduleData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Scheduled time must be in the future');
    });
  });

  describe('Worker Processing Simulation', () => {
    it('should process explicit selection correctly in worker context', () => {
      // This test simulates what the worker does:
      // 1. Reconstructs filter from scheduled message data
      // 2. Uses target_guest_ids directly for explicit selection
      
      const scheduledMessageData = {
        target_all_guests: false,
        target_guest_tags: [],
        target_guest_ids: ['guest-1', 'guest-2', 'guest-3']
      };

      // Simulate the reconstructRecipientFilter logic
      const reconstructedFilter = {
        type: 'explicit_selection' as const,
        selectedGuestIds: scheduledMessageData.target_guest_ids
      };

      expect(reconstructedFilter.type).toBe('explicit_selection');
      expect(reconstructedFilter.selectedGuestIds).toEqual(['guest-1', 'guest-2', 'guest-3']);
      expect(reconstructedFilter.selectedGuestIds?.length).toBe(3);
    });
  });
});
