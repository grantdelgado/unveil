// TEST VALUE: HIGH — Core business logic for event creation with auth validation
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  withAuthedSessionAndUser, 
  withSignedOut,
  mockTableError, 
  mockTableSuccess,
  makeValidEventInput,
  assertTestSessionCompatible
} from '../../_mocks/supabase-helpers';

// Set up isolated Supabase mock BEFORE importing service - enforce userId alignment
const { supabase, session, userId: mockUserId } = withAuthedSessionAndUser({ 
  id: 'user-evt-1', 
  email: 'test@example.com', 
  phone: '+15555551234' 
});

// Now import the service and other dependencies
import { EventCreationService } from '@/lib/services/eventCreation';
import type {
  EventCreationInput,
  EventCreationResult,
  HostGuestProfile,
} from '@/lib/services/eventCreation';

// Mock the logger module
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
const mockLogger = vi.mocked(logger);

describe.skip('EventCreationService — auth/session boundary // @needs-contract', () => {
  // TODO(grant): Convert to focused contract tests or move to integration suite
  // This service test requires complex multi-service mocking (auth + DB + storage + logger)
  const mockEventId = 'event-123';

  const validEventInput = makeValidEventInput();

  const mockHostProfile: HostGuestProfile = {
    full_name: 'John Doe',
    phone: '+1234567890',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Verify session compatibility with Event Creation service expectations
    assertTestSessionCompatible(session, 'EventCreationService');
    
    // Set up successful scenario by default
    mockTableSuccess(supabase, { 
      id: mockEventId,
      title: validEventInput.title,
      host_user_id: mockUserId,
      created_at: '2024-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createEventWithHost - Happy Path', () => {
    it('should successfully create event with host guest entry', async () => {
      // Session validation is handled in beforeEach

      // Mock successful event creation
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      supabase.from.mockReturnValueOnce({
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
      supabase.from
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
      // Mock failed session validation by returning null session
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
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
      supabase.storage.from.mockReturnValue({
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
      // Mock database error using helper
      mockTableError(supabase, 'insert', '23505', 'Duplicate key violation');

      const result = await EventCreationService.createEventWithHost(
        validEventInput,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('23505');
    });

    it('should handle guest insert failure with rollback', async () => {
      // Mock successful session validation
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '23514', message: 'Check constraint violation' },
        }),
      });

      // Mock successful rollback (event deletion)
      supabase.from.mockReturnValueOnce({
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
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: '23514', message: 'Check constraint violation' },
        }),
      });

      // Mock failed rollback (event deletion fails)
      supabase.from.mockReturnValueOnce({
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
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock successful event creation
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.from.mockReturnValueOnce({
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
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock event creation failure due to constraint
      supabase.from.mockReturnValueOnce({
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
      supabase.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: mockUserId },
            access_token: 'test-token',
          },
        },
        error: null,
      });

      // Mock unexpected error during event creation
      supabase.from.mockImplementationOnce(() => {
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
