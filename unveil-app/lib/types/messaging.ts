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

// Removed duplicate - using MessageAnalytics definition below

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
  type: 'all' | 'tags' | 'rsvp_status' | 'individual' | 'combined';
  tags?: string[];
  rsvpStatuses?: string[];
  guestIds?: string[];
  requireAllTags?: boolean; // For AND/OR logic when using tags
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

// Template types for Phase 5
export type MessageTemplate = {
  id: string;
  event_id: string;
  created_by_user_id: string;
  title: string;
  content: string;
  message_type: 'announcement' | 'reminder' | 'thank_you' | 'direct';
  category: 'greeting' | 'reminder' | 'update' | 'thank_you' | 'custom';
  variables: string[];
  usage_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateMessageTemplateData = {
  eventId: string;
  title: string;
  content: string;
  messageType: 'announcement' | 'reminder' | 'thank_you' | 'direct';
  category: 'greeting' | 'reminder' | 'update' | 'thank_you' | 'custom';
  variables?: string[];
};

export type MessageAnalytics = {
  messageId: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  successRate: number;
  deliveryMethods: {
    push: { sent: number; delivered: number; failed: number };
    sms: { sent: number; delivered: number; failed: number };
    email: { sent: number; delivered: number; failed: number };
  };
  recipientBreakdown: {
    byRsvpStatus: Record<string, number>;
    byTags: Record<string, number>;
  };
  sentAt: string;
  deliveredAt?: string;
};

// Enhanced types with joined data
export type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: Database['public']['Tables']['users']['Row'] | null;
};

export type Guest = Database['public']['Tables']['event_guests']['Row'] & {
  users: Database['public']['Tables']['users']['Row'] | null;
};

// Guest with computed display name for UI components
export type GuestWithDisplayName = Guest & {
  displayName: string;
  hasValidPhone: boolean;
};

// Tag management types
export type TagWithUsage = {
  tag: string;
  guestCount: number;
  guests: Guest[];
};

// Enhanced filtering types for recipient preview
export type FilteredGuest = {
  id: string;
  displayName: string;
  tags: string[];
  rsvpStatus: string | null;
  hasPhone: boolean;
};

export type RecipientPreviewData = {
  guests: FilteredGuest[];
  totalCount: number;
  validRecipientsCount: number; // Guests with valid phone numbers
  tagCounts: Record<string, number>;
  rsvpStatusCounts: Record<string, number>;
};

// RSVP status constants for consistency
export const RSVP_STATUSES = {
  ATTENDING: 'attending',
  PENDING: 'pending', 
  MAYBE: 'maybe',
  DECLINED: 'declined'
} as const;

export type RsvpStatus = typeof RSVP_STATUSES[keyof typeof RSVP_STATUSES]; 