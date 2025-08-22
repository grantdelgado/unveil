// import { supabase } from '@/lib/supabase'; // FUTURE: Use for database storage when processing_metrics table is created in Phase 6
import { logger } from '@/lib/logger';

export interface ProcessingMetrics {
  sessionId: string;
  startTime: Date;
  endTime: Date | null;
  totalMessages: number;
  processedMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageProcessingTimeMs: number;
  throughputPerMinute: number;
  deliveryChannelStats: {
    sms: {
      attempted: number;
      successful: number;
      failed: number;
      successRate: number;
    };
    push: {
      attempted: number;
      successful: number;
      failed: number;
      successRate: number;
    };
    email: {
      attempted: number;
      successful: number;
      failed: number;
      successRate: number;
    };
  };
  errors: Array<{
    messageId: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface ChannelDeliveryResult {
  channel: 'sms' | 'push' | 'email';
  messageId: string;
  success: boolean;
  processingTimeMs: number;
  error?: string;
}

// In-memory storage for current processing session
let currentSession: {
  sessionId: string;
  startTime: Date;
  metrics: Omit<
    ProcessingMetrics,
    | 'sessionId'
    | 'startTime'
    | 'endTime'
    | 'averageProcessingTimeMs'
    | 'throughputPerMinute'
  >;
  channelResults: ChannelDeliveryResult[];
  messageTimings: Array<{ messageId: string; startTime: Date; endTime?: Date }>;
} | null = null;

/**
 * Start a new processing metrics session
 */
export function startProcessingSession(): string {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  currentSession = {
    sessionId,
    startTime: new Date(),
    metrics: {
      totalMessages: 0,
      processedMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      deliveryChannelStats: {
        sms: { attempted: 0, successful: 0, failed: 0, successRate: 0 },
        push: { attempted: 0, successful: 0, failed: 0, successRate: 0 },
        email: { attempted: 0, successful: 0, failed: 0, successRate: 0 },
      },
      errors: [],
    },
    channelResults: [],
    messageTimings: [],
  };

  logger.performance(`Started processing metrics session: ${sessionId}`);
  return sessionId;
}

/**
 * Record that processing has started for a message
 */
export function recordMessageStart(messageId: string): void {
  if (!currentSession) {
    logger.warn('No active processing session for message start recording');
    return;
  }

  currentSession.messageTimings.push({
    messageId,
    startTime: new Date(),
  });

  currentSession.metrics.totalMessages++;
}

/**
 * Record that processing has completed for a message
 */
export function recordMessageComplete(
  messageId: string,
  success: boolean,
  error?: string,
): void {
  if (!currentSession) {
    logger.warn(
      'No active processing session for message completion recording',
    );
    return;
  }

  // Find and update the timing record
  const timingRecord = currentSession.messageTimings.find(
    (t) => t.messageId === messageId,
  );
  if (timingRecord) {
    timingRecord.endTime = new Date();
  }

  currentSession.metrics.processedMessages++;

  if (success) {
    currentSession.metrics.successfulMessages++;
  } else {
    currentSession.metrics.failedMessages++;
    if (error) {
      currentSession.metrics.errors.push({
        messageId,
        error,
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Record delivery result for a specific channel
 */
export function recordChannelDelivery(result: ChannelDeliveryResult): void {
  if (!currentSession) {
    logger.warn('No active processing session for channel delivery recording');
    return;
  }

  currentSession.channelResults.push(result);

  const channelStats =
    currentSession.metrics.deliveryChannelStats[result.channel];
  channelStats.attempted++;

  if (result.success) {
    channelStats.successful++;
  } else {
    channelStats.failed++;
  }

  // Update success rate
  channelStats.successRate =
    channelStats.attempted > 0
      ? (channelStats.successful / channelStats.attempted) * 100
      : 0;
}

/**
 * Complete the current processing session and return final metrics
 */
export function completeProcessingSession(): ProcessingMetrics | null {
  if (!currentSession) {
    logger.warn('No active processing session to complete');
    return null;
  }

  const endTime = new Date();
  const durationMs = endTime.getTime() - currentSession.startTime.getTime();
  const durationMinutes = durationMs / (1000 * 60);

  // Calculate average processing time per message
  const completedTimings = currentSession.messageTimings.filter(
    (t) => t.endTime,
  );
  const averageProcessingTimeMs =
    completedTimings.length > 0
      ? completedTimings.reduce((sum, timing) => {
          const duration =
            timing.endTime!.getTime() - timing.startTime.getTime();
          return sum + duration;
        }, 0) / completedTimings.length
      : 0;

  // Calculate throughput
  const throughputPerMinute =
    durationMinutes > 0
      ? currentSession.metrics.processedMessages / durationMinutes
      : 0;

  const finalMetrics: ProcessingMetrics = {
    sessionId: currentSession.sessionId,
    startTime: currentSession.startTime,
    endTime,
    ...currentSession.metrics,
    averageProcessingTimeMs,
    throughputPerMinute,
  };

  logger.performance(
    `Completed processing session ${currentSession.sessionId}`,
    {
      duration: `${Math.round(durationMs / 1000)}s`,
      processed: currentSession.metrics.processedMessages,
      successful: currentSession.metrics.successfulMessages,
      failed: currentSession.metrics.failedMessages,
      throughput: `${throughputPerMinute.toFixed(2)} msg/min`,
      avgProcessingTime: `${averageProcessingTimeMs.toFixed(0)}ms`,
    },
  );

  // Store metrics for historical analysis
  storeMetricsToDatabase(finalMetrics).catch((error) => {
    logger.performanceWarn(
      'Failed to store processing metrics to database',
      error,
    );
  });

  // Clear the current session
  currentSession = null;

  return finalMetrics;
}

/**
 * Get the current session metrics without completing the session
 */
export function getCurrentSessionMetrics(): Partial<ProcessingMetrics> | null {
  if (!currentSession) {
    return null;
  }

  const now = new Date();
  const durationMs = now.getTime() - currentSession.startTime.getTime();
  const durationMinutes = durationMs / (1000 * 60);

  const completedTimings = currentSession.messageTimings.filter(
    (t) => t.endTime,
  );
  const averageProcessingTimeMs =
    completedTimings.length > 0
      ? completedTimings.reduce((sum, timing) => {
          const duration =
            timing.endTime!.getTime() - timing.startTime.getTime();
          return sum + duration;
        }, 0) / completedTimings.length
      : 0;

  const throughputPerMinute =
    durationMinutes > 0
      ? currentSession.metrics.processedMessages / durationMinutes
      : 0;

  return {
    sessionId: currentSession.sessionId,
    startTime: currentSession.startTime,
    endTime: null,
    ...currentSession.metrics,
    averageProcessingTimeMs,
    throughputPerMinute,
  };
}

/**
 * Store processing metrics to database for historical analysis
 */
async function storeMetricsToDatabase(
  metrics: ProcessingMetrics,
): Promise<void> {
  try {
    // Store in a simple format that can be queried for analytics
    const metricsRecord = {
      session_id: metrics.sessionId,
      start_time: metrics.startTime.toISOString(),
      end_time: metrics.endTime?.toISOString(),
      duration_ms: metrics.endTime
        ? metrics.endTime.getTime() - metrics.startTime.getTime()
        : null,
      total_messages: metrics.totalMessages,
      processed_messages: metrics.processedMessages,
      successful_messages: metrics.successfulMessages,
      failed_messages: metrics.failedMessages,
      average_processing_time_ms: metrics.averageProcessingTimeMs,
      throughput_per_minute: metrics.throughputPerMinute,
      sms_attempted: metrics.deliveryChannelStats.sms.attempted,
      sms_successful: metrics.deliveryChannelStats.sms.successful,
      sms_failed: metrics.deliveryChannelStats.sms.failed,
      sms_success_rate: metrics.deliveryChannelStats.sms.successRate,
      push_attempted: metrics.deliveryChannelStats.push.attempted,
      push_successful: metrics.deliveryChannelStats.push.successful,
      push_failed: metrics.deliveryChannelStats.push.failed,
      push_success_rate: metrics.deliveryChannelStats.push.successRate,
      email_attempted: metrics.deliveryChannelStats.email.attempted,
      email_successful: metrics.deliveryChannelStats.email.successful,
      email_failed: metrics.deliveryChannelStats.email.failed,
      email_success_rate: metrics.deliveryChannelStats.email.successRate,
      errors: JSON.stringify(metrics.errors),
      created_at: new Date().toISOString(),
    };

    // FUTURE: Create processing_metrics table in Phase 6 analytics expansion
    // For now, we'll log the metrics for manual analysis
    logger.performance('Processing Metrics (would store to DB)', metricsRecord);

    // In the future, this would be:
    // const { error } = await supabase
    //   .from('processing_metrics')
    //   .insert(metricsRecord);
    //
    // if (error) throw error;
  } catch (error) {
    logger.performanceWarn('Error storing processing metrics', error);
    // Don't throw here to avoid disrupting main processing flow
  }
}

/**
 * Get recent processing performance statistics
 */
export async function getProcessingStats(hoursBack: number = 24): Promise<{
  totalSessions: number;
  averageThroughput: number;
  averageProcessingTime: number;
  totalMessagesProcessed: number;
  overallSuccessRate: number;
  channelPerformance: {
    sms: { attempts: number; successRate: number };
    push: { attempts: number; successRate: number };
    email: { attempts: number; successRate: number };
  };
}> {
  // FUTURE: Query actual database once processing_metrics table exists in Phase 6
  // FUTURE: Use hoursBack parameter to filter results by time range
  // For now, return mock/default values as documentation
  void hoursBack; // Suppress unused parameter warning until implementation
  return {
    totalSessions: 0,
    averageThroughput: 0,
    averageProcessingTime: 0,
    totalMessagesProcessed: 0,
    overallSuccessRate: 0,
    channelPerformance: {
      sms: { attempts: 0, successRate: 0 },
      push: { attempts: 0, successRate: 0 },
      email: { attempts: 0, successRate: 0 },
    },
  };
}

/**
 * Utility function to create a ChannelDeliveryResult
 */
export function createChannelResult(
  channel: 'sms' | 'push' | 'email',
  messageId: string,
  success: boolean,
  processingTimeMs: number,
  error?: string,
): ChannelDeliveryResult {
  return {
    channel,
    messageId,
    success,
    processingTimeMs,
    error,
  };
}

/**
 * Record processing metrics in a try-catch wrapper to avoid disrupting main flow
 */
export function safeRecordMetrics(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    logger.warn('Non-critical error recording processing metrics', error);
  }
}
