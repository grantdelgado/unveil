/**
 * Domain types for Unveil - Future-ready with optional email support
 * These types reflect the current database schema while allowing for future email features
 */

// User types - minimal and future-ready
export type UserLite = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  // email removed from current implementation but type allows for future addition
};

// Guest core type - reflects current DB schema with future email support
export type GuestCore = {
  id: string;
  phone: string | null; // Required for SMS functionality
  guest_name?: string | null;
  email?: string | null; // Optional for future email features (currently unused)
  role?: string;
  rsvp_status?: string | null;
  notes?: string | null;
  guest_tags?: string[] | null;
};

// Messaging recipient - current implementation (no email)
export type MessagingRecipient = {
  id: string;
  guest_name: string | null;
  phone: string | null;
  display_name: string;
  sms_opt_out: boolean | null;
  role: string;
  // email intentionally omitted from current messaging system
};
