'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { LoadingStates } from '../shared/types';
import { PrimaryButton, SecondaryButton } from '@/components/ui';

export interface GuestActionsProps {
  onImportGuests?: () => void;
  onBulkAction: (actionType: string, payload?: unknown) => Promise<void>;
  loading: LoadingStates;
  className?: string;
}

/**
 * Action buttons for guest management operations
 * Includes import, export, and quick action buttons
 */
export const GuestActions = memo<GuestActionsProps>(({
  onImportGuests,
  onBulkAction,
  loading,
  className
}) => {

  return (
    <div className={cn('flex flex-col sm:flex-row gap-3', className)}>
      {/* Primary actions */}
      <div className="flex gap-2">
        <PrimaryButton
          onClick={onImportGuests}
          disabled={loading.import}
          className="flex items-center gap-2"
        >
          {loading.import ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Importing...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Import Guests</span>
            </>
          )}
        </PrimaryButton>

        {/* TODO: Export button for Phase 3 */}
        <SecondaryButton
          disabled
          className="flex items-center gap-2 opacity-50"
          title="Export functionality coming in Phase 3"
        >
          <span>📊</span>
          <span>Export</span>
        </SecondaryButton>
      </div>

      {/* Quick actions (shown when guests exist) */}
      <div className="flex gap-2">
        {/* TODO: Add quick actions like "Mark all pending as attending" */}
        <SecondaryButton
          onClick={() => onBulkAction('markAllPendingAttending')}
          disabled={loading.bulkAction}
          className="flex items-center gap-2 text-sm"
        >
          <span>✅</span>
          <span>Mark Pending</span>
        </SecondaryButton>

        <SecondaryButton
          disabled
          className="flex items-center gap-2 text-sm opacity-50"
          title="Send reminders coming soon"
        >
          <span>📱</span>
          <span>Send Reminder</span>
        </SecondaryButton>
      </div>
    </div>
  );
});

GuestActions.displayName = 'GuestActions';