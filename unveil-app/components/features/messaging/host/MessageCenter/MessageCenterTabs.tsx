/**
 * MessageCenterTabs Component
 * 
 * Tab navigation component for the Message Center.
 * Handles switching between compose and history views.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { ActiveView } from './useMessageCenter';

interface MessageCenterTabsProps {
  activeView: ActiveView;
  messagesCount: number;
  onActiveViewChange: (view: ActiveView) => void;
  className?: string;
}

export function MessageCenterTabs({ 
  activeView, 
  messagesCount, 
  onActiveViewChange,
  className 
}: MessageCenterTabsProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        <span className="text-xl">💬</span>
        <h2 className="text-lg font-medium text-gray-900">Messaging Center</h2>
      </div>
      
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onActiveViewChange('compose')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            activeView === 'compose'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Compose
        </button>
        <button
          onClick={() => onActiveViewChange('history')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            activeView === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          History ({messagesCount})
        </button>
      </div>
    </div>
  );
} 