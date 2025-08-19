-- Migration: Fix SECURITY DEFINER functions with unsafe search_path syntax
-- Date: 2025-01-30
-- Purpose: Correct search_path syntax from 'TO' to '=' for security

BEGIN;

-- Fix get_user_events function from 20250120000000_fix_duplicate_events_function.sql
-- Change 'SET search_path TO' to 'SET search_path ='
CREATE OR REPLACE FUNCTION public.get_user_events(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, title text, event_date date, location text, role text, rsvp_status text, is_host boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- FIXED: Changed from TO '' to = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN 'host'::TEXT
      ELSE COALESCE(eg.role, 'guest'::TEXT)
    END,
    -- For hosts, don't show guest RSVP status (they don't RSVP to their own events)
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN NULL::TEXT
      ELSE eg.rsvp_status
    END,
    (e.host_user_id = COALESCE(user_id_param, auth.uid()))
  FROM public.events e
  LEFT JOIN public.event_guests eg ON (
    eg.event_id = e.id 
    AND eg.user_id = COALESCE(user_id_param, auth.uid())
    AND eg.removed_at IS NULL  -- Include removed_at filter for consistency
  )
  WHERE 
    e.host_user_id = COALESCE(user_id_param, auth.uid()) 
    OR (eg.user_id = COALESCE(user_id_param, auth.uid()) AND eg.removed_at IS NULL)
  ORDER BY e.event_date DESC;
END;
$$;

-- Fix bulk_auto_join_from_auth function from 20250131000001_ensure_bulk_auto_join_from_auth.sql
-- Change 'SET search_path TO public' to 'SET search_path = public'
CREATE OR REPLACE FUNCTION public.bulk_auto_join_from_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'  -- FIXED: Changed from TO 'public' to = 'public'
AS $$
DECLARE
  v_user_phone text;
  v_user_id uuid;
  v_processed_events integer := 0;
  v_linked_events integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_event_record RECORD;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated',
      'processed_events', 0,
      'linked_events', 0,
      'results', '[]'::jsonb
    );
  END IF;

  -- Get user's phone from JWT or users table
  v_user_phone := COALESCE(
    auth.jwt() ->> 'phone',
    (SELECT phone FROM users WHERE id = v_user_id)
  );
  
  IF v_user_phone IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User phone not found',
      'processed_events', 0,
      'linked_events', 0,
      'results', '[]'::jsonb
    );
  END IF;

  -- Find and process events where user has unlinked guest records
  FOR v_event_record IN
    SELECT DISTINCT eg.event_id, e.title
    FROM event_guests eg
    JOIN events e ON e.id = eg.event_id
    WHERE eg.phone = v_user_phone
      AND eg.user_id IS NULL
      AND eg.removed_at IS NULL
  LOOP
    v_processed_events := v_processed_events + 1;
    
    -- Update the guest record to link the user_id
    UPDATE event_guests 
    SET 
      user_id = v_user_id,
      updated_at = NOW()
    WHERE event_id = v_event_record.event_id
      AND phone = v_user_phone
      AND user_id IS NULL
      AND removed_at IS NULL;
    
    IF FOUND THEN
      v_linked_events := v_linked_events + 1;
      v_results := v_results || jsonb_build_object(
        'event_id', v_event_record.event_id,
        'event_title', v_event_record.title,
        'action', 'linked'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_events', v_processed_events,
    'linked_events', v_linked_events,
    'results', v_results
  );
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_user_events(uuid) IS 
'Returns events for a user with corrected search_path syntax and removed_at filtering.';

COMMENT ON FUNCTION public.bulk_auto_join_from_auth() IS 
'Auto-joins user to events where they have unlinked guest records. Fixed search_path syntax.';

COMMIT;
