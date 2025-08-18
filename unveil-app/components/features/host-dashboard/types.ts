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
  phone: string;

  notes: string | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  // RSVP-Lite fields
  declined_at: string | null;
  decline_reason: string | null;
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

// RSVP-Lite status counts
export interface GuestStatusCounts {
  total: number;
  attending: number;
  declined: number;
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