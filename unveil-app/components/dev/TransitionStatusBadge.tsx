"use client";

import React from 'react';
import { useTransitionStore } from '@/lib/hooks/useTransitionStore';

interface TransitionStatusBadgeProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const TransitionStatusBadge: React.FC<TransitionStatusBadgeProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  position = 'top-right'
}) => {
  const { isLoading, lastNavigationId, debugMode } = useTransitionStore();

  if (!enabled || !debugMode) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-[9998] pointer-events-none`}>
      <div className="bg-black/90 text-white px-3 py-2 rounded-lg shadow-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-red-500' : 'bg-green-500'}`}></span>
          <span>Loading: {isLoading ? 'TRUE' : 'FALSE'}</span>
          {lastNavigationId && (
            <>
              <span className="text-gray-400">|</span>
              <span>ID: {lastNavigationId}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

TransitionStatusBadge.displayName = 'TransitionStatusBadge';
