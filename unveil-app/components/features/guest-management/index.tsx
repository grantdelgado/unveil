'use client';

import { GuestManagementErrorBoundary } from './shared/ErrorBoundary';
import { FeedbackProvider } from './shared/UserFeedback';
import { GuestManagementContainer, type GuestManagementContainerProps } from './GuestManagementContainer';

/**
 * Main guest management component with error boundary and feedback provider
 * This is the public API for the guest management module
 */
export function GuestManagement(props: GuestManagementContainerProps) {
  return (
    <GuestManagementErrorBoundary>
      <FeedbackProvider>
        <GuestManagementContainer {...props} />
      </FeedbackProvider>
    </GuestManagementErrorBoundary>
  );
}

// Re-export types for external consumers
export type { GuestManagementContainerProps as GuestManagementProps };

// Re-export components for advanced usage
export { GuestManagementContainer } from './GuestManagementContainer';
export { GuestFilters } from './filters/GuestFilters';
export { GuestActions } from './actions/GuestActions';
export { GuestList } from './list/GuestList';
export { BulkSelectionBar } from './actions/BulkSelectionBar';

// Re-export hooks (using stable simple store for production reliability)
export { useSimpleGuestStore as useRealtimeGuestStore, useSimpleGuestList as useGuestList, useSimpleGuestStatusCounts as useGuestStatusCounts } from '@/hooks/guests/useSimpleGuestStore';