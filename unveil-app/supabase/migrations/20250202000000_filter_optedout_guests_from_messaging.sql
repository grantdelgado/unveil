-- Migration: Filter opted-out guests from messaging functions
-- This migration updates the resolve_message_recipients function to exclude guests who have opted out of SMS

-- Update resolve_message_recipients function to exclude opted-out guests
CREATE OR REPLACE FUNCTION public.resolve_message_recipients(
  msg_event_id uuid, 
  target_guest_ids uuid[] DEFAULT NULL::uuid[], 
  target_tags text[] DEFAULT NULL::text[], 
  require_all_tags boolean DEFAULT false, 
  target_rsvp_statuses text[] DEFAULT NULL::text[]
)
RETURNS TABLE(guest_id uuid, guest_phone text, guest_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id as guest_id,
    eg.phone as guest_phone,
    eg.guest_name as guest_name
  FROM public.event_guests eg
  WHERE eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND COALESCE(eg.sms_opt_out, false) = false  -- Exclude opted-out guests
    AND (
      -- If explicit guest IDs are provided, use those
      (target_guest_ids IS NOT NULL AND eg.id = ANY(target_guest_ids))
      OR
      -- Otherwise, apply tag and RSVP filters
      (
        target_guest_ids IS NULL
        AND
        -- Tag filtering
        (
          target_tags IS NULL 
          OR array_length(target_tags, 1) IS NULL
          OR (
            require_all_tags = FALSE 
            AND public.guest_has_any_tags(eg.id, target_tags)
          )
          OR (
            require_all_tags = TRUE 
            AND public.guest_has_all_tags(eg.id, target_tags)
          )
        )
        AND
        -- RSVP status filtering
        (
          target_rsvp_statuses IS NULL 
          OR array_length(target_rsvp_statuses, 1) IS NULL
          OR eg.rsvp_status = ANY(target_rsvp_statuses)
        )
      )
    );
END;
$$;

-- Update get_messageable_guests function to exclude opted-out guests
CREATE OR REPLACE FUNCTION public.get_messageable_guests(p_event_id uuid)
RETURNS TABLE (
  guest_id uuid,
  phone text,
  guest_name text,
  rsvp_status text,
  guest_tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if user is event host
  IF NOT public.is_event_host(p_event_id) THEN
    RAISE EXCEPTION 'Access denied: User is not a host of this event';
  END IF;

  -- Return guests with valid phone numbers and not opted out
  RETURN QUERY
  SELECT 
    eg.id,
    eg.phone,
    eg.guest_name,
    eg.rsvp_status,
    eg.guest_tags
  FROM public.event_guests eg
  WHERE eg.event_id = p_event_id
    AND public.is_valid_phone_for_messaging(eg.phone)
    AND COALESCE(eg.sms_opt_out, false) = false  -- Exclude opted-out guests
  ORDER BY eg.guest_name;
END;
$$;

-- Add comments for clarity
COMMENT ON FUNCTION public.resolve_message_recipients IS 
'Resolve message recipients based on targeting criteria including tags and RSVP status. Automatically excludes guests who have opted out of SMS.';

COMMENT ON FUNCTION public.get_messageable_guests IS 
'Returns all guests with valid phone numbers for an event who have not opted out of SMS. Restricted to event hosts only.';
