import type { Database } from '@/app/reference/supabase.types';

// Core messaging types - using AnalyticsData as the unified type

export type TopPerformingMessage = {
  id: string;
  messageId: string;
  content: string;
  responseRate: number;
  readRate: number;
  deliveryRate: number;
  engagementRate: number;
  engagementScore: number;
  totalDeliveries: number;
  totalResponses: number;
  sentAt: string;
};

export type DeliveryStats = {
  delivered: number;
  failed: number;
  pending: number;
  total: number;
  // Extended properties used in components
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalResponses: number;
  totalFailed: number;
  deliveryRate: number;
  readRate: number;
  readRatio: number;
  responseRate: number;
  failureRate: number;
};

export type ResponseRateOverTime = {
  date: string;
  timeRange: string; // For component compatibility
  responseRate: number;
  messageCount: number;
};

// Unified analytics type - consolidating MessageAnalytics and AnalyticsData
export type AnalyticsData = {
  totalMessages: number;
  totalResponses: number;
  responseRate: number;
  topPerformingMessages: TopPerformingMessage[];
  deliveryStats: DeliveryStats;
  responseRateOverTime: ResponseRateOverTime[];
  engagementMetrics: {
    averageEngagement: number;
    topEngagementRate: number;
    engagementTrend: 'up' | 'down' | 'stable';
    averageTimeToRead: number;
  }[];
};

// Backward compatibility alias
export type MessageAnalytics = AnalyticsData;

// Message request types
export type SendMessageRequest = {
  eventId: string;
  content: string;
  recipientFilter: RecipientFilter;
  messageType: 'direct' | 'announcement' | 'channel';
  sendVia: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
};

export type CreateScheduledMessageData = {
  eventId: string;
  content: string;
  sendAt: string;
  recipientFilter: RecipientFilter;
  messageType: 'direct' | 'announcement' | 'channel';
  sendViaSms: boolean;
  sendViaEmail: boolean;
  sendViaPush: boolean;
  subject?: string;
};

// Filter types - unified across all components  
export type RecipientFilter = {
  type: 'all' | 'tags' | 'rsvp_status' | 'individual';
  tags?: string[];
  rsvpStatuses?: string[];
  guestIds?: string[];
  [key: string]: unknown; // Allow additional properties for flexibility
};

export type AdvancedRecipientFilter = {
  includeUnresponded?: boolean;
  excludeOptedOut?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
};

export type ScheduledMessageFilters = {
  eventId: string;
  status?: 'pending' | 'sent' | 'failed';
  dateRange?: {
    start: string;
    end: string;
  };
  messageType?: 'direct' | 'announcement' | 'channel';
};

// Template types - allow both object and string for backward compatibility
export type MessageTemplate = {
  id: string;
  name: string;
  content: string;
  category: 'greeting' | 'reminder' | 'update' | 'thank_you';
  variables: string[];
} | string; // Allow string templates for simplified usage

// Enhanced types with joined data
export type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: Database['public']['Tables']['users']['Row'] | null;
};

export type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

// Tag management types
export type TagWithUsage = {
  tag: string;
  guestCount: number;
  guests: Guest[];
}; 