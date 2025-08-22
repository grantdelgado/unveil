/**
 * PII-safe messaging metrics
 * Tracks counts and boolean flags only - no personal data
 */

interface MessagingMetrics {
  recipients_skipped_removed_total: number;
  recipients_skipped_opted_out_total: number;
  recipients_included_total: number;
}

let metricsBuffer: MessagingMetrics = {
  recipients_skipped_removed_total: 0,
  recipients_skipped_opted_out_total: 0,
  recipients_included_total: 0,
};

/**
 * Increment metric for recipients skipped due to removal
 */
export function incrementSkippedRemovedGuests(count: number = 1): void {
  metricsBuffer.recipients_skipped_removed_total += count;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'recipients_skipped_removed',
    count,
    total: metricsBuffer.recipients_skipped_removed_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment metric for recipients skipped due to opt-out
 */
export function incrementSkippedOptedOutGuests(count: number = 1): void {
  metricsBuffer.recipients_skipped_opted_out_total += count;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'recipients_skipped_opted_out',
    count,
    total: metricsBuffer.recipients_skipped_opted_out_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment metric for recipients included in message
 */
export function incrementIncludedRecipients(count: number = 1): void {
  metricsBuffer.recipients_included_total += count;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'recipients_included',
    count,
    total: metricsBuffer.recipients_included_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get current metrics snapshot (for monitoring/debugging)
 */
export function getMessagingMetrics(): Readonly<MessagingMetrics> {
  return { ...metricsBuffer };
}

/**
 * Reset metrics (for testing or periodic reset)
 */
export function resetMessagingMetrics(): void {
  metricsBuffer = {
    recipients_skipped_removed_total: 0,
    recipients_skipped_opted_out_total: 0,
    recipients_included_total: 0,
  };
}
