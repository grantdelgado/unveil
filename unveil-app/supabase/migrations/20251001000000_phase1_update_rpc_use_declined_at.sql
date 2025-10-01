-- Migration: Phase 1 - Update resolve_message_recipients to use declined_at instead of rsvp_status
-- Purpose: Prepare for rsvp_status column removal by updating RPC logic to use declined_at
-- Date: 2025-10-01
-- Phase: 1 of 2 (Phase 2 will remove the column)

-- Update resolve_message_recipients function to use declined_at logic instead of rsvp_status
CREATE OR REPLACE FUNCTION public.resolve_message_recipients(
  msg_event_id uuid, 
  target_guest_ids uuid[] DEFAULT NULL::uuid[], 
  target_tags text[] DEFAULT NULL::text[], 
  require_all_tags boolean DEFAULT false, 
  target_rsvp_statuses text[] DEFAULT NULL::text[], 
  include_declined boolean DEFAULT false
)
RETURNS TABLE(guest_id uuid, phone text, guest_name text, display_name text, can_receive_sms boolean, sms_opt_out boolean, recipient_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id::UUID as guest_id,
    eg.phone::TEXT,
    COALESCE(eg.guest_name, pu.full_name, 'Guest')::TEXT as guest_name,
    COALESCE(eg.display_name, eg.guest_name, pu.full_name, 'Guest')::TEXT as display_name,
    (eg.phone IS NOT NULL AND eg.phone != '')::BOOLEAN as can_receive_sms,
    COALESCE(eg.sms_opt_out, false)::BOOLEAN as sms_opt_out,
    'guest'::TEXT as recipient_type
  FROM event_guests eg
  LEFT JOIN public.users pu ON eg.user_id = pu.id
  WHERE 
    eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND eg.phone != ''
    -- RSVP-Lite: Use declined_at instead of rsvp_status for primary filtering
    AND (include_declined = TRUE OR eg.declined_at IS NULL)
    -- Existing guest ID filter
    AND (target_guest_ids IS NULL OR eg.id = ANY(target_guest_ids))
    -- UPDATED: Convert rsvp_status logic to declined_at logic
    AND (
      target_rsvp_statuses IS NULL 
      OR (
        -- Map RSVP statuses to declined_at logic:
        -- 'attending' = declined_at IS NULL
        -- 'declined' = declined_at IS NOT NULL  
        -- 'pending'/'maybe' = declined_at IS NULL (treated as attending)
        ('attending' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
        OR ('declined' = ANY(target_rsvp_statuses) AND eg.declined_at IS NOT NULL)
        OR ('pending' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
        OR ('maybe' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
      )
    )
    -- Existing tag filters
    AND (
      target_tags IS NULL 
      OR (
        require_all_tags = FALSE AND guest_has_any_tags(eg.id, target_tags)
      )
      OR (
        require_all_tags = TRUE AND guest_has_all_tags(eg.id, target_tags)
      )
    )
  ORDER BY display_name, guest_id;
END;
$function$;

-- Add comment to document the change
COMMENT ON FUNCTION public.resolve_message_recipients IS 
'Resolve message recipients based on targeting criteria. UPDATED: Now uses declined_at instead of rsvp_status for RSVP filtering. Phase 1 of rsvp_status removal.';

-- Ensure required indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_event_guests_declined_at_null
  ON public.event_guests (event_id, declined_at)
  WHERE declined_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_guests_declined_at_not_null  
  ON public.event_guests (event_id, declined_at)
  WHERE declined_at IS NOT NULL;
