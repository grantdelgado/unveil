'use client';

import { useParams } from 'next/navigation';
import {
  PageWrapper,
  CardContainer,
  BackButton,
  DevModeBox,
  EmptyState,
} from '@/components/ui';
import { BarChart3, TrendingUp, Users, MessageCircle } from 'lucide-react';

export default function MessageAnalyticsPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  // Placeholder stats for Phase 1
  const stats = [
    {
      title: 'Total Messages Sent',
      value: '0',
      icon: <MessageCircle className="w-5 h-5" />,
      change: null,
    },
    {
      title: 'Delivery Rate',
      value: '-%',
      icon: <TrendingUp className="w-5 h-5" />,
      change: null,
    },
    {
      title: 'Response Rate',
      value: '-%',
      icon: <Users className="w-5 h-5" />,
      change: null,
    },
    {
      title: 'Engagement Score',
      value: '-%',
      icon: <BarChart3 className="w-5 h-5" />,
      change: null,
    },
  ];

  return (
    <PageWrapper>
      <div className="max-w-6xl mx-auto space-y-6">
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
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.title} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-gray-600">
                    {stat.icon}
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Analytics Content - Placeholder */}
          <EmptyState
            variant="messages"
            title="Analytics Coming Soon"
            description="Message analytics and delivery tracking will be available once you start sending messages to your guests."
            actionText="Send First Message"
            onAction={() => window.location.href = `/host/events/${eventId}/messages/compose`}
          />
        </CardContainer>

        {/* Development Mode Info */}
        <DevModeBox>
          <p><strong>Message Analytics:</strong> Event ID: {eventId}</p>
          <p><strong>Phase 1:</strong> Basic page scaffold complete</p>
          <p><strong>Phase 4:</strong> Will implement MessageAnalytics component with charts and metrics</p>
        </DevModeBox>
      </div>
    </PageWrapper>
  );
} 