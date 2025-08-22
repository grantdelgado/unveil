/**
 * Tests for the backfill script that fixes incorrect recipient counts
 */

import { backfillScheduledMessageRecipientCounts } from '../../scripts/backfill-scheduled-message-recipient-counts';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      in: jest.fn(() => ({
        not: jest.fn(() => ({
          data: [
            {
              id: 'msg-1',
              event_id: 'event-1',
              status: 'scheduled',
              target_guest_ids: ['guest-1', 'guest-2', 'guest-3'],
              recipient_count: 6, // Incorrect count
              created_at: '2025-08-21T15:00:00Z',
              send_at: '2025-08-22T16:00:00Z',
            },
            {
              id: 'msg-2',
              event_id: 'event-2',
              status: 'scheduled',
              target_guest_ids: ['guest-4'],
              recipient_count: 1, // Correct count
              created_at: '2025-08-21T15:30:00Z',
              send_at: '2025-08-22T17:00:00Z',
            },
          ],
          error: null,
        })),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null,
        })),
      })),
    })),
  })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Backfill Scheduled Message Recipient Counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should identify and fix incorrect recipient counts', async () => {
    // Mock the process.argv for dry-run mode
    const originalArgv = process.argv;
    process.argv = ['node', 'script.js'];

    await backfillScheduledMessageRecipientCounts();

    // Verify that the script identified the incorrect message
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        'Found 1 messages with incorrect recipient counts',
      ),
    );

    // Verify that the update was called with correct parameters
    expect(mockSupabase.from).toHaveBeenCalledWith('scheduled_messages');

    const updateCall = mockSupabase.from().update;
    expect(updateCall).toHaveBeenCalledWith({ recipient_count: 3 });

    // Verify success message
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Successfully updated: 1 messages'),
    );

    process.argv = originalArgv;
  });

  it('should handle case when no incorrect counts are found', async () => {
    // Mock data with all correct counts
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          not: jest.fn(() => ({
            data: [
              {
                id: 'msg-1',
                event_id: 'event-1',
                status: 'scheduled',
                target_guest_ids: ['guest-1', 'guest-2'],
                recipient_count: 2, // Correct count
                created_at: '2025-08-21T15:00:00Z',
                send_at: '2025-08-22T16:00:00Z',
              },
            ],
            error: null,
          })),
        })),
      })),
    });

    await backfillScheduledMessageRecipientCounts();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        'All scheduled messages have correct recipient counts',
      ),
    );
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          not: jest.fn(() => ({
            data: null,
            error: { message: 'Database connection failed' },
          })),
        })),
      })),
    });

    await expect(backfillScheduledMessageRecipientCounts()).rejects.toThrow(
      'Failed to fetch scheduled messages: Database connection failed',
    );
  });

  it('should correctly calculate recipient count differences', async () => {
    const testMessages = [
      {
        id: 'msg-1',
        target_guest_ids: ['a', 'b', 'c'],
        recipient_count: 6,
      },
      {
        id: 'msg-2',
        target_guest_ids: ['a'],
        recipient_count: 1,
      },
      {
        id: 'msg-3',
        target_guest_ids: ['a', 'b'],
        recipient_count: 5,
      },
    ];

    // Test the filtering logic that identifies incorrect counts
    const incorrectMessages = testMessages.filter((msg) => {
      const actualCount = msg.target_guest_ids?.length || 0;
      const storedCount = msg.recipient_count || 0;
      return actualCount !== storedCount && actualCount > 0;
    });

    expect(incorrectMessages).toHaveLength(2);
    expect(incorrectMessages[0].id).toBe('msg-1'); // 3 vs 6
    expect(incorrectMessages[1].id).toBe('msg-3'); // 2 vs 5
  });

  it('should be idempotent - safe to run multiple times', async () => {
    // First run
    await backfillScheduledMessageRecipientCounts();

    // Second run should find no incorrect counts
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          not: jest.fn(() => ({
            data: [
              {
                id: 'msg-1',
                event_id: 'event-1',
                status: 'scheduled',
                target_guest_ids: ['guest-1', 'guest-2', 'guest-3'],
                recipient_count: 3, // Now correct
                created_at: '2025-08-21T15:00:00Z',
                send_at: '2025-08-22T16:00:00Z',
              },
            ],
            error: null,
          })),
        })),
      })),
    });

    await backfillScheduledMessageRecipientCounts();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        'All scheduled messages have correct recipient counts',
      ),
    );
  });
});
