/**
 * Core Messaging Types
 * 
 * Central type definitions for the consolidated messaging hooks system.
 * These types ensure consistency across all messaging operations.
 */

import type { Database } from '@/app/reference/supabase.types';
import type { qk } from '@/lib/queryKeys';

// Base database types
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];
export type ScheduledMessageInsert = Database['public']['Tables']['scheduled_messages']['Insert'];
export type MessageDelivery = Database['public']['Tables']['message_deliveries']['Row'];

// Enhanced types with relations
export interface MessageWithSender extends Message {
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface MessageDeliveryWithMessage extends MessageDelivery {
  message?: MessageWithSender | null;
}

// Guest message type (from read-model V2)
export interface GuestMessage {
  message_id: string;
  content: string;
  created_at: string;
  delivery_status: string;
  sender_name: string;
  sender_avatar_url: string | null;
  message_type: string;
  is_own_message: boolean;
  source?: 'delivery' | 'message';
  is_catchup?: boolean;
  channel_tags?: string[] | null;
}

// Pagination options
export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

// Message type filtering
export type MessageTypeFilter = 'announcement' | 'channel' | 'direct' | undefined;

// Delivery status filtering  
export type DeliveryStatusFilter = 'pending' | 'delivered' | 'failed' | undefined;

// List options for messages
export interface MessageListOptions extends PaginationOptions {
  type?: MessageTypeFilter;
  includeArchived?: boolean;
}

// List options for deliveries
export interface DeliveryListOptions extends PaginationOptions {
  status?: DeliveryStatusFilter;
  page?: number;
  pageSize?: number;
}

// List options for scheduled messages
export interface ScheduledMessageListOptions extends PaginationOptions {
  status?: 'pending' | 'sent' | 'failed';
}

// Realtime options
export interface RealtimeOptions {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  debounceMs?: number;
  enabled?: boolean;
}

// Recipient filter types (matching existing contracts)
export interface RecipientFilter {
  type: 'all' | 'rsvp_status' | 'tags' | 'individual' | 'explicit_selection';
  rsvpStatuses?: string[];
  tags?: string[];
  requireAllTags?: boolean;
  guestIds?: string[];
  selectedGuestIds?: string[];
  includeDeclined?: boolean;
  [key: string]: unknown; // Allow additional properties for flexibility
}

// Send via options
export interface SendViaOptions {
  sms: boolean;
  email: boolean;
  push: boolean;
}

// Message sending request
export interface SendMessageRequest {
  eventId: string;
  content: string;
  messageType: 'direct' | 'announcement' | 'channel';
  recipientFilter: RecipientFilter;
  recipientEventGuestIds?: string[];
  sendVia: SendViaOptions;
  scheduledAt?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
  nextCursor?: string;
  totalCount?: number;
}

// Hook return types
export interface UseEventMessagesListReturn {
  data: MessageWithSender[];
  pages: MessageWithSender[][];
  hasNextPage: boolean;
  isFetching: boolean;
  isLoading: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export interface UseMessageByIdReturn {
  data: MessageWithSender | null;
  isLoading: boolean;
  error: Error | null;
  invalidate: () => Promise<void>;
}

export interface UseDeliveriesByMessageReturn {
  data: MessageDeliveryWithMessage[];
  hasNextPage: boolean;
  isFetching: boolean;
  isLoading: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<void>;
  stats: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  } | null;
  invalidate: () => Promise<void>;
}

export interface UseMessageMutationsReturn {
  sendAnnouncement: (request: Omit<SendMessageRequest, 'messageType'>) => Promise<Message>;
  sendChannel: (request: Omit<SendMessageRequest, 'messageType'>) => Promise<Message>;
  sendDirect: (request: Omit<SendMessageRequest, 'messageType'>) => Promise<Message>;
  scheduleMessage: (data: ScheduledMessageInsert) => Promise<ScheduledMessage>;
  cancelScheduled: (id: string) => Promise<void>;
  deleteMessage: (eventId: string, messageId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export interface UseMessageRealtimeReturn {
  isConnected: boolean;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

// Query key type helpers (for proper typing with qk.* factories)
export type MessageListKey = ReturnType<typeof qk.messages.list>;
export type MessageByIdKey = ReturnType<typeof qk.messages.byId>;
export type MessageDeliveriesKey = ReturnType<typeof qk.messageDeliveries.byMessage>;
export type ScheduledMessagesKey = ReturnType<typeof qk.scheduledMessages.list>;

// Development observability
export interface DevObservabilityEvent {
  hook: string;
  operation: 'fetch' | 'mutation' | 'realtime' | 'invalidation';
  eventId?: string;
  messageId?: string;
  timing?: {
    startTime: number;
    endTime: number;
    duration: string;
  };
  counts?: {
    initial?: number;
    refetches?: number;
    pages?: number;
    realtime?: number;
  };
  metadata?: Record<string, unknown>;
}
