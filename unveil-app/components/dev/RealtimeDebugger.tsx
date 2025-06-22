'use client';

import { useState, useEffect } from 'react';
import { getSubscriptionManager } from '@/lib/realtime/SubscriptionManager';
import { logger } from '@/lib/logger';

interface RealtimeDebuggerProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function RealtimeDebugger({
  enabled = process.env.NODE_ENV === 'development',
  position = 'bottom-left',
}: RealtimeDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    errorCount: number;
    connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
    uptime: number;
    lastError: {
      realtimeCode?: string;
      message: string;
      timestamp: Date;
    } | null;
  } | null>(null);
  const [subscriptions, setSubscriptions] = useState<
    Array<{
      id: string;
      table: string;
      event: string;
      isActive: boolean;
      createdAt: Date;
      lastActivity: Date;
      errorCount: number;
      uptime: number;
    }>
  >([]);

  useEffect(() => {
    if (!enabled) return;

    const updateStats = () => {
      try {
        const manager = getSubscriptionManager();
        const currentStats = manager.getStats();
        const currentSubscriptions = manager.getSubscriptionDetails();

        setStats(currentStats);
        setSubscriptions(currentSubscriptions);
      } catch (error) {
        logger.error('❌ Error updating realtime debugger stats', error);
      }
    };

    // Update immediately
    updateStats();

    // Set up interval for updates
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  const getConnectionStatusColor = (state: string) => {
    switch (state) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'disconnected':
        return 'text-gray-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = (state: string) => {
    switch (state) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '⚪';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full shadow-lg transition-colors"
        title="Real-time Debugger"
      >
        📡
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Real-time Debug</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {stats ? (
            <div className="space-y-3">
              {/* Connection Status */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Connection
                  </span>
                  <div className="flex items-center space-x-1">
                    <span>
                      {getConnectionStatusIcon(stats.connectionState)}
                    </span>
                    <span
                      className={`text-sm font-medium ${getConnectionStatusColor(stats.connectionState)}`}
                    >
                      {stats.connectionState}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Uptime:</span>
                    <div>{formatUptime(stats.uptime)}</div>
                  </div>
                  <div>
                    <span className="font-medium">Errors:</span>
                    <div
                      className={
                        stats.errorCount > 0 ? 'text-red-600' : 'text-green-600'
                      }
                    >
                      {stats.errorCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Stats */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Subscriptions
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Total:</span>
                    <div>{stats.totalSubscriptions}</div>
                  </div>
                  <div>
                    <span className="font-medium">Active:</span>
                    <div
                      className={
                        stats.activeSubscriptions > 0
                          ? 'text-green-600'
                          : 'text-gray-600'
                      }
                    >
                      {stats.activeSubscriptions}
                    </div>
                  </div>
                </div>
              </div>

              {/* Last Error */}
              {stats.lastError && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-red-700 mb-1">
                    Last Error
                  </div>
                  <div className="text-xs text-red-600">
                    {stats.lastError.realtimeCode}: {stats.lastError.message}
                  </div>
                  <div className="text-xs text-red-500 mt-1">
                    {new Date(stats.lastError.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}

              {/* Active Subscriptions List */}
              {subscriptions.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Active Subscriptions
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="text-xs bg-white p-2 rounded border"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">
                            {sub.table}
                          </span>
                          <span
                            className={
                              sub.isActive ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {sub.isActive ? '🟢' : '🔴'}
                          </span>
                        </div>
                        <div className="text-gray-600">
                          <div>ID: {sub.id}</div>
                          <div>Event: {sub.event}</div>
                          <div>Uptime: {formatUptime(sub.uptime)}</div>
                          {sub.errorCount > 0 && (
                            <div className="text-red-600">
                              Errors: {sub.errorCount}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    try {
                      const manager = getSubscriptionManager();
                      manager.reconnectAll();
                      logger.realtime(
                        '🔄 Manual reconnect triggered from debugger',
                      );
                    } catch (error) {
                      logger.error('❌ Error triggering reconnect', error);
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded transition-colors"
                >
                  Reconnect All
                </button>
                <button
                  onClick={() => {
                    const currentStats = getSubscriptionManager().getStats();
                    const currentSubscriptions =
                      getSubscriptionManager().getSubscriptionDetails();

                    console.group('📡 Real-time Debug Info');
                    console.log('Stats:', currentStats);
                    console.log('Subscriptions:', currentSubscriptions);
                    console.groupEnd();

                    logger.realtime('📊 Debug info logged to console');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs py-2 px-3 rounded transition-colors"
                >
                  Log to Console
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              Loading debug info...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
