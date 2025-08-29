-- IMMEDIATE FIX: Update RPC function for alphabetical ordering
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Update the get_event_guests_with_display_names function to sort alphabetically
CREATE OR REPLACE FUNCTION public.get_event_guests_with_display_names(
  p_event_id UUID,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_id UUID, 
  user_id UUID,
  guest_name TEXT,
  phone TEXT,
  rsvp_status TEXT,
  notes TEXT,
  guest_tags TEXT[],
  role TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  last_invited_at TIMESTAMP WITH TIME ZONE,
  first_invited_at TIMESTAMP WITH TIME ZONE,
  last_messaged_at TIMESTAMP WITH TIME ZONE,
  invite_attempts INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  removed_at TIMESTAMP WITH TIME ZONE,
  phone_number_verified BOOLEAN,
  sms_opt_out BOOLEAN,
  preferred_communication TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  guest_display_name TEXT,
  user_full_name TEXT,
  user_phone TEXT,
  user_avatar_url TEXT,
  user_created_at TIMESTAMP WITH TIME ZONE,
  user_updated_at TIMESTAMP WITH TIME ZONE,
  user_intended_redirect TEXT,
  user_onboarding_completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id,
    eg.event_id,
    eg.user_id,
    eg.guest_name::text,
    eg.phone::text,
    eg.rsvp_status::text,
    eg.notes::text,
    eg.guest_tags,
    eg.role::text,
    eg.invited_at,
    eg.last_invited_at,
    eg.first_invited_at,
    eg.last_messaged_at,
    eg.invite_attempts,
    eg.joined_at,
    eg.declined_at,
    eg.decline_reason::text,
    eg.removed_at,
    eg.phone_number_verified,
    eg.sms_opt_out,
    eg.preferred_communication::text,
    eg.created_at,
    eg.updated_at,
    COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest')::text AS guest_display_name,
    u.full_name::text AS user_full_name,
    u.phone::text AS user_phone,
    u.avatar_url::text AS user_avatar_url,
    u.created_at AS user_created_at,
    u.updated_at AS user_updated_at,
    u.intended_redirect::text AS user_intended_redirect,
    u.onboarding_completed AS user_onboarding_completed
  FROM 
    public.event_guests eg
    LEFT JOIN public.users u ON u.id = eg.user_id
  WHERE 
    eg.event_id = p_event_id
    AND eg.removed_at IS NULL  -- Exclude soft-deleted guests
  ORDER BY 
    -- CRITICAL CHANGE: Alphabetical ordering by display name (case-insensitive)
    -- Hosts appear first, then guests alphabetically
    CASE WHEN eg.role = 'host' THEN 0 ELSE 1 END,
    LOWER(COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest')) ASC,
    eg.id ASC  -- Stable sort tiebreaker for identical names
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Test the function to verify alphabetical ordering
SELECT 
    guest_display_name,
    role,
    created_at::date as created_date
FROM get_event_guests_with_display_names('24caa3a8-020e-4a80-9899-35ff2797dcc0', 10, 0);

-- Expected result: Should see guests in alphabetical order (A-Z), with hosts first if any
