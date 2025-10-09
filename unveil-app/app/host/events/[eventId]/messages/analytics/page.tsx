'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';

/**
 * Message Analytics Page - Coming Soon
 * Analytics functionality temporarily disabled for simplification
 */
export default function MessageAnalyticsPage() {
  const params = useParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const eventId = params?.eventId as string;

  return (
    <div className="min-h-100dvh bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Message Analytics
          </h1>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Comprehensive messaging analytics and insights are coming soon!
            We&apos;re working on bringing you detailed performance metrics,
            delivery statistics, and engagement insights.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">📈</div>
              <div className="font-semibold text-gray-900">
                Performance Metrics
              </div>
              <div className="text-sm text-gray-600">
                Delivery rates, success metrics
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold text-gray-900">
                Audience Insights
              </div>
              <div className="text-sm text-gray-600">
                Engagement patterns, demographics
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">📅</div>
              <div className="font-semibold text-gray-900">Time Analytics</div>
              <div className="text-sm text-gray-600">
                Optimal timing, trends
              </div>
            </div>
          </div>

          <Button onClick={() => window.history.back()} variant="outline">
            ← Back to Messages
          </Button>
        </div>

        {/* Current Status */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="text-2xl mr-4">ℹ️</div>
            <div>
              <div className="font-semibold text-blue-900 mb-2">
                Current Status
              </div>
              <div className="text-blue-800 text-sm">
                Your messaging functionality is fully operational! You can send
                messages, schedule campaigns, and manage recipients. Analytics
                features will be added in a future update.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
