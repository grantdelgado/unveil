import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the CTA resolver logic (extracted from the component for testability)
type RSVPStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

interface CTAResolverInput {
  rsvpStatus: RSVPStatus;
  isPastEvent: boolean;
  isOngoing: boolean;
  hasPhotoAlbum: boolean;
}

interface CTAResult {
  label: string;
  icon: string;
  action: string; // Simplified for testing
}

function resolveGuestCTA(input: CTAResolverInput): CTAResult | null {
  const { rsvpStatus, isPastEvent, isOngoing, hasPhotoAlbum } = input;

  switch (rsvpStatus) {
    case 'PENDING':
      return {
        label: 'RSVP now',
        icon: 'user-check',
        action: 'scroll-to-rsvp',
      };

    case 'ACCEPTED':
      if (isPastEvent) {
        return {
          label: 'Share photos',
          icon: 'camera',
          action: hasPhotoAlbum ? 'open-album' : 'navigate-media',
        };
      } else {
        return {
          label: 'View schedule',
          icon: 'calendar',
          action: 'navigate-schedule',
        };
      }

    case 'DECLINED':
      if (!isPastEvent) {
        return {
          label: 'Change RSVP',
          icon: 'edit',
          action: 'open-decline-modal',
        };
      }
      break;

    default:
      return {
        label: 'RSVP now',
        icon: 'user-check',
        action: 'scroll-to-rsvp',
      };
  }

  return null; // "You're all set" case
}

describe('Guest CTA Resolver', () => {
  describe('PENDING status', () => {
    it('should show RSVP now for pending guests regardless of event timing', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'PENDING',
        isPastEvent: false,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'RSVP now',
        icon: 'user-check',
        action: 'scroll-to-rsvp',
      });
    });

    it('should show RSVP now even for past events when pending', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'PENDING',
        isPastEvent: true,
        isOngoing: false,
        hasPhotoAlbum: true,
      });

      expect(result).toEqual({
        label: 'RSVP now',
        icon: 'user-check',
        action: 'scroll-to-rsvp',
      });
    });
  });

  describe('ACCEPTED status', () => {
    it('should show View schedule for upcoming events', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'ACCEPTED',
        isPastEvent: false,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'View schedule',
        icon: 'calendar',
        action: 'navigate-schedule',
      });
    });

    it('should show View schedule for ongoing events', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'ACCEPTED',
        isPastEvent: false,
        isOngoing: true,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'View schedule',
        icon: 'calendar',
        action: 'navigate-schedule',
      });
    });

    it('should show Share photos for past events with photo album', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'ACCEPTED',
        isPastEvent: true,
        isOngoing: false,
        hasPhotoAlbum: true,
      });

      expect(result).toEqual({
        label: 'Share photos',
        icon: 'camera',
        action: 'open-album',
      });
    });

    it('should show Share photos for past events without photo album', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'ACCEPTED',
        isPastEvent: true,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'Share photos',
        icon: 'camera',
        action: 'navigate-media',
      });
    });
  });

  describe('DECLINED status', () => {
    it('should show Change RSVP for upcoming events', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'DECLINED',
        isPastEvent: false,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'Change RSVP',
        icon: 'edit',
        action: 'open-decline-modal',
      });
    });

    it('should show nothing (all set) for past events when declined', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'DECLINED',
        isPastEvent: true,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle unknown status by defaulting to RSVP now', () => {
      const result = resolveGuestCTA({
        rsvpStatus: 'UNKNOWN' as any,
        isPastEvent: false,
        isOngoing: false,
        hasPhotoAlbum: false,
      });

      expect(result).toEqual({
        label: 'RSVP now',
        icon: 'user-check',
        action: 'scroll-to-rsvp',
      });
    });
  });
});
