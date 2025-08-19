-- Single entry point RPC for adding or restoring guests
-- Implements canonical membership: one row per (event_id, phone), soft-delete/restore pattern

CREATE OR REPLACE FUNCTION public.add_or_restore_guest(
  p_event_id uuid,
  p_phone text,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_role text DEFAULT 'guest'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_normalized_phone text;
  v_existing_guest_id uuid;
  v_existing_record record;
  v_current_user_id uuid;
  v_result json;
  v_operation text;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id 
    AND host_user_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Only event hosts can add guests';
  END IF;

  -- Normalize phone number
  v_normalized_phone := public.normalize_phone(p_phone);
  IF v_normalized_phone IS NULL THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;

  -- Prevent adding hosts as guests (hosts should not be in event_guests table)
  IF p_role = 'host' THEN
    RAISE EXCEPTION 'Cannot add hosts through this function';
  END IF;

  -- Look for existing record (active or removed) for this (event_id, phone)
  SELECT * INTO v_existing_record
  FROM public.event_guests 
  WHERE event_id = p_event_id 
    AND phone = v_normalized_phone
  ORDER BY created_at DESC  -- Get most recent if multiple exist
  LIMIT 1;

  IF v_existing_record.id IS NOT NULL THEN
    -- Record exists
    v_existing_guest_id := v_existing_record.id;
    
    IF v_existing_record.removed_at IS NOT NULL THEN
      -- Restore removed guest (canonical approach)
      UPDATE public.event_guests 
      SET 
        removed_at = NULL,
        guest_name = COALESCE(p_name, v_existing_record.guest_name),
        guest_email = COALESCE(p_email, v_existing_record.guest_email),
        role = p_role,
        declined_at = NULL,  -- Clear any previous decline
        decline_reason = NULL,
        sms_opt_out = false,  -- Reset opt-out status
        updated_at = NOW()
      WHERE id = v_existing_guest_id;
      
      v_operation := 'restored';
    ELSE
      -- Already active - update details but don't create duplicate
      UPDATE public.event_guests 
      SET 
        guest_name = COALESCE(p_name, v_existing_record.guest_name),
        guest_email = COALESCE(p_email, v_existing_record.guest_email),
        role = p_role,
        updated_at = NOW()
      WHERE id = v_existing_guest_id;
      
      v_operation := 'updated';
    END IF;
  ELSE
    -- No existing record - create new guest
    INSERT INTO public.event_guests (
      event_id,
      phone,
      guest_name,
      guest_email,
      role,
      rsvp_status,
      sms_opt_out,
      created_at,
      updated_at
    ) VALUES (
      p_event_id,
      v_normalized_phone,
      p_name,
      p_email,
      p_role,
      'pending',
      false,
      NOW(),
      NOW()
    ) RETURNING id INTO v_existing_guest_id;
    
    v_operation := 'created';
  END IF;

  -- Return result with operation details
  SELECT json_build_object(
    'success', true,
    'guest_id', v_existing_guest_id,
    'operation', v_operation,
    'phone', v_normalized_phone,
    'name', p_name,
    'email', p_email,
    'role', p_role
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.add_or_restore_guest(uuid, text, text, text, text) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.add_or_restore_guest(uuid, text, text, text, text) IS 
'Single entry point for adding guests. Finds existing guest by (event_id, phone) and either restores (if removed) or updates (if active) or creates new. Preserves history and prevents duplicates. Only event hosts can add guests.';
