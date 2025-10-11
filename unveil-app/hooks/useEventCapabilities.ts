/**
 * Centralized capability hook for role-based UI gating
 * 
 * This hook provides a consistent interface for checking what actions
 * a user can perform based on their role in an event.
 */

import { useMemo } from 'react';

export interface EventCapabilities {
  // Core role check
  isHost: boolean;
  isGuest: boolean;
  
  // Host capabilities
  canManageGuests: boolean;
  canSendAnnouncements: boolean;
  canSendChannels: boolean;
  canEditSchedule: boolean;
  canAccessHostDashboard: boolean;
  canEditEventDetails: boolean;
  canPromoteGuests: boolean;
  canDemoteHosts: boolean;
  
  // Shared capabilities
  canUploadMedia: boolean;
  canViewMessages: boolean;
  
  // Guest capabilities
  canDeclineEvent: boolean;
  canRejoinEvent: boolean;
}

export interface UseEventCapabilitiesProps {
  eventId: string;
  userRole: 'host' | 'guest' | null;
}

/**
 * Hook to determine user capabilities based on their role in an event
 * 
 * @param eventId - The event ID
 * @param userRole - The user's role in the event ('host' | 'guest' | null)
 * @returns EventCapabilities object with boolean flags for each capability
 */
export function useEventCapabilities({
  eventId,
  userRole,
}: UseEventCapabilitiesProps): EventCapabilities {
  return useMemo(() => {
    const isHost = userRole === 'host';
    const isGuest = userRole === 'guest';
    
    return {
      // Core role checks
      isHost,
      isGuest,
      
      // Host-only capabilities
      canManageGuests: isHost,
      canSendAnnouncements: isHost,
      canSendChannels: isHost,
      canEditSchedule: isHost,
      canAccessHostDashboard: isHost,
      canEditEventDetails: isHost,
      canPromoteGuests: isHost,
      canDemoteHosts: isHost,
      
      // Shared capabilities (both host and guest)
      canUploadMedia: isHost || isGuest,
      canViewMessages: isHost || isGuest,
      
      // Guest-only capabilities
      canDeclineEvent: isGuest,
      canRejoinEvent: isGuest,
    };
  }, [userRole]);
}

/**
 * Utility function to check if a user has a specific capability
 * Useful for inline checks without destructuring the full capabilities object
 */
export function hasCapability(
  capabilities: EventCapabilities,
  capability: keyof EventCapabilities
): boolean {
  return capabilities[capability] as boolean;
}

/**
 * Type guard to check if a capability key is valid
 */
export function isValidCapability(
  key: string
): key is keyof EventCapabilities {
  const validCapabilities: (keyof EventCapabilities)[] = [
    'isHost',
    'isGuest',
    'canManageGuests',
    'canSendAnnouncements',
    'canSendChannels',
    'canEditSchedule',
    'canAccessHostDashboard',
    'canEditEventDetails',
    'canPromoteGuests',
    'canDemoteHosts',
    'canUploadMedia',
    'canViewMessages',
    'canDeclineEvent',
    'canRejoinEvent',
  ];
  
  return validCapabilities.includes(key as keyof EventCapabilities);
}
