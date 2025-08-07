// import type { Database } from '@/app/reference/supabase.types';

// Type for event guests with user information
export interface GuestWithUser {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string;
  rsvp_status: 'attending' | 'declined' | 'maybe' | 'pending';
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  invited_at: string | null;
  phone_number_verified: boolean | null;
  sms_opt_out: boolean | null;
  preferred_communication: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** 
   * Computed display name from COALESCE(users.full_name, event_guests.guest_name)
   * Prefer this over guest_name for UI display
   * @readonly
   */
  guest_display_name: string;
  users?: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
}

export interface GuestFilters {
  searchTerm?: string;
  rsvpStatus?: string; // 'all' | 'attending' | 'declined' | 'maybe' | 'pending'
  tags?: string[];
  requireAllTags?: boolean;
}

export interface GuestStatusCounts {
  total: number;
  attending: number;
  pending: number;
  maybe: number;
  declined: number;
}

/**
 * Centralized guest filtering logic
 * Consolidates duplicate filtering patterns across the app
 */
export class GuestFilterService {
  /**
   * Filter guests based on search term and RSVP status
   */
  static filterGuests(guests: GuestWithUser[], filters: GuestFilters): GuestWithUser[] {
    return guests.filter(guest => {
      // Search term matching
      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const searchLower = filters.searchTerm.toLowerCase();
        const displayName = guest.users?.full_name || guest.guest_name || '';
        
        const matchesSearch = 
          displayName.toLowerCase().includes(searchLower) ||
          guest.phone.includes(filters.searchTerm) ||
          guest.users?.phone?.includes(filters.searchTerm) ||
          guest.guest_email?.toLowerCase().includes(searchLower) ||
          guest.users?.email?.toLowerCase().includes(searchLower);
          
        if (!matchesSearch) return false;
      }

      // RSVP status filtering
      if (filters.rsvpStatus && filters.rsvpStatus !== 'all') {
        if (guest.rsvp_status !== filters.rsvpStatus) return false;
      }

      // Tag filtering
      if (filters.tags && filters.tags.length > 0) {
        const guestTags = guest.guest_tags || [];
        
        if (filters.requireAllTags) {
          // Guest must have ALL specified tags
          const hasAllTags = filters.tags.every(tag => guestTags.includes(tag));
          if (!hasAllTags) return false;
        } else {
          // Guest must have ANY of the specified tags
          const hasAnyTag = filters.tags.some(tag => guestTags.includes(tag));
          if (!hasAnyTag) return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate status counts for a list of guests
   */
  static calculateStatusCounts(guests: GuestWithUser[], totalCount?: number): GuestStatusCounts {
    return {
      total: totalCount ?? guests.length,
      attending: guests.filter(guest => guest.rsvp_status === 'attending').length,
      pending: guests.filter(guest => guest.rsvp_status === 'pending').length,
      maybe: guests.filter(guest => guest.rsvp_status === 'maybe').length,
      declined: guests.filter(guest => guest.rsvp_status === 'declined').length,
    };
  }

  /**
   * Get recent RSVP activity for analytics
   */
  static getRecentActivity(
    guests: GuestWithUser[], 
    limit: number = 5
  ): Array<{
    userName: string;
    status: string;
    timestamp: string;
  }> {
    return guests
      .filter(guest => guest.rsvp_status && guest.rsvp_status !== 'pending')
      .filter(guest => guest.updated_at) // Only include guests with update timestamps
      .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
      .slice(0, limit)
      .map(guest => ({
        userName: guest.users?.full_name || guest.guest_name || 'Someone',
        status: guest.rsvp_status || 'pending',
        timestamp: guest.updated_at || guest.created_at || '',
      }));
  }

  /**
   * Calculate response rate percentage
   */
  static calculateResponseRate(guests: GuestWithUser[]): number {
    const totalGuests = guests.length;
    if (totalGuests === 0) return 0;
    
    const pendingCount = guests.filter(guest => guest.rsvp_status === 'pending').length;
    const responseRate = ((totalGuests - pendingCount) / totalGuests) * 100;
    
    return Math.round(responseRate * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Group guests by RSVP status
   */
  static groupByRsvpStatus(guests: GuestWithUser[]): Record<string, GuestWithUser[]> {
    return guests.reduce((groups, guest) => {
      const status = guest.rsvp_status || 'pending';
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(guest);
      return groups;
    }, {} as Record<string, GuestWithUser[]>);
  }

  /**
   * Get display name for a guest
   */
  static getGuestDisplayName(guest: GuestWithUser): string {
    return guest.users?.full_name || guest.guest_name || 'Unknown Guest';
  }

  /**
   * Check if guest matches search criteria (for real-time filtering)
   */
  static matchesSearch(guest: GuestWithUser, searchTerm: string): boolean {
    if (!searchTerm || searchTerm.trim() === '') return true;
    
    const searchLower = searchTerm.toLowerCase();
    const displayName = this.getGuestDisplayName(guest);
    
    return (
      displayName.toLowerCase().includes(searchLower) ||
      guest.phone.includes(searchTerm) ||
      (guest.users?.phone?.includes(searchTerm) ?? false) ||
      (guest.guest_email?.toLowerCase().includes(searchLower) ?? false) ||
      (guest.users?.email?.toLowerCase().includes(searchLower) ?? false)
    );
  }
} 