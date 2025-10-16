/**
 * Type definitions for Supabase RPC function results
 * Centralized to avoid repetition and ensure consistency
 * 
 * NOTE: These should match the actual RETURNS TABLE definitions in migrations
 * Update when RPC signatures change
 */

/**
 * Result type for get_event_guests_with_display_names RPC
 * Source: supabase/migrations/20251011000000_add_server_side_guest_search.sql
 */
export type GetEventGuestsWithDisplayNamesResult = {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  phone: string | null;
  rsvp_status: string | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  invited_at: string | null;
  last_invited_at: string | null;
  first_invited_at: string | null;
  last_messaged_at: string | null;
  invite_attempts: number | null;
  joined_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  removed_at: string | null;
  phone_number_verified: boolean | null;
  sms_opt_out: boolean | null;
  preferred_communication: string | null;
  created_at: string | null;
  updated_at: string | null;
  guest_display_name: string;
  user_full_name: string | null;
  user_avatar_url: string | null;
  user_phone: string | null;
  user_created_at: string | null;
  user_updated_at: string | null;
  user_intended_redirect: string | null;
  user_onboarding_completed: boolean | null;
};

/**
 * Result type for resolve_message_recipients RPC
 */
export type ResolveMessageRecipientsResult = {
  guest_id: string;
  phone: string;
  display_name: string;
  can_receive_sms: boolean;
  sms_opt_out: boolean;
  guest_name: string;
  recipient_type: string;
};

/**
 * Result type for get_user_events RPC
 */
export type GetUserEventsResult = {
  id: string;
  title: string;
  event_date: string;
  location: string;
  role: string;
  rsvp_status: string;
  is_host: boolean;
};

/**
 * Result type for get_scheduled_messages_for_processing RPC
 */
export type GetScheduledMessagesForProcessingResult = {
  id: string;
  event_id: string;
  content: string;
  send_at: string;
  sender_user_id: string;
  event_title: string;
  event_sms_tag: string;
  message_type: string;
  target_all_guests: boolean;
  target_guest_ids: string[] | null;
  target_guest_tags: string[] | null;
  send_via_sms: boolean | null;
  send_via_push: boolean | null;
  recipient_count: number | null;
  scheduled_tz: string | null;
  scheduled_local: string | null;
  idempotency_key: string | null;
  status: string | null;
};

