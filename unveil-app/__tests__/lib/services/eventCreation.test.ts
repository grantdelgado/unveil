import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventCreationService } from '@/lib/services/eventCreation';
import type {
  EventCreationInput,
  EventCreationResult,
  HostGuestProfile,
} from '@/lib/services/eventCreation';
import {
  mockSupabaseClient,
  mockAuthenticatedUser,
  resetMockSupabaseClient,
} from '@/src/test/setup';
import { logger } from '@/lib/logger';

// Mock the logger module
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockLogger = vi.mocked(logger);

describe('EventCreationService', () => {
  const mockUserId = 'test-user-123';
  const mockEventId = 'event-123';

  const validEventInput: EventCreationInput = {
    title: 'Test Wedding',
    event_date: '2024-12-25',
    location: 'Test Location',
    description: 'Test Description',
    is_public: false,
  };

  const mockHostProfile: HostGuestProfile = {
    full_name: 'John Doe',
    phone: '+1234567890',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabaseClient();
    // Set up authenticated user session that will pass validation
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: mockUserId },
          access_token: 'test-token',
        },
      },
      error: null,
    });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId, email: 'test@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createEventWithHost - Happy Path', () => {
    it('should successfully create event with host guest entry', async () => {
      // Session validation is handled in beforeEach

      // Mock successful event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: mockEventId,
                title: validEventInput.title,
                host_user_id: mockUserId,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock successful host profile fetch
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: mockHostProfile,
              error: null,
            }),
          }),
        }),
      });

      // Mock successful host guest creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      });

      // Execute the test
      const result: EventCreationResult =
        await EventCreationService.createEventWithHost(
          validEventInput,
          mockUserId,
        );

      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.event_id).toBe(mockEventId);
      expect(result.data?.title).toBe(validEventInput.title);
      expect(result.data?.host_user_id).toBe(mockUserId);
      expect(result.error).toBeUndefined();

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting event creation',
        expect.objectContaining({
          userId: mockUserId,
          title: validEventInput.title,
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event creation completed successfully',
        expect.objectContaining({
          eventId: mockEventId,
        }),
      );
    });

    it('should handle successful creation without image', async () => {
      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: mockEventId,
                title: validEventInput.title,
                host_user_id: mockUserId,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock host profile and guest creation
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: mockHostProfile,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValueOnce({
            data: null,
            error: null,
          }),
        });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.data?.header_image_url).toBeUndefined();
    });
  });

  describe('createEventWithHost - Failure Paths', () => {
    it('should handle authentication failure', async () => {
      // Mock failed session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Not authenticated' },
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.message).toBe(
        'Authentication error. Please try logging in again.',
      );
    });

    it('should handle image upload failure', async () => {
      const eventInputWithImage: EventCreationInput = {
        ...validEventInput,
        header_image: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
      };

      // Session validation is handled in beforeEach

      // Mock failed image upload
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' },
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' },
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        eventInputWithImage,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IMAGE_UPLOAD_ERROR');
      expect(result.error?.message).toBe('Upload failed');
    });

    it('should handle event insert failure', async () => {
      // Session validation is handled in beforeEach

      // Mock failed event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: '23505', message: 'Duplicate key violation' },
            }),
          }),
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('23505');
    });

    it('should handle guest insert failure with rollback', async () => {
      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: mockEventId,
                title: validEventInput.title,
                host_user_id: mockUserId,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock successful host profile fetch
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: mockHostProfile,
              error: null,
            }),
          }),
        }),
      });

      // Mock failed host guest creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '23514', message: 'Check constraint violation' },
        }),
      });

      // Mock successful rollback (event deletion)
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: null,
            error: null,
          }),
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HOST_GUEST_ERROR');
      expect(result.error?.message).toBe(
        'Failed to create host guest entry. Event creation rolled back.',
      );

      // Verify rollback logging was called
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Event rollback triggered due to guest insert failure',
        expect.objectContaining({
          eventId: mockEventId,
          userId: mockUserId,
          error: expect.objectContaining({
            code: '23514',
            message: 'Check constraint violation',
          }),
        }),
      );

      // Verify rollback success logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Event creation rolled back successfully',
        expect.objectContaining({
          eventId: mockEventId,
        }),
      );
    });

    it('should handle rollback failure gracefully', async () => {
      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: mockEventId,
                title: validEventInput.title,
                host_user_id: mockUserId,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock successful host profile fetch
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: mockHostProfile,
              error: null,
            }),
          }),
        }),
      });

      // Mock failed host guest creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '23514', message: 'Check constraint violation' },
        }),
      });

      // Mock failed rollback (event deletion fails)
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Delete failed' },
          }),
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      // Should still return failure even if rollback fails
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HOST_GUEST_ERROR');
    });

    it('should handle missing host profile gracefully', async () => {
      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: mockEventId,
                title: validEventInput.title,
                host_user_id: mockUserId,
                created_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock failed host profile fetch (no phone number)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: { full_name: 'John Doe', phone: null },
              error: null,
            }),
          }),
        }),
      });

      // Mock rollback
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: null,
            error: null,
          }),
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed input gracefully', async () => {
      const invalidInput = {
        ...validEventInput,
        title: '', // Empty title
      };

      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock event creation failure due to constraint
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: '23502', message: 'Not null violation' },
            }),
          }),
        }),
      });

      const result = await EventCreationService.createEventWithHost(
        invalidInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('23502');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock successful session validation
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock unexpected error during event creation
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Unexpected database error');
      });

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'An unexpected error occurred. Please try again.',
      );
    });
  });
});
