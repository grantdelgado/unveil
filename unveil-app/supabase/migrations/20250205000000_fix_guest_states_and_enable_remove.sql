-- Fix guest states: remove auto-invite, simplify states, enable safe Remove
-- Support for "add now, invite later" flow improvements

-- 1. Remove auto-invite: Drop DEFAULT now() from invited_at
ALTER TABLE public.event_guests 
ALTER COLUMN invited_at DROP DEFAULT;

-- 2. Add soft-delete support
ALTER TABLE public.event_guests 
ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- 3. Update unique constraint to be partial (only for non-removed guests)
-- First drop the existing constraint
ALTER TABLE public.event_guests 
DROP CONSTRAINT IF EXISTS event_guests_event_id_phone_key;

-- Create new partial unique constraint
CREATE UNIQUE INDEX event_guests_event_id_phone_active_key 
ON public.event_guests (event_id, phone) 
WHERE removed_at IS NULL;

-- 4. Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_event_guests_removed_at ON event_guests(removed_at);

-- 5. Create RPC function for soft-delete (RLS-safe)
CREATE OR REPLACE FUNCTION soft_delete_guest(
  p_guest_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_result json;
BEGIN
  -- Get the event_id for the guest and verify host permission
  SELECT event_id INTO v_event_id
  FROM event_guests 
  WHERE id = p_guest_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Guest not found';
  END IF;

  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM events 
    WHERE id = v_event_id 
    AND host_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only event hosts can remove guests';
  END IF;

  -- Prevent removing hosts
  IF EXISTS (
    SELECT 1 FROM event_guests 
    WHERE id = p_guest_id 
    AND role = 'host'
  ) THEN
    RAISE EXCEPTION 'Cannot remove event hosts';
  END IF;

  -- Soft delete the guest
  UPDATE event_guests 
  SET 
    removed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_guest_id 
    AND removed_at IS NULL; -- Only if not already removed

  -- Return result
  SELECT json_build_object(
    'success', true,
    'guest_id', p_guest_id,
    'removed_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION soft_delete_guest(uuid) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION soft_delete_guest(uuid) IS 
'Soft-deletes a guest by setting removed_at timestamp. Only event hosts can remove guests. Hosts cannot be removed.';

-- 6. Create RPC function to restore removed guest (for future use)
CREATE OR REPLACE FUNCTION restore_guest(
  p_guest_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_result json;
BEGIN
  -- Get the event_id for the guest and verify host permission
  SELECT event_id INTO v_event_id
  FROM event_guests 
  WHERE id = p_guest_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Guest not found';
  END IF;

  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM events 
    WHERE id = v_event_id 
    AND host_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only event hosts can restore guests';
  END IF;

  -- Restore the guest
  UPDATE event_guests 
  SET 
    removed_at = NULL,
    updated_at = NOW()
  WHERE id = p_guest_id 
    AND removed_at IS NOT NULL; -- Only if currently removed

  -- Return result
  SELECT json_build_object(
    'success', true,
    'guest_id', p_guest_id,
    'restored_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION restore_guest(uuid) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION restore_guest(uuid) IS 
'Restores a soft-deleted guest by clearing removed_at timestamp. Only event hosts can restore guests.';

-- 7. Update get_event_guests_with_display_names to exclude removed guests
DROP FUNCTION IF EXISTS public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER);

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
  removed_at TIMESTAMP WITH TIME ZONE,
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
    eg.removed_at,
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
    AND eg.removed_at IS NULL  -- Exclude soft-deleted guests
  ORDER BY eg.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Comment the updated function
COMMENT ON FUNCTION public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER) IS 
'Returns active (non-removed) event guests with computed display names and invitation tracking fields. Excludes soft-deleted guests.';

-- 8. Create function to check if phone exists for event (for duplicate prevention)
CREATE OR REPLACE FUNCTION check_phone_exists_for_event(
  p_event_id uuid,
  p_phone text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM event_guests 
    WHERE event_id = p_event_id 
    AND phone = p_phone 
    AND removed_at IS NULL
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_phone_exists_for_event(uuid, text) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION check_phone_exists_for_event(uuid, text) IS 
'Checks if a phone number already exists for an event (excluding removed guests). Used for duplicate prevention.';
