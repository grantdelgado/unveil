-- Fix guest alphabetical ordering for pagination
-- Changes ORDER BY from created_at DESC to alphabetical by display name
-- This ensures pagination shows guests in true alphabetical order across all pages

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
    -- Alphabetical ordering by display name (case-insensitive)
    -- Hosts appear first, then guests alphabetically
    CASE WHEN eg.role = 'host' THEN 0 ELSE 1 END,
    LOWER(COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest')) ASC,
    eg.id ASC  -- Stable sort tiebreaker for identical names
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update the comment to reflect the new ordering
COMMENT ON FUNCTION public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER) IS 
'Returns event guests with computed display names in alphabetical order. Hosts appear first, followed by guests sorted alphabetically by display name. Supports pagination with stable ordering.';

-- Create index to optimize alphabetical queries
CREATE INDEX IF NOT EXISTS idx_event_guests_alphabetical 
ON public.event_guests (event_id, role, LOWER(guest_name)) 
WHERE removed_at IS NULL;

-- Create compound index for users.full_name ordering (for linked guests)
CREATE INDEX IF NOT EXISTS idx_users_full_name_lower 
ON public.users (LOWER(full_name)) 
WHERE full_name IS NOT NULL;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Updated get_event_guests_with_display_names to sort alphabetically';
  RAISE NOTICE 'Hosts appear first, then guests in alphabetical order by display name';
  RAISE NOTICE 'Added indexes to optimize alphabetical sorting performance';
END;
$$;
