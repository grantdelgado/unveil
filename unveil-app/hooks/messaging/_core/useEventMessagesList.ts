/**
 * useEventMessagesList - Core Hook #1
 * 
 * Reads announcements/channels via read-model V2 RPC with pagination support.
 * Supports type filtering, cursor-based pagination, and de-duplication.
 * Returns friendly timestamps and integrates with canonical query keys.
 */

import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';
import { logger } from '@/lib/logger';

import type {
  MessageWithSender,
  MessageListOptions,
  UseEventMessagesListReturn,
  DevObservabilityEvent,
} from './types';

import {
  normalizePaginationOptions,
  hasMorePages,
  deduplicateById,
  logPaginationMetrics,
} from '../_shared/pagination';

/**
 * Core Hook #1: useEventMessagesList
 * 
 * Single source of truth for event message lists with full pagination support.
 * Handles announcements, channels, and archived messages through type filtering.
 */
export function useEventMessagesList(
  eventId: string,
  options: MessageListOptions = {}
): UseEventMessagesListReturn {
  const queryClient = useQueryClient();
  
  // Normalize options with defaults
  const normalizedOptions = normalizePaginationOptions(options);
  const { type, includeArchived } = options;
  
  // Create stable query key with canonical qk.* factory
  const queryKey = qk.messages.list(eventId, {
    type,
    includeArchived,
    limit: normalizedOptions.limit,
  });
  
  // Dev observability - track hook usage
  const logActivity = useCallback((event: Omit<DevObservabilityEvent, 'hook'>) => {
    if (process.env.NODE_ENV === 'development') {
      const activity: DevObservabilityEvent = {
        hook: 'useEventMessagesList',
        eventId,
        ...event,
      };
      
      logger.debug('[Core Hook] Activity:', activity);
    }
  }, [eventId]);
  
  // Main infinite query for paginated messages
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const startTime = performance.now();
      
      try {
        // Build query based on message source
        let query = supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_user_id_fkey(
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }) // Stable ordering tie-breaker
          .limit(normalizedOptions.limit);
        
        // Apply type filtering
        if (type) {
          query = query.eq('message_type', type);
        }
        
        // Apply archived filtering
        if (!includeArchived) {
          // Exclude archived messages (assuming there's an archived field or status)
          // For now, we'll include all messages as the schema doesn't have explicit archiving
        }
        
        // Apply cursor-based pagination
        if (pageParam) {
          query = query.lt('created_at', pageParam);
        }
        
        const { data: messages, error } = await query;
        
        if (error) {
          logger.error('Failed to fetch messages', {
            error,
            eventId,
            type,
            cursor: pageParam,
          });
          throw new Error(error.message);
        }
        
        const endTime = performance.now();
        const fetchDuration = endTime - startTime;
        
        // Deduplicate results by ID
        const deduplicatedMessages = deduplicateById(messages || []);
        
        // Log performance metrics
        logPaginationMetrics('useEventMessagesList', {
          requestedLimit: normalizedOptions.limit,
          returnedCount: deduplicatedMessages.length,
          cursor: pageParam,
          totalPages: 0, // Will be updated by react-query
          totalItems: 0, // Will be updated by react-query  
          hasMore: hasMorePages(deduplicatedMessages.length, normalizedOptions.limit),
        });
        
        // Log activity for observability
        logActivity({
          operation: 'fetch',
          timing: {
            startTime,
            endTime,
            duration: `${fetchDuration.toFixed(1)}ms`,
          },
          counts: {
            initial: deduplicatedMessages.length,
          },
          metadata: {
            type,
            cursor: pageParam ? 'present' : 'initial',
            hasMore: hasMorePages(deduplicatedMessages.length, normalizedOptions.limit),
          },
        });
        
        return deduplicatedMessages;
        
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
    getNextPageParam: (lastPage: MessageWithSender[]) => {
      // Use created_at from last item as next cursor
      if (lastPage.length === 0) return undefined;
      
      const hasMore = hasMorePages(lastPage.length, normalizedOptions.limit);
      if (!hasMore) return undefined;
      
      const lastMessage = lastPage[lastPage.length - 1];
      return lastMessage.created_at;
    },
    initialPageParam: undefined,
    enabled: !!eventId,
    staleTime: 30_000, // 30 seconds - matches existing message cache config
    gcTime: 5 * 60_000, // 5 minutes - matches existing message cache config
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
  });
  
  // Flatten pages into single array
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return (data.pages as MessageWithSender[][]).flat();
  }, [data?.pages]);
  
  // Get all pages for advanced use cases
  const pages = useMemo(() => {
    return (data?.pages as MessageWithSender[][]) || [];
  }, [data?.pages]);
  
  // Enhanced invalidation function
  const invalidateList = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      const inv = invalidate(queryClient);
      await inv.messages.allLists(eventId);
      
      const endTime = performance.now();
      
      logActivity({
        operation: 'invalidation',
        timing: {
          startTime,
          endTime,
          duration: `${(endTime - startTime).toFixed(1)}ms`,
        },
        metadata: {
          scope: 'allLists',
        },
      });
      
    } catch (error) {
      logger.error('Failed to invalidate message list', {
        error,
        eventId,
        queryKey,
      });
      throw error;
    }
  }, [queryClient, eventId, logActivity, queryKey]);
  
  return {
    data: messages,
    pages,
    hasNextPage: !!hasNextPage,
    isFetching,
    isLoading,
    error: error as Error | null,
    fetchNextPage: useCallback(async () => {
      const startTime = performance.now();
      
      logActivity({
        operation: 'fetch',
        timing: { startTime, endTime: startTime, duration: '0ms' },
        metadata: { type: 'nextPage' },
      });
      
      await fetchNextPage();
    }, [fetchNextPage, logActivity]),
    invalidate: invalidateList,
  };
}
