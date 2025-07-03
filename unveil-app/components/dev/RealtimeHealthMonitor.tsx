'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSubscriptionManager } from '@/lib/realtime/SubscriptionManager';
import { supabase } from '@/lib/supabase/client';

interface RealtimeHealthMonitorProps {
  eventId?: string;
  enabled?: boolean;
}

interface SubscriptionHealth {
  subscriptionCount: number;
  activeSubscriptions: number;
  connectionState: string;
  errorCount: number;
  healthScore: number;
  uptime: number;
  avgConnectionTime: number;
  subscriptions: Array<{
    id: string;
    table: string;
    isActive: boolean;
    errorCount: number;
    uptime: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
  }>;
  lastError?: {
    message: string;
    timestamp: Date;
    subscriptionId?: string;
  } | null;
}

export function RealtimeHealthMonitor({ 
  eventId, 
  enabled = process.env.NODE_ENV === 'development' 
}: RealtimeHealthMonitorProps) {
  const [health, setHealth] = useState<SubscriptionHealth | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ 
    test: string; 
    status: 'pass' | 'fail' | 'running'; 
    message: string;
    timestamp: Date;
  }>>([]);

  // Update health stats
  const updateHealth = useCallback(() => {
    try {
      const manager = getSubscriptionManager();
      const stats = manager.getStats();
      const details = manager.getSubscriptionDetails();

      setHealth({
        subscriptionCount: stats.totalSubscriptions,
        activeSubscriptions: stats.activeSubscriptions,
        connectionState: stats.connectionState,
        errorCount: stats.errorCount,
        healthScore: stats.healthScore,
        uptime: stats.uptime,
        avgConnectionTime: stats.avgConnectionTime,
        subscriptions: details,
        lastError: stats.lastError,
      });
    } catch (error) {
      console.error('Failed to get subscription health:', error);
    }
  }, []);

  // Test database access
  const testDatabaseAccess = useCallback(async () => {
    const testName = 'Database Access';
    setTestResults(prev => [...prev, {
      test: testName,
      status: 'running',
      message: 'Testing database connection...',
      timestamp: new Date(),
    }]);

    try {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .limit(1);

      if (error) throw error;

      setTestResults(prev => prev.map(result => 
        result.test === testName 
          ? { ...result, status: 'pass', message: `Database accessible (${data?.length || 0} events)` }
          : result
      ));
    } catch (error) {
      setTestResults(prev => prev.map(result => 
        result.test === testName 
          ? { 
              ...result, 
              status: 'fail', 
              message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}` 
            }
          : result
      ));
    }
  }, []);

  // Test realtime connection
  const testRealtimeConnection = useCallback(async () => {
    const testName = 'Realtime Connection';
    setTestResults(prev => [...prev, {
      test: testName,
      status: 'running',
      message: 'Testing realtime connection...',
      timestamp: new Date(),
    }]);

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        setTestResults(prev => prev.map(result => 
          result.test === testName 
            ? { ...result, status: 'fail', message: 'Connection timeout after 10 seconds' }
            : result
        ));
        resolve();
      }, 10000);

      const channel = supabase.channel('health-test');
      
      channel.subscribe((status, error) => {
        clearTimeout(timeout);
        
        if (error) {
          setTestResults(prev => prev.map(result => 
            result.test === testName 
              ? { ...result, status: 'fail', message: `Connection failed: ${error.message}` }
              : result
          ));
        } else if (status === 'SUBSCRIBED') {
          setTestResults(prev => prev.map(result => 
            result.test === testName 
              ? { ...result, status: 'pass', message: 'Realtime connection successful' }
              : result
          ));
        }
        
        supabase.removeChannel(channel);
        resolve();
      });
    });
  }, []);

  // Test message subscription
  const testMessageSubscription = useCallback(async () => {
    if (!eventId) return;

    const testName = 'Message Subscription';
    setTestResults(prev => [...prev, {
      test: testName,
      status: 'running',
      message: `Testing message subscription for event ${eventId}...`,
      timestamp: new Date(),
    }]);

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        setTestResults(prev => prev.map(result => 
          result.test === testName 
            ? { ...result, status: 'fail', message: 'Subscription timeout after 15 seconds' }
            : result
        ));
        resolve();
      }, 15000);

      const channel = supabase
        .channel(`test-messages-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            // Success - received data
          }
        )
        .subscribe((status, error) => {
          clearTimeout(timeout);
          
          if (error) {
            setTestResults(prev => prev.map(result => 
              result.test === testName 
                ? { ...result, status: 'fail', message: `Subscription failed: ${error.message}` }
                : result
            ));
          } else if (status === 'SUBSCRIBED') {
            setTestResults(prev => prev.map(result => 
              result.test === testName 
                ? { ...result, status: 'pass', message: 'Message subscription successful' }
                : result
            ));
          } else if (status === 'TIMED_OUT') {
            setTestResults(prev => prev.map(result => 
              result.test === testName 
                ? { ...result, status: 'fail', message: 'Subscription timed out' }
                : result
            ));
          }
          
          supabase.removeChannel(channel);
          resolve();
        });
    });
  }, [eventId]);

  // Run all tests
  const runAllTests = useCallback(async () => {
    setTestResults([]);
    await testDatabaseAccess();
    await testRealtimeConnection();
    if (eventId) {
      await testMessageSubscription();
    }
  }, [testDatabaseAccess, testRealtimeConnection, testMessageSubscription, eventId]);

  // Set up periodic health updates
  useEffect(() => {
    if (!enabled) return;

    updateHealth();
    const interval = setInterval(updateHealth, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [enabled, updateHealth]);

  if (!enabled) {
    return null;
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'disconnected': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTestColor = (status: 'pass' | 'fail' | 'running') => {
    switch (status) {
      case 'pass': return 'text-green-500';
      case 'fail': return 'text-red-500';
      case 'running': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg border p-4 max-w-sm z-50">
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${health?.connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium text-sm">Realtime Health</span>
          {health && (
            <span className={`text-xs font-medium ${getHealthColor(health.healthScore)}`}>
              {health.healthScore}%
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && health && (
        <div className="mt-3 space-y-3 text-xs">
          {/* Connection Status */}
          <div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={getStatusColor(health.connectionState)}>
                {health.connectionState}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Subscriptions:</span>
              <span>{health.activeSubscriptions}/{health.subscriptionCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Errors:</span>
              <span className={health.errorCount > 0 ? 'text-red-500' : 'text-green-500'}>
                {health.errorCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Avg Connect:</span>
              <span>{Math.round(health.avgConnectionTime)}ms</span>
            </div>
          </div>

          {/* Last Error */}
          {health.lastError && (
            <div className="text-red-500 text-xs">
              <div className="font-medium">Last Error:</div>
              <div className="truncate" title={health.lastError.message}>
                {health.lastError.message}
              </div>
              {health.lastError.subscriptionId && (
                <div className="text-gray-500">
                  Subscription: {health.lastError.subscriptionId}
                </div>
              )}
            </div>
          )}

          {/* Subscription Details */}
          {health.subscriptions.length > 0 && (
            <div>
              <div className="font-medium mb-1">Active Subscriptions:</div>
              {health.subscriptions.slice(0, 3).map((sub) => (
                <div key={sub.id} className="flex justify-between">
                  <span className="truncate mr-2" title={sub.id}>
                    {sub.table}
                  </span>
                  <span className={
                    sub.healthStatus === 'healthy' ? 'text-green-500' :
                    sub.healthStatus === 'warning' ? 'text-yellow-500' : 'text-red-500'
                  }>
                    {sub.healthStatus}
                  </span>
                </div>
              ))}
              {health.subscriptions.length > 3 && (
                <div className="text-gray-500">
                  +{health.subscriptions.length - 3} more...
                </div>
              )}
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <div className="font-medium mb-1">Test Results:</div>
              {testResults.slice(-3).map((result, index) => (
                <div key={index} className="flex justify-between">
                  <span className="truncate mr-2">{result.test}:</span>
                  <span className={getTestColor(result.status)}>
                    {result.status === 'running' ? '⏳' : 
                     result.status === 'pass' ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={updateHealth}
              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
            >
              Refresh
            </button>
            <button
              onClick={runAllTests}
              className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
            >
              Test
            </button>
            {health.errorCount > 0 && (
              <button
                onClick={() => {
                  getSubscriptionManager().reconnectAll();
                  setTimeout(updateHealth, 1000);
                }}
                className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 