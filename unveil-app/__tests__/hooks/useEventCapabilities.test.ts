/**
 * Unit tests for useEventCapabilities hook
 */

import { renderHook } from '@testing-library/react';
import { useEventCapabilities, hasCapability, isValidCapability } from '@/hooks/useEventCapabilities';

describe('useEventCapabilities', () => {
  const mockEventId = 'test-event-id';

  describe('Host capabilities', () => {
    it('should grant all host capabilities when user is host', () => {
      const { result } = renderHook(() =>
        useEventCapabilities({
          eventId: mockEventId,
          userRole: 'host',
        })
      );

      const capabilities = result.current;

      // Core role checks
      expect(capabilities.isHost).toBe(true);
      expect(capabilities.isGuest).toBe(false);

      // Host-only capabilities
      expect(capabilities.canManageGuests).toBe(true);
      expect(capabilities.canSendAnnouncements).toBe(true);
      expect(capabilities.canSendChannels).toBe(true);
      expect(capabilities.canEditSchedule).toBe(true);
      expect(capabilities.canAccessHostDashboard).toBe(true);
      expect(capabilities.canEditEventDetails).toBe(true);
      expect(capabilities.canPromoteGuests).toBe(true);
      expect(capabilities.canDemoteHosts).toBe(true);

      // Shared capabilities
      expect(capabilities.canUploadMedia).toBe(true);
      expect(capabilities.canViewMessages).toBe(true);

      // Guest-only capabilities (should be false for host)
      expect(capabilities.canDeclineEvent).toBe(false);
      expect(capabilities.canRejoinEvent).toBe(false);
    });
  });

  describe('Guest capabilities', () => {
    it('should grant appropriate capabilities when user is guest', () => {
      const { result } = renderHook(() =>
        useEventCapabilities({
          eventId: mockEventId,
          userRole: 'guest',
        })
      );

      const capabilities = result.current;

      // Core role checks
      expect(capabilities.isHost).toBe(false);
      expect(capabilities.isGuest).toBe(true);

      // Host-only capabilities (should be false for guest)
      expect(capabilities.canManageGuests).toBe(false);
      expect(capabilities.canSendAnnouncements).toBe(false);
      expect(capabilities.canSendChannels).toBe(false);
      expect(capabilities.canEditSchedule).toBe(false);
      expect(capabilities.canAccessHostDashboard).toBe(false);
      expect(capabilities.canEditEventDetails).toBe(false);
      expect(capabilities.canPromoteGuests).toBe(false);
      expect(capabilities.canDemoteHosts).toBe(false);

      // Shared capabilities
      expect(capabilities.canUploadMedia).toBe(true);
      expect(capabilities.canViewMessages).toBe(true);

      // Guest-only capabilities
      expect(capabilities.canDeclineEvent).toBe(true);
      expect(capabilities.canRejoinEvent).toBe(true);
    });
  });

  describe('No role (null)', () => {
    it('should deny all capabilities when user has no role', () => {
      const { result } = renderHook(() =>
        useEventCapabilities({
          eventId: mockEventId,
          userRole: null,
        })
      );

      const capabilities = result.current;

      // All capabilities should be false
      Object.entries(capabilities).forEach(([key, value]) => {
        expect(value).toBe(false);
      });
    });
  });

  describe('Memoization', () => {
    it('should return the same object reference when inputs do not change', () => {
      const { result, rerender } = renderHook(
        ({ userRole }) =>
          useEventCapabilities({
            eventId: mockEventId,
            userRole,
          }),
        {
          initialProps: { userRole: 'host' as const },
        }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ userRole: 'host' as const });

      expect(result.current).toBe(firstResult);
    });

    it('should return different object when userRole changes', () => {
      const { result, rerender } = renderHook(
        ({ userRole }) =>
          useEventCapabilities({
            eventId: mockEventId,
            userRole,
          }),
        {
          initialProps: { userRole: 'host' as const },
        }
      );

      const firstResult = result.current;

      // Rerender with different role
      rerender({ userRole: 'guest' as const });

      expect(result.current).not.toBe(firstResult);
      expect(result.current.isHost).toBe(false);
      expect(result.current.isGuest).toBe(true);
    });
  });
});

describe('hasCapability utility', () => {
  it('should correctly check capability existence', () => {
    const hostCapabilities = {
      isHost: true,
      isGuest: false,
      canManageGuests: true,
      canSendAnnouncements: true,
      canSendChannels: true,
      canEditSchedule: true,
      canAccessHostDashboard: true,
      canEditEventDetails: true,
      canPromoteGuests: true,
      canDemoteHosts: true,
      canUploadMedia: true,
      canViewMessages: true,
      canDeclineEvent: false,
      canRejoinEvent: false,
    };

    expect(hasCapability(hostCapabilities, 'canManageGuests')).toBe(true);
    expect(hasCapability(hostCapabilities, 'canDeclineEvent')).toBe(false);
    expect(hasCapability(hostCapabilities, 'isHost')).toBe(true);
    expect(hasCapability(hostCapabilities, 'isGuest')).toBe(false);
  });
});

describe('isValidCapability type guard', () => {
  it('should return true for valid capability keys', () => {
    expect(isValidCapability('isHost')).toBe(true);
    expect(isValidCapability('canManageGuests')).toBe(true);
    expect(isValidCapability('canSendAnnouncements')).toBe(true);
    expect(isValidCapability('canDeclineEvent')).toBe(true);
  });

  it('should return false for invalid capability keys', () => {
    expect(isValidCapability('invalidCapability')).toBe(false);
    expect(isValidCapability('canDoAnything')).toBe(false);
    expect(isValidCapability('')).toBe(false);
    expect(isValidCapability('123')).toBe(false);
  });
});
