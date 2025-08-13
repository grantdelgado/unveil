"use client";

import React, { useEffect, useState } from 'react';
import { useTransitionStore } from '@/lib/hooks/useTransitionStore';
import { usePathname } from 'next/navigation';

interface TransitionDebuggerProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const TransitionDebugger: React.FC<TransitionDebuggerProps> = ({
  enabled = process.env.NODE_ENV === 'development',
  position = 'bottom-right'
}) => {
  const { isLoading, currentRoute, startedAt, lastNavigationId, debugMode, setDebugMode } = useTransitionStore();
  const pathname = usePathname();
  const [logs, setLogs] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const originalLog = console.log;
    const originalWarn = console.warn;
    
    const captureLog = (level: 'log' | 'warn') => (...args: unknown[]) => {
      const message = args.join(' ');
      if (message.includes('[TRANSITION]') || message.includes('[NAV]')) {
        setLogs(prev => {
          const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
          return newLogs.slice(-10); // Keep last 10 logs
        });
      }
      
      if (level === 'log') {
        originalLog(...args);
      } else {
        originalWarn(...args);
      }
    };

    console.log = captureLog('log');
    console.warn = captureLog('warn');

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
    };
  }, [enabled]);

  if (!enabled) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const duration = startedAt ? Date.now() - startedAt : 0;

  return (
    <div className={`fixed ${positionClasses[position]} z-[9999] font-mono text-xs`}>
      <div className="bg-black/90 text-white p-3 rounded-lg shadow-xl max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-yellow-400">Transition Debug</h3>
          <div className="flex gap-1">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`px-1 py-0.5 rounded text-xs ${
                debugMode ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              {debugMode ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-1 py-0.5 bg-blue-600 rounded text-xs"
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>
        </div>
        
        <div className="space-y-1 text-xs">
          <div className={`flex justify-between ${isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
            <span>Status:</span>
            <span>{isLoading ? `Loading (${duration}ms)` : 'Ready'}</span>
          </div>
          
          <div className="flex justify-between">
            <span>Current:</span>
            <span className="text-blue-400 truncate max-w-32">{pathname}</span>
          </div>
          
          {currentRoute && currentRoute !== pathname && (
            <div className="flex justify-between">
              <span>Target:</span>
              <span className="text-orange-400 truncate max-w-32">{currentRoute}</span>
            </div>
          )}
          
          {lastNavigationId && (
            <div className="flex justify-between">
              <span>Nav ID:</span>
              <span className="text-purple-400">{lastNavigationId}</span>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="text-xs text-gray-300 mb-2">Recent Logs:</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="text-xs text-gray-300 break-all">
                    {log}
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={() => setLogs([])}
                className="px-2 py-1 bg-red-600 rounded text-xs"
              >
                Clear Logs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

TransitionDebugger.displayName = 'TransitionDebugger';
