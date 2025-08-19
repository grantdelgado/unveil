-- Migration: Fix is_event_guest() function to filter removed guests
-- Date: 2025-01-30
-- Purpose: Add missing removed_at IS NULL filter to prevent removed guests from accessing events

BEGIN;

-- Update is_event_guest() function to filter out removed guests
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1
        FROM public.event_guests eg
        WHERE eg.event_id = p_event_id
          AND eg.user_id = (SELECT auth.uid())
          AND eg.removed_at IS NULL  -- CRITICAL FIX: Only include active guests
    );
END;
$$;

-- Recreate can_access_event() to ensure it uses the updated is_event_guest()
-- No logic change, just ensuring it calls the corrected function
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN public.is_event_host(p_event_id) OR public.is_event_guest(p_event_id);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.is_event_guest(uuid) IS 
'Check if authenticated user is an active (non-removed) guest of the specified event. FIXED: Now properly filters removed_at IS NULL.';

COMMENT ON FUNCTION public.can_access_event(uuid) IS 
'Check if authenticated user can access event as host or active guest. Updated to use corrected is_event_guest() function.';

COMMIT;
