/**
 * PII-safe messaging metrics
 * Tracks counts and boolean flags only - no personal data
 */

interface MessagingMetrics {
  recipients_skipped_removed_total: number;
  recipients_skipped_opted_out_total: number;
  recipients_included_total: number;
  // Enhanced monitoring metrics (added for audit recommendations)
  formatter_fallback_total: number;
  formatter_prefetch_used_total: number;
  formatter_prefetch_missed_total: number;
  message_type_coercion_total: number;
}

let metricsBuffer: MessagingMetrics = {
  recipients_skipped_removed_total: 0,
  recipients_skipped_opted_out_total: 0,
  recipients_included_total: 0,
  // Enhanced monitoring metrics (added for audit recommendations)
  formatter_fallback_total: 0,
  formatter_prefetch_used_total: 0,
  formatter_prefetch_missed_total: 0,
  message_type_coercion_total: 0,
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
 * Increment metric for formatter fallback usage
 * @param path - The fallback path taken (e.g., 'event_not_found', 'kill_switch')
 */
export function incrementFormatterFallback(path: string): void {
  metricsBuffer.formatter_fallback_total += 1;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'formatter_fallback',
    path,
    count: 1,
    total: metricsBuffer.formatter_fallback_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment metric for prefetch usage (successful)
 */
export function incrementFormatterPrefetchUsed(): void {
  metricsBuffer.formatter_prefetch_used_total += 1;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'formatter_prefetch_used',
    count: 1,
    total: metricsBuffer.formatter_prefetch_used_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment metric for prefetch miss (had to fetch from DB)
 */
export function incrementFormatterPrefetchMissed(): void {
  metricsBuffer.formatter_prefetch_missed_total += 1;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'formatter_prefetch_missed',
    count: 1,
    total: metricsBuffer.formatter_prefetch_missed_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Increment metric for message type coercion
 * @param originalType - The original message type from UI
 * @param finalType - The coerced message type
 * @param reason - The reason for coercion
 */
export function incrementMessageTypeCoercion(
  originalType: string,
  finalType: string,
  reason: string
): void {
  metricsBuffer.message_type_coercion_total += 1;
  
  // Log PII-safe metric
  console.log('messaging_metric', {
    type: 'message_type_coercion',
    originalType,
    finalType,
    reason,
    count: 1,
    total: metricsBuffer.message_type_coercion_total,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Reset metrics (for testing or periodic reset)
 */
export function resetMessagingMetrics(): void {
  metricsBuffer = {
    recipients_skipped_removed_total: 0,
    recipients_skipped_opted_out_total: 0,
    recipients_included_total: 0,
    // Enhanced monitoring metrics (added for audit recommendations)
    formatter_fallback_total: 0,
    formatter_prefetch_used_total: 0,
    formatter_prefetch_missed_total: 0,
    message_type_coercion_total: 0,
  };
}
