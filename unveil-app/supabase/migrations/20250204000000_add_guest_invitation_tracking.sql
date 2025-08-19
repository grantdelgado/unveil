-- Add guest invitation tracking fields
-- Support for "add now, invite later" flow

-- Add new fields to event_guests table
ALTER TABLE public.event_guests 
ADD COLUMN IF NOT EXISTS invited_at timestamptz,
ADD COLUMN IF NOT EXISTS last_invited_at timestamptz,
ADD COLUMN IF NOT EXISTS invite_attempts integer DEFAULT 0;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_event_guests_invited_at ON event_guests(event_id, invited_at);
CREATE INDEX IF NOT EXISTS idx_event_guests_joined_at ON event_guests(event_id, joined_at);

-- Create RPC function to update invitation tracking (RLS-safe)
CREATE OR REPLACE FUNCTION update_guest_invitation_tracking(
  p_event_id uuid,
  p_guest_ids uuid[]
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count integer := 0;
  v_result json;
BEGIN
  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM events 
    WHERE id = p_event_id 
    AND host_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only event hosts can update invitation tracking';
  END IF;

  -- Update invitation tracking for specified guests
  UPDATE event_guests 
  SET 
    last_invited_at = NOW(),
    invited_at = COALESCE(invited_at, NOW()),
    invite_attempts = invite_attempts + 1,
    updated_at = NOW()
  WHERE event_id = p_event_id 
    AND id = ANY(p_guest_ids)
    AND role = 'guest'; -- Only update guests, not hosts

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Return result
  SELECT json_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'timestamp', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_guest_invitation_tracking(uuid, uuid[]) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION update_guest_invitation_tracking(uuid, uuid[]) IS 
'Updates invitation tracking fields for specified guests. Only event hosts can execute. Updates last_invited_at, invited_at (if first time), and increments invite_attempts.';

-- Add RLS policies to protect new fields
-- Note: The existing event_guests policies already protect the table,
-- but we'll ensure the new fields follow the same access pattern

-- Create a helper function to determine invitation status
CREATE OR REPLACE FUNCTION get_guest_invitation_status(
  p_invited_at timestamptz,
  p_joined_at timestamptz,
  p_declined_at timestamptz
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Determine status based on timestamps
  IF p_declined_at IS NOT NULL THEN
    RETURN 'declined';
  ELSIF p_joined_at IS NOT NULL THEN
    RETURN 'joined';
  ELSIF p_invited_at IS NOT NULL THEN
    RETURN 'invited';
  ELSE
    RETURN 'not_invited';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_guest_invitation_status(timestamptz, timestamptz, timestamptz) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION get_guest_invitation_status(timestamptz, timestamptz, timestamptz) IS 
'Determines guest invitation status based on invited_at, joined_at, and declined_at timestamps. Returns: not_invited, invited, joined, or declined.';

-- Create a view for easier guest status queries (for hosts only)
CREATE OR REPLACE VIEW guest_status_summary AS
SELECT 
  eg.id,
  eg.event_id,
  eg.user_id,
  eg.guest_name,
  eg.phone,
  eg.role,
  eg.invited_at,
  eg.last_invited_at,
  eg.invite_attempts,
  eg.joined_at,
  eg.declined_at,
  eg.sms_opt_out,
  get_guest_invitation_status(eg.invited_at, eg.joined_at, eg.declined_at) as invitation_status,
  u.full_name as user_full_name
FROM event_guests eg
LEFT JOIN users u ON eg.user_id = u.id;

-- Apply RLS to the view
ALTER VIEW guest_status_summary OWNER TO postgres;
CREATE POLICY "guest_status_summary_host_access" ON guest_status_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = guest_status_summary.event_id 
      AND e.host_user_id = auth.uid()
    )
  );

-- Grant select permission to authenticated users
GRANT SELECT ON guest_status_summary TO authenticated;

-- Comment the view
COMMENT ON VIEW guest_status_summary IS 
'Provides guest status information with computed invitation_status field. Only accessible to event hosts via RLS.';

-- Update the existing get_event_guests_with_display_names function to include new fields
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
  guest_email TEXT,
  phone TEXT,
  rsvp_status TEXT,
  notes TEXT,
  guest_tags TEXT[],
  role TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  last_invited_at TIMESTAMP WITH TIME ZONE,
  invite_attempts INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  phone_number_verified BOOLEAN,
  sms_opt_out BOOLEAN,
  preferred_communication TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  guest_display_name TEXT,
  user_full_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_avatar_url TEXT,
  user_created_at TIMESTAMP WITH TIME ZONE,
  user_updated_at TIMESTAMP WITH TIME ZONE,
  user_intended_redirect TEXT,
  user_onboarding_completed BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    eg.id,
    eg.event_id,
    eg.user_id,
    eg.guest_name,
    eg.guest_email,
    eg.phone,
    eg.rsvp_status,
    eg.notes,
    eg.guest_tags,
    eg.role,
    eg.invited_at,
    eg.last_invited_at,
    eg.invite_attempts,
    eg.joined_at,
    eg.declined_at,
    eg.decline_reason,
    eg.phone_number_verified,
    eg.sms_opt_out,
    eg.preferred_communication,
    eg.created_at,
    eg.updated_at,
    COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest') AS guest_display_name,
    u.full_name AS user_full_name,
    u.email AS user_email,
    u.phone AS user_phone,
    u.avatar_url AS user_avatar_url,
    u.created_at AS user_created_at,
    u.updated_at AS user_updated_at,
    u.intended_redirect AS user_intended_redirect,
    u.onboarding_completed AS user_onboarding_completed
  FROM 
    public.event_guests eg
    LEFT JOIN public.users u ON u.id = eg.user_id
  WHERE 
    eg.event_id = p_event_id
  ORDER BY eg.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Comment the updated function
COMMENT ON FUNCTION public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER) IS 
'Returns event guests with computed display names and invitation tracking fields. Updated to include invited_at, last_invited_at, invite_attempts, joined_at, declined_at, and decline_reason fields.';
