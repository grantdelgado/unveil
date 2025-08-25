-- Add RPC for accurate bulk invite eligibility
-- Returns guest IDs that match the exact same criteria as single invite validation

-- Create function to get invitable guest IDs with all validation
CREATE OR REPLACE FUNCTION public.get_invitable_guest_ids(p_event_id uuid)
RETURNS TABLE(guest_id uuid)
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT eg.id
  FROM event_guests eg
  WHERE eg.event_id = p_event_id
    AND eg.removed_at IS NULL
    AND eg.role <> 'host'
    AND eg.invited_at IS NULL
    AND COALESCE(eg.sms_opt_out, false) = false
    AND eg.phone IS NOT NULL
    AND eg.phone ~ '^\+[1-9]\d{1,14}$';
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_invitable_guest_ids(uuid) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION public.get_invitable_guest_ids(uuid) IS 
'Returns guest IDs that are eligible for bulk invitations. Uses the same validation as single invite: not host, not removed, not invited, not opted out, valid phone format.';

-- Update the existing get_event_guest_counts to use the same criteria
CREATE OR REPLACE FUNCTION public.get_event_guest_counts(p_event_id uuid)
RETURNS TABLE(
    total_guests integer,
    total_invited integer,
    attending integer,
    declined integer,
    not_invited integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user is event host or guest
    IF NOT EXISTS (
        SELECT 1 FROM events 
        WHERE id = p_event_id 
        AND (host_user_id = auth.uid() OR is_event_guest(p_event_id))
    ) THEN
        RAISE EXCEPTION 'Access denied: You must be a host or guest of this event';
    END IF;

    RETURN QUERY
    SELECT 
        -- Total guests (excluding hosts)
        COUNT(*)::integer as total_guests,
        
        -- Total invited (excluding hosts)
        COUNT(*) FILTER (WHERE invited_at IS NOT NULL)::integer as total_invited,
        
        -- Attending (excluding hosts)
        COUNT(*) FILTER (WHERE declined_at IS NULL AND joined_at IS NOT NULL)::integer as attending,
        
        -- Declined (excluding hosts)
        COUNT(*) FILTER (WHERE declined_at IS NOT NULL)::integer as declined,
        
        -- Not invited with accurate eligibility (excluding hosts, matching single invite validation)
        COUNT(*) FILTER (
            WHERE invited_at IS NULL 
            AND COALESCE(sms_opt_out, false) = false
            AND phone IS NOT NULL
            AND phone ~ '^\+[1-9]\d{1,14}$'
        )::integer as not_invited
        
    FROM event_guests eg
    WHERE eg.event_id = p_event_id
      AND eg.removed_at IS NULL
      AND eg.role <> 'host';
END;
$$;

-- Update comment for the updated function
COMMENT ON FUNCTION public.get_event_guest_counts(uuid) IS 
'Returns guest counts for an event with accurate not_invited count that matches single invite validation. Hosts are excluded from all counts.';
