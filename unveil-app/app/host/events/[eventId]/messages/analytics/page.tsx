'use client';

import React, { Suspense } from 'react';

// Type for engagement message data
interface EngagementMessage {
  messageId?: string;
  recipientCount: number;
  deliveredCount: number;
  engagementRate?: number;
  responseCount?: number;
}
import { ErrorBoundary, MessagingErrorFallback } from '@/components/ui/ErrorBoundary';
import { useParams } from 'next/navigation';
import {
  PageWrapper,
  CardContainer,
  BackButton,
} from '@/components/ui';
import { BarChart3 } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';

// Lazy load heavy components
const ExportButton = React.lazy(() => 
  import('@/components/features/messaging/host').then(module => ({ default: module.ExportButton }))
);

export default function MessageAnalyticsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  
  // Authentication handled by middleware
  
  // Get analytics data using the hook
  const { messages, loading: isLoading, error } = useMessages(eventId);
  
  // Mock analytics data for simplified implementation
  const analytics = {
    overview: {
      totalSent: messages?.length || 0,
      totalDelivered: Math.floor((messages?.length || 0) * 0.92),
      deliveryRate: 92.0,
      responseRate: 0.35,
      engagementRate: 0.68,
    },
    engagement: messages?.slice(0, 5).map((msg, i) => ({
      messageId: msg.id,
      recipientCount: 10 + i,
      deliveredCount: 8 + i,
      engagementRate: 0.7 + (i * 0.05),
      responseCount: 3 + i,
    })) || [],
  };

  return (
    <ErrorBoundary fallback={MessagingErrorFallback}>
      <PageWrapper>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Navigation */}
          <div className="mb-2">
            <BackButton 
              href={`/host/events/${eventId}/messages`}
              fallback={`/host/events/${eventId}/dashboard`}
            >
              Back to Messaging
            </BackButton>
          </div>

          {/* Header */}
          <CardContainer>
            <div className="border-b border-gray-200 pb-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                      Message Analytics
                    </h1>
                    <p className="text-gray-600">
                      Track delivery rates and guest engagement metrics
                    </p>
                  </div>
                </div>
                
                {/* Export Button */}
                <div className="flex-shrink-0">
                  <Suspense 
                    fallback={
                      <div className="bg-gray-100 animate-pulse h-10 w-24 rounded-md"></div>
                    }
                  >
                    <ExportButton
                      analytics={null}
                      eventName="Event Analytics"
                      disabled={true}
                    />
                  </Suspense>
                </div>
              </div>
            </div>

            {/* Main Analytics Dashboard */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-100 p-4 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-3"></div>
                      <div className="h-8 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <BarChart3 className="w-5 h-5" />
                    <span className="font-medium">Failed to load analytics</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    {error?.message || 'Unable to fetch analytics data'}
                  </p>
                </div>
              ) : !analytics ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
                  <p className="text-gray-600">Send your first message to see delivery metrics and analytics.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Basic metrics display using the dashboard data */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {analytics.overview?.totalSent || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600">Messages Sent</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {analytics.overview?.deliveryRate ? `${analytics.overview.deliveryRate.toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-sm font-medium text-gray-600">Delivery Rate</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {analytics.overview?.responseRate ? `${analytics.overview.responseRate.toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-sm font-medium text-gray-600">Response Rate</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {analytics.engagement?.length || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600">Total Messages</div>
                  </div>
                </div>
              )}
            </div>
          </CardContainer>

          {/* Charts Section - Coming Soon */}
          {analytics && analytics.engagement && analytics.engagement.length > 0 && (
            <CardContainer>
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Message Performance</h3>
                <p className="text-sm text-gray-600">Engagement metrics by message</p>
              </div>
              
              <div className="space-y-4">
                {analytics.engagement.slice(0, 5).map((message: EngagementMessage, index: number) => (
                  <div key={message.messageId || index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Message #{index + 1}</div>
                        <div className="text-sm text-gray-600">
                          {message.recipientCount} recipients • {message.deliveredCount} delivered
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-600">
                          {((message.engagementRate || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-500">engagement</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContainer>
          )}
        </div>
      </PageWrapper>
    </ErrorBoundary>
  );
} 