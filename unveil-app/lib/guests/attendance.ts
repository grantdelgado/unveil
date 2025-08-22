/**
 * Guest Attendance Utilities (RSVP-Lite)
 *
 * Centralized helpers for guest attendance logic using declined_at semantics.
 * This is the single source of truth for attendance calculations.
 */

export interface GuestAttendance {
  id: string;
  declined_at: string | null;
  decline_reason?: string | null;
}

/**
 * Check if a guest is attending (RSVP-Lite semantics)
 * @param guest Guest record with declined_at field
 * @returns true if guest is attending (declined_at IS NULL)
 */
export function isAttending(guest: GuestAttendance): boolean {
  return guest.declined_at === null;
}

/**
 * Check if a guest has declined (RSVP-Lite semantics)
 * @param guest Guest record with declined_at field
 * @returns true if guest has declined (declined_at IS NOT NULL)
 */
export function isDeclined(guest: GuestAttendance): boolean {
  return guest.declined_at !== null;
}

/**
 * Get attendance status as string
 * @param guest Guest record with declined_at field
 * @returns 'attending' or 'declined'
 */
export function getAttendanceStatus(
  guest: GuestAttendance,
): 'attending' | 'declined' {
  return isAttending(guest) ? 'attending' : 'declined';
}

/**
 * Calculate attendance counts for a list of guests
 * @param guests Array of guest records with declined_at field
 * @returns Object with attending, declined, and total counts
 */
export function calculateAttendanceCounts<T extends GuestAttendance>(
  guests: T[],
) {
  const attending = guests.filter(isAttending).length;
  const declined = guests.filter(isDeclined).length;

  return {
    total: guests.length,
    attending,
    declined,
  };
}

/**
 * Filter guests by attendance status
 * @param guests Array of guest records
 * @param status 'all', 'attending', or 'declined'
 * @returns Filtered array of guests
 */
export function filterGuestsByAttendance<T extends GuestAttendance>(
  guests: T[],
  status: 'all' | 'attending' | 'declined',
): T[] {
  switch (status) {
    case 'attending':
      return guests.filter(isAttending);
    case 'declined':
      return guests.filter(isDeclined);
    case 'all':
    default:
      return guests;
  }
}

/**
 * Get display label for attendance status
 * @param status Attendance status
 * @returns Human-readable label
 */
export function getAttendanceLabel(status: 'attending' | 'declined'): string {
  switch (status) {
    case 'attending':
      return 'Attending';
    case 'declined':
      return 'Declined';
    default:
      return 'Unknown';
  }
}
