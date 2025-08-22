/**
 * useScheduledMessagesRealtime Hook
 *
 * Handles real-time subscription management for scheduled messages.
 * Extracted from the original useScheduledMessages hook for better separation of concerns.
 */

import { useState, useCallback, useRef } from 'react';
import { useRealtimeSubscription } from '@/hooks/realtime';
import type { Tables } from '@/app/reference/supabase.types';
import type { UseScheduledMessagesCacheReturn } from './useScheduledMessagesCache';
import { logger } from '@/lib/logger';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ScheduledMessage = Tables<'scheduled_messages'>;

export interface UseScheduledMessagesRealtimeOptions {
  eventId: string;
  cache: UseScheduledMessagesCacheReturn;
  onRefetch: () => Promise<any>;
  enabled?: boolean;
}

export interface UseScheduledMessagesRealtimeReturn {
  isConnected: boolean;
  error: Error | null;
  reconnectAttempts: number;
}

/**
 * Hook for real-time subscription of scheduled messages
 *
 * Responsibilities:
 * - Real-time subscription setup and management
 * - Connection status tracking
 * - Error handling and recovery with exponential backoff
 * - Integration with cache operations
 */
export function useScheduledMessagesRealtime({
  eventId,
  cache,
  onRefetch,
  enabled = true,
}: UseScheduledMessagesRealtimeOptions): UseScheduledMessagesRealtimeReturn {
  const [error, setError] = useState<Error | null>(null);

  // Track reconnection attempts
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Enhanced real-time subscription with React Query integration
  const { isConnected } = useRealtimeSubscription({
    subscriptionId: `scheduled-messages-${eventId}`,
    table: 'scheduled_messages',
    filter: `event_id=eq.${eventId}`,
    enabled: !!eventId && enabled,
    onDataChange: useCallback(
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        try {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as ScheduledMessage;
            const wasProcessed = cache.handleRealtimeInsert(newMessage);

            if (wasProcessed) {
              // Reset error state on successful update
              setError(null);
              reconnectAttempts.current = 0;

              // Invalidate query to ensure consistency after a delay
              setTimeout(() => {
                cache.invalidateQueries();
              }, 1000);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as ScheduledMessage;
            cache.handleRealtimeUpdate(updatedMessage);

            // Reset error state on successful update
            setError(null);
            reconnectAttempts.current = 0;

            // Invalidate query to ensure consistency after a delay
            setTimeout(() => {
              cache.invalidateQueries();
            }, 1000);
          } else if (payload.eventType === 'DELETE') {
            const deletedMessage = payload.old as ScheduledMessage;
            cache.handleRealtimeDelete(deletedMessage);

            // Reset error state on successful update
            setError(null);
            reconnectAttempts.current = 0;

            // Invalidate query to ensure consistency after a delay
            setTimeout(() => {
              cache.invalidateQueries();
            }, 1000);
          }
        } catch (err) {
          logger.realtimeError(
            'Error processing real-time scheduled message update',
            err,
          );
          setError(new Error('Failed to process real-time update'));
        }
      },
      [cache],
    ),

    onError: useCallback(
      (realtimeError: Error) => {
        logger.realtimeError(
          'Scheduled message subscription error',
          realtimeError,
        );
        setError(
          new Error(`Real-time connection error: ${realtimeError.message}`),
        );

        // Implement exponential backoff for reconnection
        reconnectAttempts.current += 1;
        if (reconnectAttempts.current <= maxReconnectAttempts) {
          const backoffDelay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000,
          );
          logger.realtime('Attempting reconnect', {
            delayMs: backoffDelay,
            attempt: reconnectAttempts.current,
            maxAttempts: maxReconnectAttempts,
          });

          setTimeout(() => {
            // Trigger a refresh to ensure data consistency
            onRefetch();
          }, backoffDelay);
        } else {
          setError(
            new Error(
              'Failed to establish real-time connection after multiple attempts',
            ),
          );
        }
      },
      [onRefetch],
    ),

    onStatusChange: useCallback(
      (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
        logger.realtime('Scheduled message subscription status change', {
          status,
        });

        if (status === 'connected') {
          setError(null);
          reconnectAttempts.current = 0;

          // Refresh data when reconnected to ensure consistency
          onRefetch();
        } else if (status === 'error') {
          setError(new Error('Real-time connection failed'));
        }
      },
      [onRefetch],
    ),
  });

  return {
    isConnected,
    error,
    reconnectAttempts: reconnectAttempts.current,
  };
}
