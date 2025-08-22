/**
 * Simplified types for Guest Management (MVP)
 * Consolidated from guest-management module for Phase 3 simplification
 */

import type { Database } from '@/app/reference/supabase.types';

// Base guest type from database
export type GuestRow = Database['public']['Tables']['event_guests']['Row'];

// Optimized guest type for list rendering (most important type to preserve)
export interface OptimizedGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string | null;

  notes: string | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  // RSVP-Lite fields
  declined_at: string | null;
  decline_reason: string | null;
  // New invitation tracking fields
  invited_at: string | null;
  last_invited_at: string | null;
  invite_attempts: number | null;
  joined_at: string | null; // Keep for DB compatibility but don't use in UI
  removed_at: string | null; // Soft delete support
  sms_opt_out: boolean | null;
  /**
   * Computed display name from COALESCE(users.full_name, event_guests.guest_name)
   * Prefer this over guest_name for UI display
   * @readonly
   */
  guest_display_name: string;
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

// Enhanced status counts with invitation tracking (simplified - no joined state)
export interface GuestStatusCounts {
  total: number;
  attending: number;
  declined: number;
  // New invitation status counts
  not_invited: number;
  invited: number;
}

// Simplified loading states
export interface LoadingStates {
  guests: boolean;
  bulkAction: boolean;
}

// Component props interfaces
export interface GuestManagementProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onAddIndividualGuest?: () => void;
  onSendMessage?: (messageType: 'reminder') => void;
}
