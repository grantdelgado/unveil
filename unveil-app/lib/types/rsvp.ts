/**
 * RSVP Status Types and Constants
 * 
 * Standardized RSVP status values to ensure consistency across the application.
 * This addresses the critical issue identified in the guest management audit
 * where mixed case values caused data inconsistencies and filter failures.
 */

export const RSVP_STATUS = {
  ATTENDING: 'attending',
  MAYBE: 'maybe',
  DECLINED: 'declined',
  PENDING: 'pending'
} as const;

export type RSVPStatus = typeof RSVP_STATUS[keyof typeof RSVP_STATUS];

/**
 * RSVP Status display configuration for UI components
 */
export const RSVP_STATUS_CONFIG = {
  [RSVP_STATUS.ATTENDING]: {
    label: 'Attending',
    emoji: '✅',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    activeColor: 'bg-green-100',
    activeTextColor: 'text-green-900'
  },
  [RSVP_STATUS.MAYBE]: {
    label: 'Maybe', 
    emoji: '🤷‍♂️',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-200',
    activeColor: 'bg-yellow-100',
    activeTextColor: 'text-yellow-900'
  },
  [RSVP_STATUS.DECLINED]: {
    label: 'Declined',
    emoji: '❌',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-200',
    activeColor: 'bg-red-100',
    activeTextColor: 'text-red-900'
  },
  [RSVP_STATUS.PENDING]: {
    label: 'Pending',
    emoji: '⏳',
    color: 'gray',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-200',
    activeColor: 'bg-gray-100',
    activeTextColor: 'text-gray-900'
  }
} as const;

/**
 * Get all available RSVP status values as an array
 */
export const RSVP_STATUS_VALUES = Object.values(RSVP_STATUS);

/**
 * Check if a value is a valid RSVP status
 */
export function isValidRSVPStatus(value: unknown): value is RSVPStatus {
  return typeof value === 'string' && RSVP_STATUS_VALUES.includes(value as RSVPStatus);
}

/**
 * Get the display configuration for an RSVP status
 */
export function getRSVPStatusConfig(status: RSVPStatus) {
  return RSVP_STATUS_CONFIG[status];
}

/**
 * Get a display-friendly label for an RSVP status
 */
export function getRSVPStatusLabel(status: RSVPStatus): string {
  return RSVP_STATUS_CONFIG[status].label;
}

/**
 * Get the emoji for an RSVP status
 */
export function getRSVPStatusEmoji(status: RSVPStatus): string {
  return RSVP_STATUS_CONFIG[status].emoji;
}

/**
 * Type guard for database row with RSVP status
 */
export interface WithRSVPStatus {
  rsvp_status: RSVPStatus | null;
}

/**
 * Safely get RSVP status with fallback to pending
 */
export function normalizeRSVPStatus(status: string | null | undefined): RSVPStatus {
  if (!status) return RSVP_STATUS.PENDING;
  
  // Handle legacy mixed-case values
  const normalized = status.toLowerCase();
  
  if (isValidRSVPStatus(normalized)) {
    return normalized;
  }
  
  // Handle common variations
  switch (normalized) {
    case 'yes':
    case 'confirmed':
    case 'going':
      return RSVP_STATUS.ATTENDING;
    case 'no':
    case 'not_going':
    case 'notgoing':
      return RSVP_STATUS.DECLINED;
    case 'unknown':
    case 'invited':
    case null:
    case undefined:
      return RSVP_STATUS.PENDING;
    default:
      console.warn(`Unknown RSVP status: ${status}, defaulting to pending`);
      return RSVP_STATUS.PENDING;
  }
}

/**
 * Count guests by RSVP status
 */
export function countGuestsByRSVP<T extends WithRSVPStatus>(guests: T[]) {
  return guests.reduce((counts, guest) => {
    const status = normalizeRSVPStatus(guest.rsvp_status);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<RSVPStatus, number>);
}

/**
 * Get RSVP status counts with totals
 */
export function getGuestStatusCounts<T extends WithRSVPStatus>(guests: T[]) {
  const counts = countGuestsByRSVP(guests);
  
  return {
    total: guests.length,
    attending: counts[RSVP_STATUS.ATTENDING] || 0,
    maybe: counts[RSVP_STATUS.MAYBE] || 0,
    declined: counts[RSVP_STATUS.DECLINED] || 0,
    pending: counts[RSVP_STATUS.PENDING] || 0,
    // Derived metrics
    confirmed: (counts[RSVP_STATUS.ATTENDING] || 0) + (counts[RSVP_STATUS.MAYBE] || 0),
    responded: guests.length - (counts[RSVP_STATUS.PENDING] || 0)
  };
}

/**
 * Filter guests by RSVP status
 */
export function filterGuestsByRSVP<T extends WithRSVPStatus>(
  guests: T[], 
  status: RSVPStatus | 'all'
): T[] {
  if (status === 'all') return guests;
  
  return guests.filter(guest => {
    const guestStatus = normalizeRSVPStatus(guest.rsvp_status);
    return guestStatus === status;
  });
}