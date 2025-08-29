/**
 * Recipient Count Pill Component
 * 
 * Displays recipient counts for scheduled messages with support for:
 * - Live counts for Upcoming Announcements/Channels
 * - Snapshot counts for Sent messages
 * - Loading states and error handling
 */

import React from 'react';
import { useCurrentAudienceCount } from '@/hooks/messaging/useCurrentAudienceCount';
import { logger } from '@/lib/logger';

interface RecipientCountPillProps {
  scheduledMessageId: string;
  messageType: 'announcement' | 'channel' | 'direct';
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  snapshotCount: number | null | undefined;
  successCount?: number | null;
  className?: string;
}

/**
 * Component that displays recipient counts with appropriate logic:
 * - Upcoming Announcements/Channels: Live count
 * - Sent messages: Delivered counts if available, otherwise snapshot
 * - Other cases: Snapshot count
 */
export function RecipientCountPill({
  scheduledMessageId,
  messageType,
  status,
  snapshotCount,
  successCount,
  className = '',
}: RecipientCountPillProps) {
  // Determine if we should show live count
  const shouldShowLiveCount = 
    status === 'scheduled' && 
    (messageType === 'announcement' || messageType === 'channel');

  // Fetch live count only when needed
  const {
    count: liveCount,
    loading: liveCountLoading,
    error: liveCountError,
  } = useCurrentAudienceCount(scheduledMessageId, {
    enabled: shouldShowLiveCount,
  });

  // Log count differences for observability (PII-safe)
  React.useEffect(() => {
    if (shouldShowLiveCount && liveCount !== null && snapshotCount !== null && snapshotCount !== undefined) {
      const delta = liveCount - snapshotCount;
      
      // Log when live count replaces snapshot
      if (process.env.NODE_ENV === 'development') {
        logger.info('Live count replacing snapshot', {
          scheduledMessageId,
          snapshot: snapshotCount,
          live: liveCount,
          delta,
          messageType,
        });
      }

      // Warn if significant difference (optional)
      if (Math.abs(delta) >= 10) {
        logger.warn('Significant audience count difference detected', {
          scheduledMessageId,
          snapshot: snapshotCount,
          live: liveCount,
          delta,
          messageType,
        });
      }
    }
  }, [shouldShowLiveCount, liveCount, snapshotCount, scheduledMessageId, messageType]);

  // Render logic
  if (shouldShowLiveCount) {
    // Upcoming Announcements/Channels: Show live count
    if (liveCountLoading) {
      return (
        <div className={`inline-flex items-center ${className}`}>
          <div className="w-12 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      );
    }

    if (liveCountError || liveCount === null) {
      return (
        <span className={`text-gray-500 ${className}`}>
          Recipients TBD
        </span>
      );
    }

    return (
      <span className={`text-gray-600 ${className}`}>
        {liveCount} {liveCount === 1 ? 'person' : 'people'}
      </span>
    );
  }

  // Sent messages: Show delivered counts if available
  if (status === 'sent' && successCount !== undefined && successCount !== null && successCount > 0) {
    return (
      <span className={`text-gray-600 ${className}`}>
        {successCount} delivered
      </span>
    );
  }

  // Fallback: Show snapshot count
  if (snapshotCount !== null && snapshotCount !== undefined && snapshotCount > 0) {
    return (
      <span className={`text-gray-600 ${className}`}>
        {snapshotCount} {snapshotCount === 1 ? 'person' : 'people'}
      </span>
    );
  }

  // No count available
  if (status === 'scheduled') {
    return (
      <span className={`text-gray-500 ${className}`}>
        Recipients TBD
      </span>
    );
  }

  return null;
}
