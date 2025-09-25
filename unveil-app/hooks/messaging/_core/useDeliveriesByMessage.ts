/**
 * useDeliveriesByMessage - Core Hook #3
 * 
 * Delivery-gated reads for message analytics and delivery tracking.
 * Never exposes Direct message content from the messages table - only via deliveries.
 * Returns scoped counts and statuses suitable for analytics panes.
 */

import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';
import { logger } from '@/lib/logger';

import type {
  MessageDeliveryWithMessage,
  DeliveryListOptions,
  UseDeliveriesByMessageReturn,
  DevObservabilityEvent,
} from './types';

import {
  normalizePaginationOptions,
  hasMorePages,
  deduplicateById,
  logPaginationMetrics,
} from '../_shared/pagination';

/**
 * Core Hook #3: useDeliveriesByMessage
 * 
 * Delivery-gated message access that respects security boundaries.
 * Provides delivery analytics without exposing unauthorized message content.
 */
export function useDeliveriesByMessage(
  eventId: string,
  messageId: string,
  options: DeliveryListOptions = {}
): UseDeliveriesByMessageReturn {
  const queryClient = useQueryClient();
  
  // Normalize options with defaults
  const normalizedOptions = normalizePaginationOptions(options);
  const { status, page, pageSize } = options;
  
  // Create stable query key with canonical qk.* factory
  const deliveriesQueryKey = qk.messageDeliveries.byMessage(eventId, messageId, {
    status,
    page,
    pageSize: pageSize || normalizedOptions.limit,
  });
  
  const statsQueryKey = qk.messageDeliveries.stats(eventId, messageId);
  
  // Dev observability - track hook usage
  const logActivity = useCallback((event: Omit<DevObservabilityEvent, 'hook'>) => {
    if (process.env.NODE_ENV === 'development') {
      const activity: DevObservabilityEvent = {
        hook: 'useDeliveriesByMessage',
        eventId,
        messageId,
        ...event,
      };
      
      logger.debug('[Core Hook] Activity:', activity);
    }
  }, [eventId, messageId]);
  
  // Simplified query for deliveries (avoid complex infinite query for now)
  const {
    data: deliveriesData,
    isFetching,
    isLoading,
    error: deliveriesError,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: deliveriesQueryKey,
    queryFn: async () => {
      const startTime = performance.now();
      
      try {
        // Build query for message deliveries
        let query = supabase
          .from('message_deliveries')
          .select(`
            *,
            message:messages!message_deliveries_message_id_fkey(
              id,
              message_type,
              created_at,
              event_id,
              content,
              sender_user_id
            )
          `)
          .eq('message_id', messageId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }); // Stable ordering
        
        // Apply status filtering
        if (status) {
          query = query.eq('sms_status', status);
        }
        
        // Apply limit
        query = query.limit(normalizedOptions.limit);
        
        const { data: deliveries, error } = await query;
        
        if (error) {
          logger.error('Failed to fetch message deliveries', {
            error,
            eventId,
            messageId,
            status,
          });
          throw new Error(error.message);
        }
        
        // Security check: Ensure all deliveries belong to the correct event
        const validDeliveries = (deliveries || []).filter(delivery => 
          delivery.message?.event_id === eventId
        );
        
        const endTime = performance.now();
        const fetchDuration = endTime - startTime;
        
        // Deduplicate results by ID
        const deduplicatedDeliveries = deduplicateById(validDeliveries);
        
        // Log activity for observability
        logActivity({
          operation: 'fetch',
          timing: {
            startTime,
            endTime,
            duration: `${fetchDuration.toFixed(1)}ms`,
          },
          counts: {
            initial: deduplicatedDeliveries.length,
          },
          metadata: {
            status,
            hasMore: hasMorePages(deduplicatedDeliveries.length, normalizedOptions.limit),
          },
        });
        
        return deduplicatedDeliveries as MessageDeliveryWithMessage[];
        
      } catch (error) {
        const endTime = performance.now();
        
        logActivity({
          operation: 'fetch',
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        
        throw error;
      }
    },
    enabled: !!eventId && !!messageId,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
  });
  
  // Separate query for delivery statistics
  const {
    data: stats,
    error: statsError,
  } = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const startTime = performance.now();
      
      try {
        // Get delivery counts by status
        const { data: deliveries, error } = await supabase
          .from('message_deliveries')
          .select('sms_status, message:messages!message_deliveries_message_id_fkey(event_id)')
          .eq('message_id', messageId);
        
        if (error) {
          throw new Error(error.message);
        }
        
        // Security check: Only count deliveries for this event
        const validDeliveries = (deliveries || []).filter(delivery => 
          delivery.message?.event_id === eventId
        );
        
        // Calculate statistics
        const stats = {
          total: validDeliveries.length,
          delivered: validDeliveries.filter(d => d.sms_status === 'delivered').length,
          failed: validDeliveries.filter(d => d.sms_status === 'failed').length,
          pending: validDeliveries.filter(d => d.sms_status === 'pending').length,
        };
        
        const endTime = performance.now();
        
        logActivity({
          operation: 'fetch',
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: {
            type: 'stats',
            stats,
          },
        });
        
        return stats;
        
      } catch (error) {
        logger.error('Failed to fetch delivery stats', {
          error,
          eventId,
          messageId,
        });
        throw error;
      }
    },
    enabled: !!eventId && !!messageId,
    staleTime: 60_000, // 1 minute - stats are more stable
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Stats don't change as frequently
    refetchOnReconnect: true,
  });
  
  // Use data directly (simplified approach)
  const deliveries = deliveriesData || [];
  
  // Enhanced invalidation function
  const invalidateDeliveries = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      const inv = invalidate(queryClient);
      
      // Invalidate deliveries for this message
      await inv.messageDeliveries.allForMessage(eventId, messageId);
      
      // Also invalidate stats
      await inv.messageDeliveries.stats(eventId, messageId);
      
      const endTime = performance.now();
      
      logActivity({
        operation: 'invalidation',
        timing: {
          startTime,
          endTime,
          duration: `${(endTime - startTime).toFixed(1)}ms`,
        },
        metadata: {
          scope: 'deliveries + stats',
        },
      });
      
    } catch (error) {
      logger.error('Failed to invalidate message deliveries', {
        error,
        eventId,
        messageId,
        queryKeys: [deliveriesQueryKey, statsQueryKey],
      });
      throw error;
    }
  }, [queryClient, eventId, messageId, logActivity, deliveriesQueryKey, statsQueryKey]);
  
  const error = deliveriesError || statsError;
  
  return {
    data: deliveries,
    hasNextPage: false, // Simplified - no pagination for now
    isFetching,
    isLoading,
    error: error as Error | null,
    fetchNextPage: useCallback(async () => {
      // Simplified - just refetch for now
      await refetchDeliveries();
    }, [refetchDeliveries]),
    stats: stats || null,
    invalidate: invalidateDeliveries,
  };
}
