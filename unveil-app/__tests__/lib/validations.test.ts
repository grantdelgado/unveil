import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scheduledMessageSchema } from '@/lib/validations';

describe('Scheduled Message Validation', () => {
  const originalEnv = process.env.SCHEDULE_MIN_LEAD_SECONDS;

  beforeEach(() => {
    // Set a known value for consistent testing
    process.env.SCHEDULE_MIN_LEAD_SECONDS = '180';
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.SCHEDULE_MIN_LEAD_SECONDS = originalEnv;
    } else {
      delete process.env.SCHEDULE_MIN_LEAD_SECONDS;
    }
  });

  describe('scheduledMessageSchema', () => {
    const baseValidData = {
      content: 'Test message content',
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      messageType: 'announcement' as const,
    };

    describe('content validation', () => {
      it('should accept valid content', () => {
        const data = {
          ...baseValidData,
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(), // 5 min from now
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject empty content', () => {
        const data = {
          ...baseValidData,
          content: '',
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Message content is required');
        }
      });

      it('should reject content over 1000 characters', () => {
        const data = {
          ...baseValidData,
          content: 'A'.repeat(1001),
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Message must be less than 1000 characters');
        }
      });

      it('should trim whitespace from content', () => {
        const data = {
          ...baseValidData,
          content: '  Test message  ',
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.content).toBe('Test message');
        }
      });
    });

    describe('scheduledAtUtc validation', () => {
      it('should accept time exactly at minimum lead time', () => {
        const scheduledTime = new Date(Date.now() + 180000); // Exactly 3 minutes from now
        const data = {
          ...baseValidData,
          scheduledAtUtc: scheduledTime.toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should accept time well beyond minimum lead time', () => {
        const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now
        const data = {
          ...baseValidData,
          scheduledAtUtc: scheduledTime.toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject time less than minimum lead time', () => {
        const scheduledTime = new Date(Date.now() + 120000); // 2 minutes from now (< 3 min required)
        const data = {
          ...baseValidData,
          scheduledAtUtc: scheduledTime.toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Scheduled time must be at least 3 minutes from now');
        }
      });

      it('should reject past times', () => {
        const pastTime = new Date(Date.now() - 60000); // 1 minute ago
        const data = {
          ...baseValidData,
          scheduledAtUtc: pastTime.toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Scheduled time must be at least 3 minutes from now');
        }
      });

      it('should reject invalid datetime format', () => {
        const data = {
          ...baseValidData,
          scheduledAtUtc: 'invalid-date',
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Invalid datetime format');
        }
      });
    });

    describe('eventId validation', () => {
      it('should accept valid UUID', () => {
        const data = {
          ...baseValidData,
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID', () => {
        const data = {
          ...baseValidData,
          eventId: 'invalid-uuid',
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Invalid event ID');
        }
      });
    });

    describe('messageType validation', () => {
      it('should accept valid message types', () => {
        const validTypes = ['direct', 'announcement', 'channel'] as const;
        
        for (const messageType of validTypes) {
          const data = {
            ...baseValidData,
            messageType,
            scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
          };
          
          const result = scheduledMessageSchema.safeParse(data);
          expect(result.success).toBe(true);
        }
      });

      it('should default to announcement when not provided', () => {
        const { messageType, ...dataWithoutType } = baseValidData;
        const data = {
          ...dataWithoutType,
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.messageType).toBe('announcement');
        }
      });

      it('should reject invalid message type', () => {
        const data = {
          ...baseValidData,
          messageType: 'invalid' as any,
          scheduledAtUtc: new Date(Date.now() + 300000).toISOString(),
        };
        
        const result = scheduledMessageSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });
});
