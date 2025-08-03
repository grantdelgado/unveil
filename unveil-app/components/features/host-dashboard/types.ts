/**
 * Simplified types for Guest Management (MVP)
 * Consolidated from guest-management module for Phase 3 simplification
 */

import type { Database } from '@/app/reference/supabase.types';
import type { RSVPStatus } from '@/lib/types/rsvp';

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
  rsvp_status: RSVPStatus | null;
  notes: string | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

// Simplified status counts (reduced from complex original)
export interface GuestStatusCounts {
  total: number;
  attending: number;
  pending: number;
  // Removed: maybe, declined, confirmed, responded (MVP simplification)
}

// Simplified loading states (reduced from 7 to 3 states)
export interface LoadingStates {
  guests: boolean;
  rsvpUpdate: boolean;
  bulkAction: boolean;
  // Removed: import, export (defer to post-MVP)
}

// Component props interfaces
export interface GuestManagementProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: 'reminder') => void;
}