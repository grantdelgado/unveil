import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEventTagExtended } from '@/lib/sms-formatter';

// Mock URL utilities
vi.mock('@/lib/utils/url', () => ({
  buildInviteLink: vi.fn(() => 'https://app.sendunveil.com'),
}));

describe('SMS Invite Core Functions', () => {
  describe('generateEventTagExtended', () => {
    it('should use custom SMS tag when provided', () => {
      const tag = generateEventTagExtended('Sarah + David', 'Wedding Event', 24);
      expect(tag).toBe('Sarah + David');
    });

    it('should truncate custom tag to max length', () => {
      const longTag = 'Sarah + David Wedding 2025';
      const tag = generateEventTagExtended(longTag, 'Wedding Event', 20);
      expect(tag).toBe('Sarah + David Weddin');
      expect(tag.length).toBe(20);
    });

    it('should auto-generate from title when no custom tag', () => {
      const tag = generateEventTagExtended(null, 'Sarah & David Wedding', 24);
      expect(tag).toBe('Sarah David Wedding');
    });

    it('should handle single word titles', () => {
      const tag = generateEventTagExtended(null, 'Wedding', 24);
      expect(tag).toBe('Wedding');
    });

    it('should handle empty/null titles', () => {
      const tag = generateEventTagExtended(null, '', 24);
      expect(tag).toBe('Event');
    });

    it('should respect max length for generated tags', () => {
      const tag = generateEventTagExtended(null, 'Very Long Event Title That Should Be Truncated', 15);
      expect(tag.length).toBeLessThanOrEqual(15);
    });

    it('should handle 24 character limit properly', () => {
      const tag = generateEventTagExtended('Sarah and David Wedding', 'Wedding Event', 24);
      expect(tag).toBe('Sarah and David Wedding');
      expect(tag.length).toBe(23);
    });

    it('should generate readable tags with spaces for longer limits', () => {
      const tag = generateEventTagExtended(null, 'Sarah and David Summer Wedding', 24);
      // The algorithm distributes space among words, so exact output may vary
      expect(tag.length).toBeLessThanOrEqual(24);
      expect(tag).toContain('Sarah');
      expect(tag).toContain('Dav'); // "David" gets abbreviated to "Dav"
    });
  });

  describe('New Invite Template', () => {
    it('should create logistics-focused message', async () => {
      const { createInvitationMessage } = await import('@/lib/sms-invitations');
      
      const invitation = {
        eventId: 'event-123',
        eventTitle: 'Sarah & David Wedding',
        eventDate: 'Saturday, February 15th',
        hostName: 'Sarah',
        guestPhone: '+1234567890',
      };

      const message = createInvitationMessage(invitation, { isFirstContact: false });
      
      expect(message).toContain('Get ready!');
      expect(message).toContain('Wedding updates will come from this number');
      expect(message).toContain('you can find details on Unveil');
      expect(message).toContain('https://app.sendunveil.com');
      expect(message).not.toContain('RSVP');
      expect(message).not.toContain('invited');
    });

    it('should include STOP notice for first contact', async () => {
      const { createInvitationMessage } = await import('@/lib/sms-invitations');
      
      const invitation = {
        eventId: 'event-123',
        eventTitle: 'Sarah & David Wedding',
        eventDate: 'Saturday, February 15th',
        hostName: 'Sarah',
        guestPhone: '+1234567890',
      };

      const messageFirst = createInvitationMessage(invitation, { isFirstContact: true });
      const messageReturning = createInvitationMessage(invitation, { isFirstContact: false });
      
      expect(messageFirst).toContain('Reply STOP to opt out.');
      expect(messageReturning).not.toContain('Reply STOP');
    });

    it('should be reasonably short for single segment targeting', async () => {
      const { createInvitationMessage } = await import('@/lib/sms-invitations');
      
      const invitation = {
        eventId: 'event-123',
        eventTitle: 'Sarah & David Wedding',
        eventDate: 'Saturday, February 15th',
        hostName: 'Sarah',
        guestPhone: '+1234567890',
      };

      const messageWithStop = createInvitationMessage(invitation, { isFirstContact: true });
      const messageWithoutStop = createInvitationMessage(invitation, { isFirstContact: false });
      
      // Base message should be 114 chars (ultra-optimized for single segment with event tag)
      expect(messageWithoutStop.length).toBe(114);
      expect(messageWithStop.length).toBe(137); // With STOP notice
    });

    it('should use root URL and optimized copy', async () => {
      const { createInvitationMessage } = await import('@/lib/sms-invitations');
      
      const invitation = {
        eventId: 'event-123',
        eventTitle: 'Sarah & David Wedding',
        eventDate: 'Saturday, February 15th',
        hostName: 'Sarah',
        guestPhone: '+1234567890',
      };

      const messageWithoutStop = createInvitationMessage(invitation, { isFirstContact: false });
      const messageWithStop = createInvitationMessage(invitation, { isFirstContact: true });
      
      // Should use root URL (not /select-event)
      expect(messageWithoutStop).toContain('https://app.sendunveil.com');
      expect(messageWithoutStop).not.toContain('/select-event');
      
      // Should have ultra-optimized copy
      expect(messageWithoutStop).toBe('Get ready! Wedding updates will come from this number + you can find details on Unveil: https://app.sendunveil.com');
      expect(messageWithStop).toBe('Get ready! Wedding updates will come from this number + you can find details on Unveil: https://app.sendunveil.com Reply STOP to opt out.');
      
      // Verify lengths
      expect(messageWithoutStop.length).toBe(114);
      expect(messageWithStop.length).toBe(137);
    });
  });
});
