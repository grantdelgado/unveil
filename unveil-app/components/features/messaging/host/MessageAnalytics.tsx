'use client';

import React, { useState, useEffect } from 'react';
import { CardContainer, SectionTitle, MicroCopy, LoadingSpinner } from '@/components/ui';
import { 
  getEventAnalytics, 
  getDeliveryStatsForEvent,
  getResponseRatesOverTime,
  type MessageAnalytics as AnalyticsData,
  type DeliveryStats,
  type ResponseRateOverTime
} from '@/services/messaging/analytics';

interface MessageAnalyticsProps {
  eventId: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

function MetricCard({ title, value, subtitle, trend, className = '' }: MetricCardProps) {
  const trendIcon = {
    up: '↗️',
    down: '↘️',
    neutral: '→',
  }[trend || 'neutral'];

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 ${className}`}>
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-2xl font-semibold text-gray-900 mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          {trend && <span>{trendIcon}</span>}
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function MessageAnalytics({ eventId }: MessageAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(null);
  const [responseRatesTrend, setResponseRatesTrend] = useState<ResponseRateOverTime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setIsLoading(true);
        setError(null);

        // Load comprehensive analytics
        const [analytics, stats, trends] = await Promise.all([
          getEventAnalytics(eventId),
          getDeliveryStatsForEvent(eventId),
          getResponseRatesOverTime(eventId, 'day', 7) // Last 7 days
        ]);

        setAnalyticsData(analytics);
        setDeliveryStats(stats);
        setResponseRatesTrend(trends);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    if (eventId) {
      loadAnalytics();
    }
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardContainer>
          <div className="text-center py-12">
            <LoadingSpinner />
            <MicroCopy className="mt-4">Loading analytics...</MicroCopy>
          </div>
        </CardContainer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <CardContainer>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <SectionTitle>Unable to Load Analytics</SectionTitle>
            <MicroCopy className="mt-2 text-red-600">{error}</MicroCopy>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContainer>
      </div>
    );
  }

  if (!deliveryStats || !analyticsData) {
    return (
      <div className="space-y-6">
        <CardContainer>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <SectionTitle>No Data Available</SectionTitle>
            <MicroCopy className="mt-2">
              Send some messages to see analytics data here
            </MicroCopy>
          </div>
        </CardContainer>
      </div>
    );
  }

  // Calculate trend for recent data
  const recentTrend = responseRatesTrend.length >= 2 
    ? responseRatesTrend[responseRatesTrend.length - 1].responseRate > responseRatesTrend[responseRatesTrend.length - 2].responseRate 
      ? 'up' : 'down'
    : 'neutral';

  return (
    <div className="space-y-6">
      {/* Overview Metrics */}
      <CardContainer>
        <div className="mb-6">
          <SectionTitle>Message Performance Overview</SectionTitle>
          <MicroCopy className="mt-2">
            Comprehensive analytics for your event messaging
          </MicroCopy>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Sent"
            value={deliveryStats.totalSent}
            subtitle={`${deliveryStats.totalSent} messages`}
          />
          <MetricCard
            title="Delivery Rate"
            value={`${deliveryStats.deliveryRate.toFixed(1)}%`}
            subtitle={`${deliveryStats.totalDelivered} delivered`}
            trend={deliveryStats.deliveryRate >= 90 ? 'up' : deliveryStats.deliveryRate >= 70 ? 'neutral' : 'down'}
          />
          <MetricCard
            title="Read Rate"
            value={`${deliveryStats.readRate.toFixed(1)}%`}
            subtitle={`${deliveryStats.totalRead} read`}
            trend={deliveryStats.readRate >= 60 ? 'up' : deliveryStats.readRate >= 40 ? 'neutral' : 'down'}
          />
          <MetricCard
            title="Response Rate"
            value={`${deliveryStats.responseRate.toFixed(1)}%`}
            subtitle={`${deliveryStats.totalResponses} responses`}
            trend={recentTrend}
          />
        </div>
      </CardContainer>

      {/* Enhanced Metrics */}
      <CardContainer>
        <div className="mb-6">
          <SectionTitle>Advanced Engagement Metrics</SectionTitle>
          <MicroCopy className="mt-2">
            Deep insights into guest engagement patterns
          </MicroCopy>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Read Ratio"
            value={`${deliveryStats.readRatio.toFixed(1)}%`}
            subtitle="Read messages vs delivered"
            className="border-purple-200"
          />
          <MetricCard
            title="Average Time to Read"
            value={analyticsData.engagementMetrics.length > 0 && analyticsData.engagementMetrics[0].averageTimeToRead 
              ? `${Math.round(analyticsData.engagementMetrics[0].averageTimeToRead)}m`
              : 'N/A'
            }
            subtitle="Time from delivery to read"
            className="border-blue-200"
          />
          <MetricCard
            title="Failure Rate"
            value={`${deliveryStats.failureRate.toFixed(1)}%`}
            subtitle={`${deliveryStats.totalFailed} failed deliveries`}
            trend={deliveryStats.failureRate <= 5 ? 'up' : deliveryStats.failureRate <= 15 ? 'neutral' : 'down'}
            className="border-red-200"
          />
        </div>
      </CardContainer>

      {/* Top Performing Messages */}
      {analyticsData.topPerformingMessages.length > 0 && (
        <CardContainer>
          <div className="mb-6">
            <SectionTitle>Top Performing Messages</SectionTitle>
            <MicroCopy className="mt-2">
              Messages with highest engagement rates
            </MicroCopy>
          </div>

          <div className="space-y-3">
            {analyticsData.topPerformingMessages.slice(0, 3).map((message, index) => (
              <div key={message.messageId} className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      #{index + 1} - {message.content}
                    </div>
                    <div className="text-xs text-gray-600">
                      Engagement: {message.engagementRate.toFixed(1)}% | 
                      Delivery: {message.deliveryRate.toFixed(1)}% | 
                      Read: {message.readRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-purple-600">
                      {message.engagementRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">engagement</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContainer>
      )}

      {/* Response Rate Trend */}
      {responseRatesTrend.length > 0 && (
        <CardContainer>
          <div className="mb-6">
            <SectionTitle>Response Rate Trend (Last 7 Days)</SectionTitle>
            <MicroCopy className="mt-2">
              Daily response rates showing engagement trends
            </MicroCopy>
          </div>

          <div className="space-y-2">
            {responseRatesTrend.slice(-7).map((trend) => (
              <div key={trend.timeRange} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(trend.timeRange).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    {trend.totalSent} sent, {trend.totalDelivered} delivered, {trend.totalResponses} responses
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {trend.responseRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">response rate</div>
                </div>
              </div>
            ))}
          </div>
        </CardContainer>
      )}

      {/* Development Note */}
      <CardContainer>
        <div className="text-center py-6">
          <MicroCopy className="text-gray-500">
            ✨ Enhanced analytics with read tracking, time-to-read metrics, and processing performance monitoring now available
          </MicroCopy>
        </div>
      </CardContainer>
    </div>
  );
} 