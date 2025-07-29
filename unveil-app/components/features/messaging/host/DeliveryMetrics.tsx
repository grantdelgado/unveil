'use client';

import React from 'react';
import { CardContainer } from '@/components/ui';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MessageCircle, 
  Smartphone, 
  Star,
  Eye,
  ArrowRight,
  Zap
} from 'lucide-react';
// Note: Analytics data now comes from useMessages hook

export interface DeliveryMetricsProps {
  analytics: MessageAnalytics | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  color?: 'blue' | 'green' | 'purple' | 'rose' | 'amber';
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  color = 'purple' 
}: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend.isPositive 
              ? 'text-green-700 bg-green-100' 
              : 'text-red-700 bg-red-100'
          }`}>
            {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend.value)}% {trend.period}
          </div>
        )}
      </div>
      
      <div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-sm font-medium text-gray-600 mb-1">{title}</div>
        {subtitle && (
          <div className="text-xs text-gray-500">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

interface TopMessageCardProps {
  message: TopPerformingMessage;
  rank: number;
}

function TopMessageCard({ message, rank }: TopMessageCardProps) {
  const formatScore = (score: number) => {
    return (score * 100).toFixed(1);
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-gray-100 text-gray-800 border-gray-200';
      case 3: return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold ${getRankBadgeColor(rank)}`}>
          {rank}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 mb-1 overflow-hidden">
            <div className="max-h-10 leading-5 overflow-hidden">
              {message.content.length > 60 
                ? `${message.content.substring(0, 60)}...` 
                : message.content
              }
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {(message.readRate * 100).toFixed(1)}% read
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {(message.responseRate * 100).toFixed(1)}% replied
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-purple-600 font-medium">
              <Star className="w-3 h-3" />
              {formatScore(message.engagementScore)}% engagement
            </div>
            <div className="text-xs text-gray-500">
              {new Date(message.sentAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeliveryMetrics({ 
  analytics, 
  loading = false, 
  error = null,
  className = '' 
}: DeliveryMetricsProps) {
  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 p-4 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-3"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-800">
          <Zap className="w-5 h-5" />
          <span className="font-medium">Failed to load metrics</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p className="text-gray-600">Send your first message to see delivery metrics and analytics.</p>
      </div>
    );
  }

  const { 
    deliveryStats, 
    engagementMetrics, 
    topPerformingMessages = [] 
  } = analytics;

  // Calculate read ratio (read messages / delivered messages) - use readRatio from DeliveryStats
  const readRatio = deliveryStats.readRatio / 100; // Convert from percentage to ratio

  // Calculate overall success rate
  const totalAttempted = deliveryStats.totalSent;
  const totalSuccess = deliveryStats.totalDelivered;
  const overallSuccessRate = totalAttempted > 0 ? (totalSuccess / totalAttempted) : 0;

  // Get first engagement metrics (since it's an array)
  const firstEngagement = engagementMetrics.length > 0 ? engagementMetrics[0] : null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Messages Read"
          value={`${(readRatio * 100).toFixed(1)}%`}
          subtitle={`${deliveryStats.totalRead} of ${deliveryStats.totalDelivered} delivered`}
          icon={<Eye className="w-5 h-5" />}
          color="blue"
        />
        
        <MetricCard
          title="Avg. Time to Read"
          value={firstEngagement?.averageTimeToRead ? `${firstEngagement.averageTimeToRead.toFixed(1)}m` : 'N/A'}
          subtitle="Average response time"
          icon={<Clock className="w-5 h-5" />}
          color="green"
        />
        
        <MetricCard
          title="Response Rate"
          value={`${deliveryStats.responseRate.toFixed(1)}%`}
          subtitle={`${deliveryStats.totalResponses} responses`}
          icon={<MessageCircle className="w-5 h-5" />}
          color="purple"
        />
        
        <MetricCard
          title="Delivery Success"
          value={`${(overallSuccessRate * 100).toFixed(1)}%`}
          subtitle={`${deliveryStats.totalDelivered} of ${deliveryStats.totalSent} sent`}
          icon={<Zap className="w-5 h-5" />}
          color="rose"
        />
      </div>

      {/* Channel Performance */}
      <CardContainer>
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Channel Performance</h3>
          <p className="text-sm text-gray-600">Success rates by delivery method</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Push Notifications</div>
                <div className="text-sm text-gray-600">Primary delivery method</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">
                {deliveryStats.deliveryRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                {deliveryStats.totalDelivered} delivered
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">SMS Messages</div>
                <div className="text-sm text-gray-600">Backup delivery method</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-green-600">
                {deliveryStats.deliveryRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                {deliveryStats.totalDelivered} delivered
              </div>
            </div>
          </div>
        </div>
      </CardContainer>

      {/* Top Performing Messages */}
      {topPerformingMessages.length > 0 && (
        <CardContainer>
          <div className="border-b border-gray-200 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Top Performing Messages</h3>
                <p className="text-sm text-gray-600">Messages with highest engagement rates</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-purple-600">
                <Star className="w-4 h-4" />
                <span>Engagement Score</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {topPerformingMessages.slice(0, 3).map((message, index) => (
              <TopMessageCard 
                key={message.messageId} 
                message={message} 
                rank={index + 1}
              />
            ))}
          </div>
          
          {topPerformingMessages.length > 3 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
                View All {topPerformingMessages.length} Messages
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </CardContainer>
      )}
    </div>
  );
}

export default DeliveryMetrics; 