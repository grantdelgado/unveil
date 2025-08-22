/**
 * Hooks Barrel - OPTIMIZED FOR TREE-SHAKING
 *
 * WARNING: Wildcard exports can significantly bloat your bundle.
 * RECOMMENDED: Import hooks directly:
 * - import { useAuth } from '@/hooks/useAuth'
 * - import { useUserEvents } from '@/hooks/events'
 * - import { useGuests } from '@/hooks/guests'
 *
 * Use this barrel only when importing multiple hooks from the same domain.
 */

// Core hooks (standalone files)
export { useAuth } from './useAuth';
export { usePostAuthRedirect } from './usePostAuthRedirect';

// Domain hooks (organized)
// export * from './auth'; // Auth hooks moved to useAuth.ts
export * from './events';
export * from './guests';
// export * from './media'; // Media hooks not yet implemented
// export * from './messaging'; // Messaging hooks not yet implemented

// Common utilities
export * from './common';

// Performance monitoring
export * from './performance';

// Query hooks (top-level for specific use cases)
// export * from './queries'; // Queries moved to specific domain folders

// Legacy hooks removed:
// - useEventDetails, useEventInsights, useUserEventsSorted (replaced by modern alternatives)
// - useMedia, useMessages (moved to domain-specific folders)

// Additional utility hooks can be added here as needed
// Keep exports minimal and focused to maintain tree-shaking benefits
