/**
 * Shared types for Guest Management components
 */

import type { Database } from '@/app/reference/supabase.types';
import type { RSVPStatus } from '@/lib/types/rsvp';

// Base guest type from database
export type GuestRow = Database['public']['Tables']['event_guests']['Row'];
export type GuestInsert = Database['public']['Tables']['event_guests']['Insert'];
export type GuestUpdate = Database['public']['Tables']['event_guests']['Update'];

// User type from database  
export type UserRow = Database['public']['Tables']['users']['Row'];

// Enhanced guest type with user information
export interface GuestWithUser extends GuestRow {
  users: UserRow | null;
  rsvp_status: RSVPStatus | null;
}

// Optimized guest type for list rendering
export interface OptimizedGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string;
  rsvp_status: RSVPStatus | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

// Guest list item props
export interface GuestListItemProps {
  guest: OptimizedGuest;
  isSelected: boolean;
  onToggleSelect: (guestId: string, selected: boolean) => void;
  onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => void;
  onRemove: (guestId: string) => void;
}

// Filter state
export interface GuestFilters {
  searchTerm: string;
  rsvpStatus: RSVPStatus | 'all';
  tags: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  requireAllTags?: boolean;
}

// Status counts
export interface GuestStatusCounts {
  total: number;
  attending: number;
  maybe: number;
  declined: number;
  pending: number;
  confirmed: number;
  responded: number;
}

// Bulk action types
export type BulkActionType = 'rsvp' | 'remove' | 'tag' | 'message';

export interface BulkAction {
  id: string;
  type: BulkActionType;
  label: string;
  icon: string;
  description: string;
  requiresConfirmation: boolean;
  action: (guestIds: string[], payload?: unknown) => Promise<void>;
}

// Performance and pagination
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Error types
export interface GuestManagementError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// Loading states
export interface LoadingStates {
  guests: boolean;
  rsvpUpdate: boolean;
  bulkAction: boolean;
  import: boolean;
  export: boolean;
}

// Component props interfaces
export interface GuestManagementContainerProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: string) => void;
}

export interface GuestFiltersProps {
  filters: GuestFilters;
  onFiltersChange: (filters: Partial<GuestFilters>) => void;
  statusCounts: GuestStatusCounts;
  availableTags: string[];
}

export interface GuestActionsProps {
  eventId: string;
  selectedGuests: Set<string>;
  onImportGuests: () => void;
  onBulkAction: (action: BulkActionType, payload?: unknown) => Promise<void>;
  loading: LoadingStates;
}

export interface GuestListProps {
  guests: OptimizedGuest[];
  selectedGuests: Set<string>;
  onToggleSelect: (guestId: string, selected: boolean) => void;
  onRSVPUpdate: (guestId: string, newStatus: RSVPStatus) => Promise<void>;
  onRemove: (guestId: string) => Promise<void>;
  loading: boolean;
  pagination: PaginationInfo;
  onLoadMore: () => void;
}

export interface BulkSelectionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkAction: (action: BulkActionType, payload?: unknown) => Promise<void>;
  loading: boolean;
}

// Hook return types
export interface UseGuestManagementReturn {
  // Data
  guests: OptimizedGuest[];
  filteredGuests: OptimizedGuest[];
  statusCounts: GuestStatusCounts;
  pagination: PaginationInfo;
  
  // Filters
  filters: GuestFilters;
  setFilters: (filters: Partial<GuestFilters>) => void;
  
  // Selection
  selectedGuests: Set<string>;
  toggleGuestSelection: (guestId: string, selected: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Actions
  updateRSVP: (guestId: string, status: RSVPStatus) => Promise<void>;
  removeGuest: (guestId: string) => Promise<void>;
  bulkUpdateRSVP: (guestIds: string[], status: RSVPStatus) => Promise<void>;
  bulkRemoveGuests: (guestIds: string[]) => Promise<void>;
  
  // State
  loading: LoadingStates;
  error: GuestManagementError | null;
  
  // Methods
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}