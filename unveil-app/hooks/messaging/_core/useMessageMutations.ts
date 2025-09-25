/**
 * useMessageMutations - Core Hook #4
 * 
 * Centralized message mutation operations with precise invalidation.
 * Handles sending announcements, channels, direct messages, scheduling,
 * and deletion with proper cache invalidation targeting.
 */

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { qk } from '@/lib/queryKeys';
import { invalidate } from '@/lib/queryInvalidation';
import { logger } from '@/lib/logger';
import { sendMessageToEvent } from '@/lib/services/messaging-client';

import type {
  Message,
  ScheduledMessage,
  ScheduledMessageInsert,
  SendMessageRequest,
  UseMessageMutationsReturn,
  DevObservabilityEvent,
} from './types';

/**
 * Core Hook #4: useMessageMutations
 * 
 * Single source of truth for all messaging mutations.
 * Provides typed interfaces and precise cache invalidation.
 */
export function useMessageMutations(): UseMessageMutationsReturn {
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Dev observability - track mutation usage
  const logActivity = useCallback((event: Omit<DevObservabilityEvent, 'hook'>) => {
    if (process.env.NODE_ENV === 'development') {
      const activity: DevObservabilityEvent = {
        hook: 'useMessageMutations',
        ...event,
      };
      
      logger.debug('[Core Hook] Activity:', activity);
    }
  }, []);
  
  // Helper to perform precise invalidation after mutations
  const invalidateAfterMutation = useCallback(async (
    operation: string,
    eventId: string,
    messageId?: string,
    scheduledMessageId?: string
  ) => {
    const startTime = performance.now();
    
    try {
      const inv = invalidate(queryClient);
      
      switch (operation) {
        case 'sendMessage':
          // Invalidate message lists and analytics
          await Promise.all([
            inv.messages.allLists(eventId),
            inv.analytics.messaging(eventId),
            inv.analytics.event(eventId),
          ]);
          break;
          
        case 'scheduleMessage':
          // Invalidate scheduled message lists
          await Promise.all([
            inv.scheduledMessages.allLists(eventId),
            inv.analytics.messaging(eventId),
            ...(scheduledMessageId ? [inv.scheduledMessages.audienceCount(scheduledMessageId)] : []),
          ]);
          break;
          
        case 'deleteMessage':
          // Invalidate message lists and specific message
          await Promise.all([
            inv.messages.allLists(eventId),
            ...(messageId ? [inv.messages.byId(eventId, messageId)] : []),
            ...(messageId ? [inv.messageDeliveries.allForMessage(eventId, messageId)] : []),
            inv.analytics.messaging(eventId),
          ]);
          break;
          
        case 'cancelScheduled':
          // Invalidate scheduled message lists and specific message
          await Promise.all([
            inv.scheduledMessages.allLists(eventId),
            ...(scheduledMessageId ? [inv.scheduledMessages.byId(eventId, scheduledMessageId)] : []),
            ...(scheduledMessageId ? [inv.scheduledMessages.audienceCount(scheduledMessageId)] : []),
            inv.analytics.messaging(eventId),
          ]);
          break;
      }
      
      const endTime = performance.now();
      
      logActivity({
        operation: 'invalidation',
        eventId,
        messageId,
        timing: {
          startTime,
          endTime,
          duration: `${(endTime - startTime).toFixed(1)}ms`,
        },
        metadata: {
          operation,
          scope: 'targeted',
        },
      });
      
    } catch (error) {
      logger.error('Failed to invalidate after mutation', {
        error,
        operation,
        eventId,
        messageId,
        scheduledMessageId,
      });
      // Don't throw - invalidation failure shouldn't break the mutation
    }
  }, [queryClient, logActivity]);
  
  // Send announcement mutation
  const sendAnnouncementMutation = useMutation({
    mutationFn: async (request: Omit<SendMessageRequest, 'messageType'>): Promise<Message> => {
      const startTime = performance.now();
      
      try {
        setGlobalError(null);
        
        const fullRequest: SendMessageRequest = {
          ...request,
          messageType: 'announcement',
        };
        
        logActivity({
          operation: 'mutation',
          eventId: request.eventId,
          timing: { startTime, endTime: startTime, duration: '0ms' },
          metadata: { type: 'sendAnnouncement', starting: true },
        });
        
        const result = await sendMessageToEvent(fullRequest);
        
        if (!result.success) {
          throw new Error(
            result.error instanceof Error
              ? result.error.message
              : 'Failed to send announcement'
          );
        }
        
        const endTime = performance.now();
        
        logActivity({
          operation: 'mutation',
          eventId: request.eventId,
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: { type: 'sendAnnouncement', success: true },
        });
        
        return result.data?.message as Message;
        
      } catch (error) {
        const endTime = performance.now();
        
        logActivity({
          operation: 'mutation',
          eventId: request.eventId,
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: {
            type: 'sendAnnouncement',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        
        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateAfterMutation('sendMessage', variables.eventId);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Send channel mutation
  const sendChannelMutation = useMutation({
    mutationFn: async (request: Omit<SendMessageRequest, 'messageType'>): Promise<Message> => {
      const fullRequest: SendMessageRequest = {
        ...request,
        messageType: 'channel',
      };
      
      const result = await sendMessageToEvent(fullRequest);
      
      if (!result.success) {
        throw new Error(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to send channel message'
        );
      }
      
      return result.data?.message as Message;
    },
    onSuccess: async (data, variables) => {
      await invalidateAfterMutation('sendMessage', variables.eventId);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Send direct mutation
  const sendDirectMutation = useMutation({
    mutationFn: async (request: Omit<SendMessageRequest, 'messageType'>): Promise<Message> => {
      const fullRequest: SendMessageRequest = {
        ...request,
        messageType: 'direct',
      };
      
      const result = await sendMessageToEvent(fullRequest);
      
      if (!result.success) {
        throw new Error(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to send direct message'
        );
      }
      
      return result.data?.message as Message;
    },
    onSuccess: async (data, variables) => {
      // Note: Direct messages don't invalidate message lists (delivery-gated)
      // They only invalidate delivery-related caches
      await invalidateAfterMutation('sendMessage', variables.eventId);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Schedule message mutation
  const scheduleMessageMutation = useMutation({
    mutationFn: async (data: ScheduledMessageInsert): Promise<ScheduledMessage> => {
      const startTime = performance.now();
      
      try {
        setGlobalError(null);
        
        logActivity({
          operation: 'mutation',
          eventId: data.event_id,
          timing: { startTime, endTime: startTime, duration: '0ms' },
          metadata: { type: 'scheduleMessage', starting: true },
        });
        
        const { data: scheduledMessage, error } = await supabase
          .from('scheduled_messages')
          .insert(data)
          .select('*')
          .single();
        
        if (error) {
          throw new Error(error.message);
        }
        
        const endTime = performance.now();
        
        logActivity({
          operation: 'mutation',
          eventId: data.event_id,
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: { type: 'scheduleMessage', success: true },
        });
        
        return scheduledMessage;
        
      } catch (error) {
        const endTime = performance.now();
        
        logActivity({
          operation: 'mutation',
          eventId: data.event_id,
          timing: {
            startTime,
            endTime,
            duration: `${(endTime - startTime).toFixed(1)}ms`,
          },
          metadata: {
            type: 'scheduleMessage',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        
        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateAfterMutation('scheduleMessage', variables.event_id, undefined, data.id);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Cancel scheduled message mutation
  const cancelScheduledMutation = useMutation({
    mutationFn: async (id: string): Promise<string> => {
      // First get the scheduled message to know which event to invalidate
      const { data: scheduledMessage, error: fetchError } = await supabase
        .from('scheduled_messages')
        .select('event_id')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to find scheduled message: ${fetchError.message}`);
      }
      
      // Cancel the scheduled message
      const { error: deleteError } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        throw new Error(`Failed to cancel scheduled message: ${deleteError.message}`);
      }
      
      return scheduledMessage.event_id;
    },
    onSuccess: async (eventId: string, id) => {
      await invalidateAfterMutation('cancelScheduled', eventId, undefined, id);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async ({ eventId, messageId }: { eventId: string; messageId: string }): Promise<void> => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('event_id', eventId); // Security: ensure message belongs to this event
      
      if (error) {
        throw new Error(`Failed to delete message: ${error.message}`);
      }
    },
    onSuccess: async (data, variables) => {
      await invalidateAfterMutation('deleteMessage', variables.eventId, variables.messageId);
    },
    onError: (error) => {
      setGlobalError(error as Error);
    },
  });
  
  // Track overall loading state
  const combinedIsLoading = 
    sendAnnouncementMutation.isPending ||
    sendChannelMutation.isPending ||
    sendDirectMutation.isPending ||
    scheduleMessageMutation.isPending ||
    cancelScheduledMutation.isPending ||
    deleteMessageMutation.isPending;
  
  // Update global loading state
  if (combinedIsLoading !== isLoading) {
    setIsLoading(combinedIsLoading);
  }
  
  return {
    sendAnnouncement: sendAnnouncementMutation.mutateAsync,
    sendChannel: sendChannelMutation.mutateAsync,
    sendDirect: sendDirectMutation.mutateAsync,
    scheduleMessage: scheduleMessageMutation.mutateAsync,
    cancelScheduled: useCallback(
      async (id: string) => {
        await cancelScheduledMutation.mutateAsync(id);
      },
      [cancelScheduledMutation.mutateAsync]
    ),
    deleteMessage: useCallback(
      (eventId: string, messageId: string) => 
        deleteMessageMutation.mutateAsync({ eventId, messageId }),
      [deleteMessageMutation.mutateAsync]
    ),
    isLoading: combinedIsLoading,
    error: globalError,
  };
}
