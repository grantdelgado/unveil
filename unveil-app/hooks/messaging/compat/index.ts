/**
 * Compatibility Layer - Main Exports
 * 
 * Temporary compatibility wrappers for existing messaging hooks.
 * These provide backward compatibility during the migration period.
 * 
 * @deprecated All hooks in this module are deprecated
 * Use hooks from '../_core' instead for new code
 * 
 * MIGRATION TIMELINE:
 * - Phase 1: Add compat layer (this file) ✅
 * - Phase 2: Update imports to use compat layer
 * - Phase 3: Migrate components to core hooks
 * - Phase 4: Remove compat layer (target: 2025-02-15)
 */

// Core compatibility wrappers
export { useMessages } from './useMessages';
export { 
  useEventMessages, 
  useSendMessage,
  useMessagesRealtime,
  useMessagesPagination,
  queryKeys,
} from './useEventMessages';

export {
  useScheduledMessages,
  useScheduledMessagesQuery,
  useScheduledMessagesCache,
  useScheduledMessagesRealtime,
  useUpcomingScheduledMessagesCount,
} from './useScheduledMessages';

// Re-export legacy types for compatibility
export type { UseMessagesReturn } from './useMessages';

/**
 * Migration utilities
 */
export const compatibilityInfo = {
  version: '1.0.0-compat',
  deprecationDate: '2025-01-25',
  removalDate: '2025-02-15',
  
  // Migration guide URLs
  guides: {
    useMessages: '/docs/migration/useMessages.md',
    useEventMessages: '/docs/migration/useEventMessages.md', 
    useScheduledMessages: '/docs/migration/useScheduledMessages.md',
  },
  
  // ESLint rule to warn about compat usage
  eslintRule: 'messaging-hooks/no-compat-imports',
} as const;

/**
 * Development helper to track compat usage
 */
export function trackCompatUsage(hookName: string, location?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[COMPAT] ${hookName} used`);
    console.warn('This hook is deprecated and will be removed on 2025-02-15');
    console.info('Migration guide:', compatibilityInfo.guides[hookName as keyof typeof compatibilityInfo.guides]);
    if (location) {
      console.info('Used at:', location);
    }
    console.groupEnd();
    
    // Track usage for metrics
    if (typeof window !== 'undefined') {
      (window as any).__COMPAT_USAGE__ = (window as any).__COMPAT_USAGE__ || [];
      (window as any).__COMPAT_USAGE__.push({
        hook: hookName,
        location,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
