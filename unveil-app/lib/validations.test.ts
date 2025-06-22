import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  eventCreateSchema,
  guestCreateSchema,
  messageCreateSchema,
} from './validations';

describe('Email Validation', () => {
  describe('emailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'first+last@company.org',
      ];

      validEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
      ];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    });
  });
});

describe('Event Validation', () => {
  describe('eventCreateSchema', () => {
    it('should accept valid event data', () => {
      // Create a future date (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const validEvent = {
        title: 'Wedding Celebration',
        event_date: tomorrow.toISOString(), // Future date
        location: 'Napa Valley, CA',
        description: 'A beautiful wedding celebration',
      };

      expect(() => eventCreateSchema.parse(validEvent)).not.toThrow();
    });

    it('should require title and event_date', () => {
      // Create a future date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(() => eventCreateSchema.parse({ title: 'Test' })).toThrow();
      expect(() =>
        eventCreateSchema.parse({ event_date: tomorrow.toISOString() }),
      ).toThrow();
    });

    it('should validate date format', () => {
      const invalidEvent = {
        title: 'Test Event',
        event_date: 'invalid-date',
      };

      expect(() => eventCreateSchema.parse(invalidEvent)).toThrow();
    });
  });
});

describe('Guest Validation', () => {
  describe('guestCreateSchema', () => {
    it('should accept valid guest data', () => {
      const validGuest = {
        guest_name: 'John Doe',
        phone: '+14155552368',
        guest_email: 'john@example.com',
        notes: 'Plus one included',
        guest_tags: ['family', 'ceremony'],
      };

      expect(() => guestCreateSchema.parse(validGuest)).not.toThrow();
    });

    it('should require guest name', () => {
      const guestWithoutName = {
        guest_email: 'john@example.com',
        phone: '+14155552368',
      };

      expect(() => guestCreateSchema.parse(guestWithoutName)).toThrow();
    });

    it('should accept empty optional fields', () => {
      const minimalGuest = {
        guest_name: 'John Doe',
      };

      expect(() => guestCreateSchema.parse(minimalGuest)).not.toThrow();
    });

    it('should validate email format when provided', () => {
      const guestWithInvalidEmail = {
        guest_name: 'John Doe',
        guest_email: 'invalid-email',
      };

      expect(() => guestCreateSchema.parse(guestWithInvalidEmail)).toThrow();
    });
  });
});

describe('Message Validation', () => {
  describe('messageCreateSchema', () => {
    it('should accept valid message data', () => {
      const validMessage = {
        content: 'Hello everyone! Looking forward to the celebration.',
        message_type: 'announcement' as const,
        recipient_tags: ['all_guests'],
      };

      expect(() => messageCreateSchema.parse(validMessage)).not.toThrow();
    });

    it('should require content', () => {
      const messageWithoutContent = {
        message_type: 'announcement' as const,
      };

      expect(() => messageCreateSchema.parse(messageWithoutContent)).toThrow();
    });

    it('should validate message type enum', () => {
      const messageWithInvalidType = {
        content: 'Test message',
        message_type: 'invalid_type',
      };

      expect(() => messageCreateSchema.parse(messageWithInvalidType)).toThrow();
    });

    it('should limit content length', () => {
      const longContent = 'x'.repeat(2001); // 2000 char limit
      const messageWithLongContent = {
        content: longContent,
        message_type: 'direct' as const,
      };

      expect(() => messageCreateSchema.parse(messageWithLongContent)).toThrow();
    });
  });
});
