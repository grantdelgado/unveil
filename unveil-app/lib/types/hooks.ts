/**
 * Enhanced Hook Return Types for Unveil
 *
 * Provides strongly-typed interfaces for custom hooks with
 * consistent patterns, error handling, and loading states.
 */

import type {
  Event,
  EventGuest,
  Message,
  Media,
  EventWithHost,
  EventGuestWithUser,
  MessageWithSender,
  MediaWithUploader,
} from '@/lib/supabase/types';
import type { DomainErrorUnion } from './errors';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// Base hook result pattern
export interface BaseHookResult<TData = Record<string, never>, TError = DomainErrorUnion> {
  loading: boolean;
  error: TError | null;
  refetch: () => Promise<void>;
  data?: TData;
}

// Enhanced loading states
export interface LoadingState {
  initial: boolean; // First load
  refetching: boolean; // Subsequent refetches
  mutating: boolean; // During mutations
}

export interface EnhancedHookResult<
  TData = Record<string, never>,
  TError = DomainErrorUnion,
> {
  loading: LoadingState;
  error: TError | null;
  refetch: () => Promise<void>;
  data?: TData;
  lastUpdated?: Date;
}

// Authentication Hook Types
export interface AuthHookResult
  extends BaseHookResult<{
    user: SupabaseUser | null;
    session: Session | null;
  }> {
  user: SupabaseUser | null;
  session: Session | null;
  signOut: () => Promise<{ error: DomainErrorUnion | null }>;
  refetchUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Event Hook Types
export interface EventDetailsHookResult
  extends BaseHookResult<{
    event: EventWithHost | null;
    guestInfo: EventGuestWithUser | null;
  }> {
  event: EventWithHost | null;
  guestInfo: EventGuestWithUser | null;
  updateRSVP: (status: string) => Promise<MutationResult>;
  isHost: boolean;
  isGuest: boolean;
  canEdit: boolean;
}

export interface EventListHookResult extends BaseHookResult<Event[]> {
  events: Event[];
  hostedEvents: Event[];
  guestEvents: Event[];
  createEvent: (eventData: Partial<Event>) => Promise<MutationResult<Event>>;
  deleteEvent: (eventId: string) => Promise<MutationResult>;
}

// Guest Hook Types
export interface GuestHookResult
  extends BaseHookResult<EventGuestWithUser[]> {
  guests: EventGuestWithUser[];
  hosts: EventGuestWithUser[];
  regularGuests: EventGuestWithUser[];
  totalCount: number;
  inviteGuest: (
    eventId: string,
    phone: string,
    role?: string,
  ) => Promise<MutationResult<EventGuest>>;
  updateGuest: (
    guestId: string,
    updates: Partial<EventGuest>,
  ) => Promise<MutationResult>;
  removeGuest: (guestId: string) => Promise<MutationResult>;
}

// Guest hook types complete

// Media Hook Types
export interface MediaHookResult extends BaseHookResult<MediaWithUploader[]> {
  media: MediaWithUploader[];
  images: MediaWithUploader[];
  videos: MediaWithUploader[];
  totalCount: number;
  uploadMedia: (mediaData: {
    event_id: string;
    storage_path: string;
    media_type: 'image' | 'video';
    uploader_user_id: string;
    caption?: string;
  }) => Promise<MutationResult<Media>>;
  deleteMedia: (mediaId: string) => Promise<MutationResult>;
  updateCaption: (mediaId: string, caption: string) => Promise<MutationResult>;
}

// Messaging Hook Types
export interface MessagingHookResult
  extends BaseHookResult<MessageWithSender[]> {
  messages: MessageWithSender[];
  unreadCount: number;
  lastMessage: MessageWithSender | null;
  sendMessage: (messageData: {
    event_id: string;
    sender_user_id: string;
    content: string;
    message_type?: 'direct' | 'announcement' | 'channel';
  }) => Promise<MutationResult<Message>>;
  markAsRead: (messageId: string) => Promise<MutationResult>;
  deleteMessage: (messageId: string) => Promise<MutationResult>;
}

// Navigation Hook Types
export interface NavigationHookResult {
  currentEventId: string | null;
  currentUserRole: 'host' | 'guest' | null;
  isValidEventId: boolean;
  navigateToEvent: (eventId: string, role?: 'host' | 'guest') => void;
  navigateToEventList: () => void;
  navigateToProfile: () => void;
  canAccessEvent: boolean;
}

// Form Hook Types
export interface FormHookResult<TFormData = Record<string, unknown>> {
  data: TFormData;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  setValue: (field: keyof TFormData, value: unknown) => void;
  setError: (field: keyof TFormData, error: string) => void;
  clearError: (field: keyof TFormData) => void;
  clearAllErrors: () => void;
  reset: (newData?: Partial<TFormData>) => void;
  submit: () => Promise<MutationResult>;
  validate: () => boolean;
  validateField: (field: keyof TFormData) => boolean;
}

// Real-time Hook Types
export interface RealtimeHookResult<TData = Record<string, never>>
  extends BaseHookResult<TData[]> {
  data: TData[];
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  subscribe: () => void;
  unsubscribe: () => void;
  lastUpdate: Date | null;
  updateCount: number;
}

// Mutation result type for consistent mutation responses
export interface MutationResult<TData = Record<string, never>> {
  success: boolean;
  data?: TData;
  error?: DomainErrorUnion | null;
  validationErrors?: Record<string, string[]>;
}

// Async operation states
export interface AsyncOperationState {
  idle: boolean;
  pending: boolean;
  success: boolean;
  error: boolean;
}

// Pagination types for hooks that support it
export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedHookResult<TData = Record<string, never>>
  extends BaseHookResult<TData[]> {
  data: TData[];
  pagination: PaginationState;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
}

// Filter and search types
export interface FilterState<TFilters = Record<string, string | number | boolean>> {
  filters: TFilters;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface FilterableHookResult<
  TData = Record<string, never>,
  TFilters = Record<string, string | number | boolean>,
> extends BaseHookResult<TData[]> {
  data: TData[];
  filteredData: TData[];
  filterState: FilterState<TFilters>;
  setFilter: (key: keyof TFilters, value: TFilters[keyof TFilters]) => void;
  clearFilter: (key: keyof TFilters) => void;
  clearAllFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSorting: (field: string, order: 'asc' | 'desc') => void;
}

// Cache management types
export interface CacheState<TData = Record<string, never>> {
  data: TData | null;
  timestamp: Date | null;
  isStale: boolean;
  ttl: number; // Time to live in milliseconds
}

export interface CachedHookResult<TData = Record<string, never>>
  extends BaseHookResult<TData> {
  cache: CacheState<TData>;
  invalidateCache: () => void;
  refreshCache: () => Promise<void>;
  isCacheHit: boolean;
}

// File upload types
export interface FileUploadState {
  files: File[];
  uploading: boolean;
  progress: number;
  completed: number;
  failed: number;
  errors: string[];
}

export interface FileUploadHookResult {
  uploadState: FileUploadState;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  startUpload: () => Promise<MutationResult<string[]>>;
  cancelUpload: () => void;
  retryFailed: () => Promise<void>;
}

// Optimistic update types
export interface OptimisticUpdateState<TData = Record<string, never>> {
  optimisticData: TData[];
  pendingUpdates: Map<string, TData>;
  rollbackQueue: Array<() => void>;
}

export interface OptimisticHookResult<TData = Record<string, never>>
  extends BaseHookResult<TData[]> {
  data: TData[];
  optimisticState: OptimisticUpdateState<TData>;
  addOptimistic: (tempId: string, data: TData) => void;
  confirmOptimistic: (tempId: string, realData: TData) => void;
  rollbackOptimistic: (tempId: string) => void;
  rollbackAll: () => void;
}

// Subscription management for real-time features
export interface SubscriptionState {
  subscriptions: Map<string, { channel: string; callback: (data: Record<string, never>) => void }>;
  activeChannels: string[];
  connectionErrors: DomainErrorUnion[];
  reconnectAttempts: number;
  lastReconnect: Date | null;
}

export interface SubscriptionHookResult {
  subscriptionState: SubscriptionState;
  subscribe: (channel: string, callback: (data: Record<string, never>) => void) => string;
  unsubscribe: (subscriptionId: string) => void;
  unsubscribeAll: () => void;
  reconnect: () => Promise<void>;
  getChannelStatus: (channel: string) => 'connected' | 'disconnected' | 'error';
}

// Type helpers for hook creators
export type HookFactory<TParams, TResult> = (params: TParams) => TResult;

export type AsyncHookFactory<TParams, TResult> = (
  params: TParams,
) => Promise<TResult>;

// Generic hook result creator
export function createHookResult<TData = Record<string, never>>(
  data: TData,
  loading = false,
  error: DomainErrorUnion | null = null,
): BaseHookResult<TData> {
  return {
    data,
    loading,
    error,
    refetch: async () => {
      // Implementation provided by specific hook
    },
  };
}

// Mutation result creator
export function createMutationResult<TData = Record<string, never>>(
  success: boolean,
  data?: TData,
  error?: DomainErrorUnion | null,
  validationErrors?: Record<string, string[]>,
): MutationResult<TData> {
  return {
    success,
    data,
    error,
    validationErrors,
  };
}
