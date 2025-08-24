'use client';

import React, { useState, useEffect } from 'react';
import { getMessagingMetrics } from '@/lib/metrics/messaging';

interface MessagingMetrics {
  recipients_skipped_removed_total: number;
  recipients_skipped_opted_out_total: number;
  recipients_included_total: number;
  formatter_fallback_total: number;
  formatter_prefetch_used_total: number;
  formatter_prefetch_missed_total: number;
  message_type_coercion_total: number;
}

/**
 * Development-only metrics dashboard for messaging system monitoring
 * Shows real-time metrics for formatter performance and message processing
 */
export function MessagingMetricsDashboard() {
  const [metrics, setMetrics] = useState<MessagingMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!isDevelopment) return;

    const updateMetrics = () => {
      setMetrics(getMessagingMetrics());
    };

    // Initial load
    updateMetrics();

    // Update every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [isDevelopment]);

  if (!isDevelopment || !isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
        >
          📊 Metrics
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const prefetchSuccessRate = 
    metrics.formatter_prefetch_used_total + metrics.formatter_prefetch_missed_total > 0
      ? (metrics.formatter_prefetch_used_total / 
         (metrics.formatter_prefetch_used_total + metrics.formatter_prefetch_missed_total) * 100).toFixed(1)
      : '0';

  const fallbackRate = 
    metrics.formatter_fallback_total > 0 
      ? ((metrics.formatter_fallback_total / 
          (metrics.formatter_prefetch_used_total + metrics.formatter_prefetch_missed_total + metrics.formatter_fallback_total)) * 100).toFixed(2)
      : '0';

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">📊 Messaging Metrics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        {/* Formatter Health */}
        <div className="border-b pb-2">
          <div className="font-medium text-gray-700">Formatter Health</div>
          <div className="flex justify-between">
            <span>Fallback Rate:</span>
            <span className={`font-mono ${parseFloat(fallbackRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {fallbackRate}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Prefetch Success:</span>
            <span className={`font-mono ${parseFloat(prefetchSuccessRate) > 80 ? 'text-green-600' : 'text-yellow-600'}`}>
              {prefetchSuccessRate}%
            </span>
          </div>
        </div>

        {/* Raw Counts */}
        <div className="border-b pb-2">
          <div className="font-medium text-gray-700">Formatter Counts</div>
          <div className="flex justify-between">
            <span>Prefetch Used:</span>
            <span className="font-mono text-green-600">{metrics.formatter_prefetch_used_total}</span>
          </div>
          <div className="flex justify-between">
            <span>Prefetch Missed:</span>
            <span className="font-mono text-yellow-600">{metrics.formatter_prefetch_missed_total}</span>
          </div>
          <div className="flex justify-between">
            <span>Fallbacks:</span>
            <span className="font-mono text-red-600">{metrics.formatter_fallback_total}</span>
          </div>
        </div>

        {/* Message Processing */}
        <div className="border-b pb-2">
          <div className="font-medium text-gray-700">Message Processing</div>
          <div className="flex justify-between">
            <span>Type Coercions:</span>
            <span className="font-mono text-blue-600">{metrics.message_type_coercion_total}</span>
          </div>
          <div className="flex justify-between">
            <span>Recipients Included:</span>
            <span className="font-mono text-green-600">{metrics.recipients_included_total}</span>
          </div>
        </div>

        {/* Recipient Filtering */}
        <div>
          <div className="font-medium text-gray-700">Recipient Filtering</div>
          <div className="flex justify-between">
            <span>Skipped (Removed):</span>
            <span className="font-mono text-gray-600">{metrics.recipients_skipped_removed_total}</span>
          </div>
          <div className="flex justify-between">
            <span>Skipped (Opted Out):</span>
            <span className="font-mono text-gray-600">{metrics.recipients_skipped_opted_out_total}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t text-xs text-gray-500">
        Updates every 5s • Dev only
      </div>
    </div>
  );
}
