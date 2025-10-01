/**
 * RSVP Model Invariants Test Suite
 * 
 * These tests lock in the canonical RSVP model post-rsvp_status removal:
 * - Attending = declined_at IS NULL
 * - Declined = declined_at IS NOT NULL  
 * - Notify eligible = declined_at IS NULL AND sms_opt_out = FALSE
 */

import { describe, it, expect } from 'vitest';

// Test fixtures representing different RSVP states
const testGuests = [
  // Attending guests
  {
    id: 'guest-1',
    declined_at: null,
    sms_opt_out: false,
    phone: '+1234567890',
    removed_at: null,
  },
  {
    id: 'guest-2', 
    declined_at: null,
    sms_opt_out: false,
    phone: '+1987654321',
    removed_at: null,
  },
  // Attending but opted out of SMS
  {
    id: 'guest-3',
    declined_at: null,
    sms_opt_out: true,
    phone: '+1555555555',
    removed_at: null,
  },
  // Declined guest (automatically opted out)
  {
    id: 'guest-4',
    declined_at: '2025-09-30T10:00:00Z',
    sms_opt_out: true,
    phone: '+1777777777',
    removed_at: null,
  },
  // Removed guest (should be excluded from all counts)
  {
    id: 'guest-5',
    declined_at: null,
    sms_opt_out: false,
    phone: '+1999999999',
    removed_at: '2025-09-29T15:00:00Z',
  },
];

describe('RSVP Model Invariants', () => {
  describe('Attending Status Invariant', () => {
    it('should identify attending guests as declined_at IS NULL', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      const attendingGuests = activeGuests.filter(g => !g.declined_at);
      
      expect(attendingGuests).toHaveLength(3);
      expect(attendingGuests.map(g => g.id)).toEqual(['guest-1', 'guest-2', 'guest-3']);
      
      // Verify all attending guests have declined_at as null
      attendingGuests.forEach(guest => {
        expect(guest.declined_at).toBeNull();
      });
    });

    it('should exclude removed guests from attending count', () => {
      const attendingGuests = testGuests.filter(g => !g.declined_at && !g.removed_at);
      
      expect(attendingGuests).toHaveLength(3);
      expect(attendingGuests.find(g => g.id === 'guest-5')).toBeUndefined();
    });
  });

  describe('Declined Status Invariant', () => {
    it('should identify declined guests as declined_at IS NOT NULL', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      const declinedGuests = activeGuests.filter(g => g.declined_at);
      
      expect(declinedGuests).toHaveLength(1);
      expect(declinedGuests[0].id).toBe('guest-4');
      expect(declinedGuests[0].declined_at).toBe('2025-09-30T10:00:00Z');
    });

    it('should ensure declined guests are automatically opted out', () => {
      const declinedGuests = testGuests.filter(g => g.declined_at && !g.removed_at);
      
      declinedGuests.forEach(guest => {
        expect(guest.sms_opt_out).toBe(true);
      });
    });
  });

  describe('Notification Eligibility Invariant', () => {
    it('should identify notify eligible as declined_at IS NULL AND sms_opt_out = FALSE', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      const notifyEligible = activeGuests.filter(g => 
        !g.declined_at && // Attending
        !g.sms_opt_out && // Not opted out
        g.phone && g.phone.trim() !== '' // Has phone
      );
      
      expect(notifyEligible).toHaveLength(2);
      expect(notifyEligible.map(g => g.id)).toEqual(['guest-1', 'guest-2']);
    });

    it('should exclude attending guests who opted out of SMS', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      const attendingButOptedOut = activeGuests.filter(g => 
        !g.declined_at && g.sms_opt_out
      );
      
      expect(attendingButOptedOut).toHaveLength(1);
      expect(attendingButOptedOut[0].id).toBe('guest-3');
      
      // These should NOT be in notify eligible list
      const notifyEligible = activeGuests.filter(g => 
        !g.declined_at && !g.sms_opt_out && g.phone
      );
      
      expect(notifyEligible.find(g => g.id === 'guest-3')).toBeUndefined();
    });

    it('should exclude declined guests from notifications', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      const notifyEligible = activeGuests.filter(g => 
        !g.declined_at && !g.sms_opt_out && g.phone
      );
      
      expect(notifyEligible.find(g => g.id === 'guest-4')).toBeUndefined();
    });
  });

  describe('Count Calculations', () => {
    it('should calculate correct RSVP counts', () => {
      const activeGuests = testGuests.filter(g => !g.removed_at);
      
      const counts = {
        total: activeGuests.length,
        attending: activeGuests.filter(g => !g.declined_at).length,
        declined: activeGuests.filter(g => g.declined_at).length,
        notifyEligible: activeGuests.filter(g => 
          !g.declined_at && !g.sms_opt_out && g.phone
        ).length,
      };
      
      expect(counts.total).toBe(4);
      expect(counts.attending).toBe(3);
      expect(counts.declined).toBe(1);
      expect(counts.notifyEligible).toBe(2);
      
      // Invariant: attending + declined = total
      expect(counts.attending + counts.declined).toBe(counts.total);
      
      // Invariant: notifyEligible <= attending
      expect(counts.notifyEligible).toBeLessThanOrEqual(counts.attending);
    });
  });

  describe('State Transitions', () => {
    it('should handle guest decline transition correctly', () => {
      const guest = {
        id: 'guest-test',
        declined_at: null,
        sms_opt_out: false,
        phone: '+1000000000',
        removed_at: null,
      };
      
      // Initially attending and notify eligible
      expect(guest.declined_at).toBeNull();
      expect(guest.sms_opt_out).toBe(false);
      
      // After decline (atomic operation)
      const declinedGuest = {
        ...guest,
        declined_at: new Date().toISOString(),
        sms_opt_out: true, // Automatically set on decline
      };
      
      expect(declinedGuest.declined_at).not.toBeNull();
      expect(declinedGuest.sms_opt_out).toBe(true);
      
      // Should no longer be notify eligible
      const isNotifyEligible = !declinedGuest.declined_at && 
                              !declinedGuest.sms_opt_out && 
                              declinedGuest.phone;
      expect(isNotifyEligible).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle guests without phone numbers', () => {
      const guestWithoutPhone = {
        id: 'guest-no-phone',
        declined_at: null,
        sms_opt_out: false,
        phone: null,
        removed_at: null,
      };
      
      // Should be attending but not notify eligible
      const isAttending = !guestWithoutPhone.declined_at;
      const isNotifyEligible = !guestWithoutPhone.declined_at && 
                              !guestWithoutPhone.sms_opt_out && 
                              guestWithoutPhone.phone;
      
      expect(isAttending).toBe(true);
      expect(isNotifyEligible).toBe(false);
    });

    it('should handle null/undefined sms_opt_out as false', () => {
      const guestWithNullOptOut = {
        id: 'guest-null-opt',
        declined_at: null,
        sms_opt_out: null,
        phone: '+1000000001',
        removed_at: null,
      };
      
      // Should treat null sms_opt_out as false (not opted out)
      const isNotifyEligible = !guestWithNullOptOut.declined_at && 
                              !guestWithNullOptOut.sms_opt_out && 
                              guestWithNullOptOut.phone;
      
      expect(isNotifyEligible).toBe(true);
    });
  });
});
