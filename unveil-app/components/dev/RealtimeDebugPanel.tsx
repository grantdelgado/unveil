'use client';

import { useState, useEffect } from 'react';
import { useRealtimeHealth } from '@/hooks/realtime/useRealtimeHealth';

interface RealtimeDebugPanelProps {
  enabled?: boolean;
}

interface SubscriptionDetail {
  id: string;
  table: string;
  event: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  lastHeartbeat?: Date;
  errorCount: number;
  connectionAttempts: number;
  uptime: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export function RealtimeDebugPanel({ enabled = process.env.NODE_ENV === 'development' }: RealtimeDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use the monitoring hook for health data
  const { health, reconnectAll, getSubscriptionDetails } = useRealtimeHealth({
    enabled,
    enableLogging: false // Disable logging in debug panel to avoid noise
  });

  // Get subscription details for expanded view
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetail[]>([]);

  useEffect(() => {
    if (!enabled || !isExpanded) return;

    const updateDetails = () => {
      const details = getSubscriptionDetails();
      setSubscriptionDetails(details);
    };

    updateDetails();
    const interval = setInterval(updateDetails, 3000);

    return () => clearInterval(interval);
  }, [enabled, isExpanded, getSubscriptionDetails]);

  if (!enabled || !health.isMonitoring) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg max-w-sm">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 border-b border-gray-200 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(health.connectionState)}`} />
            <span className="text-sm font-medium text-gray-700">Realtime Debug</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${getHealthColor(health.healthScore)}`}>
              {health.healthScore}%
            </span>
            <svg 
              className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {/* Connection Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Active:</span>
                <span className="ml-1 font-medium">{health.activeSubscriptions}</span>
              </div>
              <div>
                <span className="text-gray-500">Recent Errors:</span>
                <span className="ml-1 font-medium text-red-600">{health.recentErrors}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Errors:</span>
                <span className="ml-1 font-medium text-red-600">{health.errorCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Avg Connect:</span>
                <span className="ml-1 font-medium text-blue-600">{Math.round(health.avgConnectionTime)}ms</span>
              </div>
            </div>

            {/* Connection State */}
            <div className="text-xs">
              <span className="text-gray-500">State:</span>
              <span className={`ml-1 font-medium ${getStatusColor(health.connectionState)}`}>
                {health.connectionState}
              </span>
            </div>

            {/* Uptime */}
            <div className="text-xs">
              <span className="text-gray-500">Uptime:</span>
              <span className="ml-1 font-medium">
                {Math.round(health.uptime / 1000 / 60)}m
              </span>
            </div>

            {/* Last Error */}
            {health.lastError && (
              <div className="text-xs">
                <span className="text-gray-500">Last Error:</span>
                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                  {health.lastError.message.substring(0, 100)}
                  {health.lastError.message.length > 100 && '...'}
                </div>
              </div>
            )}

            {/* Active Subscriptions */}
            {subscriptionDetails.length > 0 && (
              <div className="text-xs">
                <span className="text-gray-500 block mb-2">Active Subscriptions:</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {subscriptionDetails.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-1 bg-gray-50 rounded">
                      <div className="truncate">
                        <span className="font-medium">{sub.table}</span>
                        {sub.id.includes('pooled-') && <span className="text-blue-600 ml-1">📦</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          sub.healthStatus === 'healthy' ? 'bg-green-500' :
                          sub.healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        {sub.errorCount > 0 && (
                          <span className="text-red-600 text-xs">{sub.errorCount}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <button
                onClick={() => {
                  try {
                    reconnectAll();
                  } catch (error) {
                    console.error('Failed to reconnect:', error);
                  }
                }}
                className="w-full px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-700 transition-colors"
              >
                Force Reconnect All
              </button>
              
              <button
                onClick={async () => {
                  try {
                    const { runAllStabilityTests } = await import('@/lib/utils/realtimeTestUtils');
                    const results = await runAllStabilityTests();
                    console.log('🧪 Stability test results:', results);
                    alert(`Tests completed: ${results.passed} passed, ${results.failed} failed. Check console for details.`);
                  } catch (error) {
                    console.error('Failed to run stability tests:', error);
                    alert('Failed to run stability tests. Check console for details.');
                  }
                }}
                className="w-full px-2 py-1 text-xs bg-green-50 hover:bg-green-100 border border-green-200 rounded text-green-700 transition-colors"
              >
                Run Stability Tests
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
