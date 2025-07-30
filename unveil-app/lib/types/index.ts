/**
 * Enhanced Type System for Unveil
 *
 * OPTIMIZED FOR TREE-SHAKING: Use specific imports instead of wildcards
 * Import directly from module files when possible to avoid bundling unused code.
 */

// Re-export all types for easy importing
export type { Database, Tables, TablesInsert, TablesUpdate } from '@/app/reference/supabase.types';

// Base types
export * from './forms';
export * from './errors';
export * from './hooks';
export * from './analytics';

// Messaging types
export * from './messaging';

// Service functions - add these exports to resolve import errors
export { 
  sendMessageToEvent,
  getScheduledMessages,
  createScheduledMessage
} from '@/lib/services/messaging';

export {
  getEventById,
  getHostEvents,
  getEventGuests  
} from '@/lib/services/events';

export {
  uploadEventMedia
} from '@/lib/services/media';

// Hook exports
export { useGuestMessages } from '@/hooks/messaging/useGuestMessages';
export { useGuestTags } from '@/hooks/messaging/useGuestTags';

// Realtime subscriptions
export { 
  subscribeToEventMessages,
  subscribeToEventMedia
} from '@/lib/realtime/subscriptions';
