'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { RSVP_STATUS } from '@/lib/types/rsvp';
import { SecondaryButton } from '@/components/ui';

export interface BulkSelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkAction: (actionType: string, payload?: unknown) => Promise<void>;
  loading: boolean;
  className?: string;
}

/**
 * Floating action bar for bulk operations on selected guests
 * Appears when guests are selected and provides quick actions
 */
export const BulkSelectionBar = memo<BulkSelectionBarProps>(({
  selectedCount,
  onClearSelection,
  onBulkAction,
  loading,
  className
}) => {
  const handleBulkRSVPUpdate = (status: string) => {
    onBulkAction('rsvp', { status });
  };

  const handleBulkRemove = () => {
    onBulkAction('remove');
  };

  return (
    <div 
      className={cn(
        'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40',
        'bg-gradient-to-r from-[#FF6B6B] to-purple-600 text-white rounded-lg p-4 shadow-lg',
        'border border-white/20 backdrop-blur-sm',
        'max-w-sm w-full mx-4',
        'transition-all duration-300 ease-out',
        className
      )}
      role="toolbar"
      aria-label="Bulk actions for selected guests"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🎯</span>
          <p className="font-medium">
            {selectedCount} guest{selectedCount > 1 ? 's' : ''} selected
          </p>
        </div>
        <button
          onClick={onClearSelection}
          disabled={loading}
          className={cn(
            'text-white/80 hover:text-white transition-colors duration-200',
            'p-1 rounded hover:bg-white/10',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Clear selection"
          aria-label="Clear selection"
        >
          ✕
        </button>
      </div>

      {/* Bulk RSVP Actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        <SecondaryButton
          onClick={() => handleBulkRSVPUpdate(RSVP_STATUS.ATTENDING)}
          disabled={loading}
          className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3 text-xs"
          fullWidth={false}
        >
          {loading ? (
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            '✅ Attending'
          )}
        </SecondaryButton>
        
        <SecondaryButton
          onClick={() => handleBulkRSVPUpdate(RSVP_STATUS.MAYBE)}
          disabled={loading}
          className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3 text-xs"
          fullWidth={false}
        >
          🤷‍♂️ Maybe
        </SecondaryButton>
        
        <SecondaryButton
          onClick={() => handleBulkRSVPUpdate(RSVP_STATUS.DECLINED)}
          disabled={loading}
          className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3 text-xs"
          fullWidth={false}
        >
          ❌ Declined
        </SecondaryButton>
        
        <SecondaryButton
          onClick={() => handleBulkRSVPUpdate(RSVP_STATUS.PENDING)}
          disabled={loading}
          className="bg-white text-gray-900 hover:bg-gray-100 py-2 px-3 text-xs"
          fullWidth={false}
        >
          ⏳ Pending
        </SecondaryButton>
      </div>

      {/* Destructive Actions */}
      <div className="flex gap-2">
        <SecondaryButton
          onClick={handleBulkRemove}
          disabled={loading}
          className="bg-red-600 text-white hover:bg-red-700 py-2 px-3 text-xs border-red-600"
          fullWidth={false}
        >
          🗑️ Remove Selected
        </SecondaryButton>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
          <div className="flex items-center gap-2 text-white">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
});

BulkSelectionBar.displayName = 'BulkSelectionBar';