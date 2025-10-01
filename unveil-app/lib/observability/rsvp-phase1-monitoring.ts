/**
 * TEMPORARY: Phase 1 & 2 RSVP Monitoring
 * 
 * Logs audience counts for 24h post-Phase 2 to verify stability
 * AUTO-REMOVE: After 24h post-Phase 2 (2025-10-04)
 */

interface RSVPCounts {
  event_id: string;
  attending_count: number;
  declined_count: number;
  notify_count: number;
  total_count: number;
  timestamp: string;
}

const MONITORING_ENABLED = process.env.NODE_ENV === 'production' && 
  process.env.RSVP_PHASE1_MONITORING === 'true';

const MONITORING_END_DATE = new Date('2025-10-04T00:00:00Z'); // 24h after Phase 2 (extended)

/**
 * Log RSVP counts for monitoring (PII-safe)
 * Only logs counts, no names or phone numbers
 */
export function logRSVPCounts(eventId: string, guests: Array<{
  declined_at?: string | null;
  sms_opt_out?: boolean;
  phone?: string | null;
  removed_at?: string | null;
}>): void {
  // Skip if monitoring disabled or expired
  if (!MONITORING_ENABLED || new Date() > MONITORING_END_DATE) {
    return;
  }

  try {
    // Filter to active guests only
    const activeGuests = guests.filter(g => !g.removed_at);
    
    // Calculate counts using Phase 1 logic
    const attendingCount = activeGuests.filter(g => !g.declined_at).length;
    const declinedCount = activeGuests.filter(g => g.declined_at).length;
    const notifyCount = activeGuests.filter(g => 
      !g.declined_at && // Attending
      !g.sms_opt_out && // Not opted out
      g.phone && g.phone.trim() !== '' // Has phone
    ).length;

    const counts: RSVPCounts = {
      event_id: eventId,
      attending_count: attendingCount,
      declined_count: declinedCount,
      notify_count: notifyCount,
      total_count: activeGuests.length,
      timestamp: new Date().toISOString(),
    };

    // Log to console (will be captured by logging infrastructure)
    console.log('RSVP_PHASE1_COUNTS', JSON.stringify(counts));
    
    // Optional: Send to monitoring service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'rsvp_phase1_counts', {
        event_id: eventId,
        attending: attendingCount,
        declined: declinedCount,
        notify_eligible: notifyCount,
        total: activeGuests.length,
      });
    }
  } catch (error) {
    console.warn('RSVP Phase 1 monitoring error:', error);
  }
}

/**
 * Log audience selection results for messaging
 */
export function logAudienceSelection(eventId: string, filterType: string, resultCount: number): void {
  if (!MONITORING_ENABLED || new Date() > MONITORING_END_DATE) {
    return;
  }

  try {
    console.log('RSVP_PHASE1_AUDIENCE', JSON.stringify({
      event_id: eventId,
      filter_type: filterType,
      result_count: resultCount,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('RSVP Phase 1 audience monitoring error:', error);
  }
}

/**
 * Check if monitoring should be automatically disabled
 */
export function shouldDisableMonitoring(): boolean {
  return new Date() > MONITORING_END_DATE;
}

/**
 * Cleanup function to remove monitoring (call after 48h)
 */
export function cleanupPhase1Monitoring(): void {
  console.log('RSVP_PHASE1_MONITORING_CLEANUP', {
    timestamp: new Date().toISOString(),
    message: 'Phase 1 monitoring period ended',
  });
}
