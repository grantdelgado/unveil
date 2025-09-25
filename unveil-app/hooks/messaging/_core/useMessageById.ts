/**
 * useMessageById - Core Hook #2
 * 
 * Narrow fetch for message details with stable query key.
 * Leverages cache from list hooks when possible for efficiency.
 * Provides single-message focused operations and invalidation.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';
import { logger } from '@/lib/logger';

import type {
  MessageWithSender,
  UseMessageByIdReturn,
  DevObservabilityEvent,
} from './types';

/**
 * Core Hook #2: useMessageById
 * 
 * Single source of truth for individual message details.
 * Optimally leverages existing list cache data when available.
 */
export function useMessageById(
  eventId: string,
  messageId: string
): UseMessageByIdReturn {
  const queryClient = useQueryClient();
  
  // Create stable query key with canonical qk.* factory
  const queryKey = qk.messages.byId(eventId, messageId);
  
  // Dev observability - track hook usage
  const logActivity = useCallback((event: Omit<DevObservabilityEvent, 'hook'>) => {
    if (process.env.NODE_ENV === 'development') {
      const activity: DevObservabilityEvent = {
        hook: 'useMessageById',
        eventId,
        messageId,
        ...event,
      };
      
      logger.debug('[Core Hook] Activity:', activity);
    }
  }, [eventId, messageId]);
  
  // Attempt to find message in existing list caches first
  const findMessageInListCache = useCallback((): MessageWithSender | null => {
    if (!messageId) return null;
    
    // Check all potential list cache keys
    const listQueryKeys = [
      qk.messages.list(eventId),
      qk.messages.list(eventId, { type: 'announcement' }),
      qk.messages.list(eventId, { type: 'channel' }),
      qk.messages.list(eventId, { type: 'direct' }),
      qk.messages.archived(eventId),
    ];
    
    for (const listKey of listQueryKeys) {
      const cachedData = queryClient.getQueryData(listKey);
      
      // Handle infinite query data structure
      if (cachedData && typeof cachedData === 'object' && 'pages' in cachedData) {
        const pages = (cachedData as any).pages as MessageWithSender[][];
        for (const page of pages) {
          const found = page.find(msg => msg.id === messageId);
          if (found) {
            logActivity({
              operation: 'fetch',
              metadata: { source: 'listCache', cacheHit: true },
            });
            return found;
          }
        }
      }
      
      // Handle regular array data structure
      if (Array.isArray(cachedData)) {
        const found = (cachedData as MessageWithSender[]).find(msg => msg.id === messageId);
        if (found) {
          logActivity({
            operation: 'fetch',
            metadata: { source: 'listCache', cacheHit: true },
          });
          return found;
        }
      }
    }
    
    return null;
  }, [queryClient, eventId, messageId, logActivity]);
  
  // Main query for individual message
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<MessageWithSender> => {
      const startTime = performance.now();
      
      try {
        // First check if we can find it in list cache
        const cachedMessage = findMessageInListCache();
        if (cachedMessage) {
          logActivity({
            operation: 'fetch',
            timing: {
              startTime,
              endTime: performance.now(),
              duration: `${(performance.now() - startTime).toFixed(1)}ms`,
            },
            metadata: { source: 'cache', cacheHit: true },
          });
          return cachedMessage;
        }
        
        // If not in cache, fetch from database
        const { data: message, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_user_id_fkey(
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('id', messageId)
          .eq('event_id', eventId) // Security: ensure message belongs to this event
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            // No rows found
            throw new Error('Message not found');
          }
          
          logger.error('Failed to fetch message by ID', {
            error,
            eventId,
            messageId,
          });
          throw new Error(error.message);
        }
        
        const endTime = performance.now();
        const fetchDuration = endTime - startTime;
        
        logActivity({
          operation: 'fetch',
          timing: {
            startTime,
            endTime,
            duration: `${fetchDuration.toFixed(1)}ms`,
          },
          metadata: { source: 'database', cacheHit: false },
        });
        
        return message;
        
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
    staleTime: 60_000, // 1 minute - individual messages are more stable
    gcTime: 10 * 60_000, // 10 minutes - keep individual messages longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Rely on cache and list queries
    refetchOnReconnect: true,
    retry: (failureCount, error: any) => {
      // Don't retry on "not found" errors
      if (error?.message?.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    },
  });
  
  // Enhanced invalidation function
  const invalidateMessage = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      const inv = invalidate(queryClient);
      
      // Invalidate this specific message
      await inv.messages.byId(eventId, messageId);
      
      // Also invalidate related list caches to maintain consistency
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
          scope: 'byId + relatedLists',
        },
      });
      
    } catch (error) {
      logger.error('Failed to invalidate message by ID', {
        error,
        eventId,
        messageId,
        queryKey,
      });
      throw error;
    }
  }, [queryClient, eventId, messageId, logActivity, queryKey]);
  
  return {
    data: data || null,
    isLoading,
    error: error as Error | null,
    invalidate: invalidateMessage,
  };
}
