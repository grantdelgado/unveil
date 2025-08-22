'use client';

import React, { memo } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface BulkActionShortcutsProps {
  onMarkAllPendingAsAttending: () => void;
  onSendReminderToPending: () => void;
  onImportGuests: () => void;
  pendingCount: number;
  totalCount: number;
  loading?: boolean;
  className?: string;
}

export const BulkActionShortcuts = memo<BulkActionShortcutsProps>(
  ({
    onMarkAllPendingAsAttending,
    onSendReminderToPending,
    onImportGuests,
    pendingCount,
    totalCount,
    loading = false,
    className,
  }) => {
    const hasGuests = totalCount > 0;
    const hasPendingGuests = pendingCount > 0;

    return (
      <div className={cn('space-y-3', className)}>
        {/* Guest Import - Always visible for quick access */}
        <div className="flex flex-col sm:flex-row gap-2">
          <PrimaryButton
            onClick={onImportGuests}
            disabled={loading}
            className="flex items-center justify-center gap-2 min-h-[44px]"
            fullWidth={false}
          >
            <span className="text-lg">📋</span>
            <span>Import Guests</span>
          </PrimaryButton>
        </div>

        {/* Bulk Actions - Show when guests exist */}
        {hasGuests && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-base">⚡</span>
              Quick Actions
            </h3>

            <div className="space-y-2">
              {/* Mark All Pending as Attending */}
              {hasPendingGuests && (
                <SecondaryButton
                  onClick={onMarkAllPendingAsAttending}
                  disabled={loading}
                  className={cn(
                    'w-full justify-start gap-3 min-h-[44px] text-left',
                    'hover:bg-green-50 hover:border-green-200 hover:text-green-800',
                  )}
                >
                  <span className="text-lg">✅</span>
                  <div className="flex-1">
                    <div className="font-medium">
                      Mark All Pending as Attending
                    </div>
                    <div className="text-xs text-gray-500">
                      {pendingCount} guest{pendingCount !== 1 ? 's' : ''}{' '}
                      pending
                    </div>
                  </div>
                </SecondaryButton>
              )}

              {/* Send Reminder to Pending */}
              {hasPendingGuests && (
                <SecondaryButton
                  onClick={onSendReminderToPending}
                  disabled={loading}
                  className={cn(
                    'w-full justify-start gap-3 min-h-[44px] text-left',
                    'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800',
                  )}
                >
                  <span className="text-lg">📱</span>
                  <div className="flex-1">
                    <div className="font-medium">Send RSVP Reminder</div>
                    <div className="text-xs text-gray-500">
                      To {pendingCount} pending guest
                      {pendingCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </SecondaryButton>
              )}

              {/* Encourage importing if no guests */}
              {!hasGuests && (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-2">👥</div>
                  <p className="text-sm font-medium">No guests yet</p>
                  <p className="text-xs">
                    Import your guest list to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

BulkActionShortcuts.displayName = 'BulkActionShortcuts';
