/**
 * RSVP Ops Metrics - Lightweight Telemetry for Operations Dashboard
 * 
 * Provides PII-safe RSVP count metrics for monitoring and alerting.
 * Only emits aggregate counts, never guest identifiers or personal data.
 */

interface RSVPMetrics {
  event_id: string;
  attending_count: number;
  declined_count: number;
  notify_eligible_count: number;
  total_active_guests: number;
  timestamp: string;
  environment: string;
}

interface GuestData {
  declined_at?: string | null;
  sms_opt_out?: boolean | null;
  phone?: string | null;
  removed_at?: string | null;
}

const METRICS_ENABLED = process.env.NODE_ENV === 'production' && 
  process.env.RSVP_METRICS_ENABLED === 'true';

const METRICS_ENDPOINT = process.env.METRICS_ENDPOINT || 'https://metrics.unveil.app/rsvp';

/**
 * Calculate RSVP metrics from guest data (PII-safe)
 */
export function calculateRSVPMetrics(
  eventId: string, 
  guests: GuestData[]
): RSVPMetrics {
  // Filter to active guests only
  const activeGuests = guests.filter(g => !g.removed_at);
  
  // Calculate counts using canonical RSVP model
  const attendingCount = activeGuests.filter(g => !g.declined_at).length;
  const declinedCount = activeGuests.filter(g => g.declined_at).length;
  const notifyEligibleCount = activeGuests.filter(g => 
    !g.declined_at && // Attending
    !g.sms_opt_out && // Not opted out  
    g.phone && g.phone.trim() !== '' // Has phone
  ).length;

  return {
    event_id: eventId,
    attending_count: attendingCount,
    declined_count: declinedCount,
    notify_eligible_count: notifyEligibleCount,
    total_active_guests: activeGuests.length,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * Emit RSVP metrics to ops dashboard (production only)
 */
export async function emitRSVPMetrics(metrics: RSVPMetrics): Promise<void> {
  if (!METRICS_ENABLED) {
    return;
  }

  try {
    // Log to console for ops tooling to collect
    console.log('RSVP_OPS_METRICS', JSON.stringify(metrics));
    
    // Send to metrics endpoint if configured
    if (METRICS_ENDPOINT && typeof fetch !== 'undefined') {
      await fetch(METRICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'unveil-rsvp-metrics/1.0',
        },
        body: JSON.stringify(metrics),
      }).catch(error => {
        console.warn('Failed to send RSVP metrics to endpoint:', error);
      });
    }
    
    // Send to analytics if available (client-side)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'rsvp_metrics', {
        event_id: metrics.event_id,
        attending: metrics.attending_count,
        declined: metrics.declined_count,
        notify_eligible: metrics.notify_eligible_count,
        total: metrics.total_active_guests,
      });
    }
  } catch (error) {
    console.warn('Error emitting RSVP metrics:', error);
  }
}

/**
 * Hourly RSVP metrics collection hook
 */
export function useRSVPMetrics(eventId: string, guests: GuestData[]) {
  if (!METRICS_ENABLED || typeof window === 'undefined') {
    return;
  }

  // Emit metrics hourly
  const emitMetrics = () => {
    const metrics = calculateRSVPMetrics(eventId, guests);
    emitRSVPMetrics(metrics);
  };

  // Set up hourly interval
  const intervalId = setInterval(emitMetrics, 60 * 60 * 1000); // 1 hour

  // Emit initial metrics
  emitMetrics();

  // Cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Manual metrics emission for server-side usage
 */
export async function emitEventRSVPMetrics(
  eventId: string, 
  guests: GuestData[]
): Promise<void> {
  const metrics = calculateRSVPMetrics(eventId, guests);
  await emitRSVPMetrics(metrics);
}

/**
 * Validate RSVP metrics for ops dashboard alerts
 */
export function validateRSVPMetrics(metrics: RSVPMetrics): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check invariants
  if (metrics.attending_count + metrics.declined_count !== metrics.total_active_guests) {
    warnings.push('RSVP count invariant violation: attending + declined ≠ total');
  }
  
  if (metrics.notify_eligible_count > metrics.attending_count) {
    warnings.push('Notify eligible count exceeds attending count');
  }
  
  if (metrics.total_active_guests < 0 || 
      metrics.attending_count < 0 || 
      metrics.declined_count < 0 || 
      metrics.notify_eligible_count < 0) {
    warnings.push('Negative count detected');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get current RSVP metrics for an event (for ops dashboard)
 */
export async function getCurrentRSVPMetrics(eventId: string): Promise<RSVPMetrics | null> {
  if (!METRICS_ENABLED) {
    return null;
  }

  try {
    // This would typically fetch from your database
    // For now, return null - implement based on your data layer
    return null;
  } catch (error) {
    console.warn('Error fetching current RSVP metrics:', error);
    return null;
  }
}
