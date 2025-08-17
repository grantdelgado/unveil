import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { autoJoinInvitedGuests } from '@/lib/services/guestAutoJoin';
import { logger } from '@/lib/logger';

interface UseAutoJoinGuestsReturn {
  isProcessing: boolean;
  joinedEvents: string[];
  error: string | null;
  processAutoJoin: (userId: string, userPhone?: string) => Promise<void>;
}

/**
 * Hook to handle auto-joining invited guests to events
 * Should be called after successful authentication
 */
export function useAutoJoinGuests(): UseAutoJoinGuestsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const processAutoJoin = useCallback(async (userId: string, userPhone?: string) => {
    if (!userId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await autoJoinInvitedGuests(userId, userPhone);
      
      if (result.success) {
        setJoinedEvents(result.joinedEvents);
        
        // If events were joined, invalidate relevant queries
        if (result.joinedEvents.length > 0) {
          await Promise.all([
            // Invalidate user events list
            queryClient.invalidateQueries({ queryKey: ['user-events'] }),
            queryClient.invalidateQueries({ queryKey: ['guest-events'] }),
            // Invalidate specific event queries for joined events
            ...result.joinedEvents.map(eventId => 
              queryClient.invalidateQueries({ queryKey: ['event-with-guest', eventId] })
            ),
          ]);

          logger.api('Auto-join completed, queries invalidated', { 
            joinedEventsCount: result.joinedEvents.length 
          }, 'useAutoJoinGuests.processAutoJoin');
        }
      } else {
        const errorMessage = result.error || 'Auto-join failed';
        setError(errorMessage);
        
        // Log with more context for debugging
        logger.apiError('Auto-join failed', {
          error: result.error,
          userId,
          hasPhone: !!userPhone
        }, 'useAutoJoinGuests.processAutoJoin');
        
        // Don't throw - just log and continue
        console.warn(`Auto-join failed for user ${userId}: ${errorMessage}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unexpected error during auto-join';
      setError(errorMessage);
      logger.apiError('Auto-join exception', err, 'useAutoJoinGuests.processAutoJoin');
      
      // Log but don't throw - allow the app to continue loading
      console.warn(`Auto-join exception for user ${userId}: ${errorMessage}`, err);
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient]);

  return {
    isProcessing,
    joinedEvents,
    error,
    processAutoJoin,
  };
}
