/**
 * Core Messaging Hooks - Main Exports
 * 
 * This is the single source of truth for consolidated messaging hooks.
 * All messaging functionality should use these 5 core hooks.
 * 
 * RULES FOR USAGE:
 * 1. Only import from this file for new code
 * 2. Use compatibility layer (../compat/*) for migration period
 * 3. Never create new messaging hooks outside this system
 * 4. Follow semantic versioning for breaking changes
 */

// Core hook exports (THE ONLY 5 MESSAGING HOOKS)
export { useEventMessagesList } from './useEventMessagesList';
export { useMessageById } from './useMessageById';
export { useDeliveriesByMessage } from './useDeliveriesByMessage';
export { useMessageMutations } from './useMessageMutations';
export { useMessageRealtime } from './useMessageRealtime';

// Type exports
export type {
  // Core types
  Message,
  MessageInsert,
  MessageWithSender,
  ScheduledMessage,
  ScheduledMessageInsert,
  MessageDelivery,
  MessageDeliveryWithMessage,
  GuestMessage,
  
  // Options types
  PaginationOptions,
  MessageListOptions,
  DeliveryListOptions,
  ScheduledMessageListOptions,
  RealtimeOptions,
  RecipientFilter,
  SendViaOptions,
  SendMessageRequest,
  
  // Return types
  UseEventMessagesListReturn,
  UseMessageByIdReturn,
  UseDeliveriesByMessageReturn,
  UseMessageMutationsReturn,
  UseMessageRealtimeReturn,
  
  // Utility types
  PaginatedResponse,
  DevObservabilityEvent,
  MessageListKey,
  MessageByIdKey,
  MessageDeliveriesKey,
  ScheduledMessagesKey,
} from './types';

// Version and metadata
export const CORE_HOOKS_VERSION = '1.0.0';
export const CONSOLIDATION_DATE = '2025-01-25';

/**
 * Development utilities for debugging and monitoring
 */
export const coreHooksDebug = {
  // Check if a component is using core hooks vs legacy hooks
  isUsingCoreHooks: (hookName: string): boolean => {
    const coreHookNames = [
      'useEventMessagesList',
      'useMessageById',
      'useDeliveriesByMessage',
      'useMessageMutations',
      'useMessageRealtime',
    ];
    return coreHookNames.includes(hookName);
  },
  
  // Get list of all core hook names
  getCoreHookNames: (): string[] => [
    'useEventMessagesList',
    'useMessageById', 
    'useDeliveriesByMessage',
    'useMessageMutations',
    'useMessageRealtime',
  ],
  
  // Log usage statistics (dev only)
  logUsageStats: (): void => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Core Messaging Hooks]', {
        version: CORE_HOOKS_VERSION,
        consolidationDate: CONSOLIDATION_DATE,
        totalHooks: 5,
        status: 'active',
      });
    }
  },
} as const;

/**
 * ESLint configuration helper
 * Use this to configure ESLint rules that enforce core hook usage
 */
export const eslintConfig = {
  // Restricted imports - prevent direct import of legacy hooks
  restrictedPaths: [
    'hooks/messaging/useMessages.ts',
    'hooks/messaging/useScheduledMessages.ts',
    'hooks/messaging/scheduled/*.ts',
    'hooks/queries/useEventMessages.ts',
  ],
  
  // Allowed import paths
  allowedPaths: [
    'hooks/messaging/_core',
    'hooks/messaging/compat', // Temporary during migration
  ],
} as const;

/**
 * Runtime validation helpers
 */
export const validation = {
  // Validate that required parameters are provided
  validateEventId: (eventId: string | undefined): string => {
    if (!eventId) {
      throw new Error('eventId is required for messaging operations');
    }
    return eventId;
  },
  
  // Validate message ID format
  validateMessageId: (messageId: string | undefined): string => {
    if (!messageId) {
      throw new Error('messageId is required');
    }
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(messageId)) {
      throw new Error('messageId must be a valid UUID');
    }
    return messageId;
  },
  
  // Validate pagination options
  validatePaginationOptions: (options: any): void => {
    if (options?.limit && (options.limit < 1 || options.limit > 100)) {
      throw new Error('Pagination limit must be between 1 and 100');
    }
  },
} as const;
