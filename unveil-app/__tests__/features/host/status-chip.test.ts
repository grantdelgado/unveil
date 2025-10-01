import { describe, it, expect } from 'vitest';
import { getRSVPStatus } from '@/components/features/host-dashboard/StatusChip';

describe('Status Chip Utilities', () => {
  describe('getRSVPStatus', () => {
    it('should return declined when guest has declined_at', () => {
      const guest = {
        declined_at: '2025-01-01T00:00:00.000Z',
        rsvp_status: 'attending',
        last_invited_at: '2024-12-01T00:00:00.000Z',
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('declined');
    });

    it('should return attending when guest has rsvp_status attending and no decline', () => {
      const guest = {
        declined_at: null,
        rsvp_status: 'attending',
        last_invited_at: '2024-12-01T00:00:00.000Z',
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('attending');
    });

    it('should return no_response when guest was invited but has not responded', () => {
      const guest = {
        declined_at: null,
        rsvp_status: null,
        last_invited_at: '2024-12-01T00:00:00.000Z',
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('no_response');
    });

    it('should return no_response when guest was invited but has pending status', () => {
      const guest = {
        declined_at: null,
        rsvp_status: 'pending',
        last_invited_at: '2024-12-01T00:00:00.000Z',
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('no_response');
    });

    it('should return pending when guest has not been invited yet', () => {
      const guest = {
        declined_at: null,
        rsvp_status: null,
        last_invited_at: null,
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('pending');
    });

    it('should prioritize declined status over other statuses', () => {
      const guest = {
        declined_at: '2025-01-01T00:00:00.000Z',
        rsvp_status: 'attending', // This should be ignored
        last_invited_at: '2024-12-01T00:00:00.000Z',
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('declined');
    });

    it('should handle undefined fields gracefully', () => {
      const guest = {};

      const result = getRSVPStatus(guest);

      expect(result).toBe('pending');
    });

    it('should handle mixed null and undefined fields', () => {
      const guest = {
        declined_at: undefined,
        rsvp_status: null,
        last_invited_at: undefined,
      };

      const result = getRSVPStatus(guest);

      expect(result).toBe('pending');
    });

    describe('edge cases', () => {
      it('should handle empty string as falsy for declined_at', () => {
        const guest = {
          declined_at: '',
          rsvp_status: 'attending',
          last_invited_at: '2024-12-01T00:00:00.000Z',
        };

        const result = getRSVPStatus(guest);

        expect(result).toBe('attending');
      });

      it('should handle empty string as falsy for last_invited_at', () => {
        const guest = {
          declined_at: null,
          rsvp_status: null,
          last_invited_at: '',
        };

        const result = getRSVPStatus(guest);

        expect(result).toBe('pending');
      });

      it('should handle non-standard rsvp_status values', () => {
        const guest = {
          declined_at: null,
          rsvp_status: 'maybe',
          last_invited_at: '2024-12-01T00:00:00.000Z',
        };

        const result = getRSVPStatus(guest);

        expect(result).toBe('no_response');
      });
    });
  });
});
