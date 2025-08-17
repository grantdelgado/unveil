-- Migration: Ensure bulk_guest_auto_join_from_auth function exists
-- Purpose: Fix 42883 error on /select-event by ensuring the auth-context function exists
-- Date: 2025-01-31

-- =====================================================
-- Bulk Auto-Join Function (Auth Context Version)
-- =====================================================

-- This function automatically extracts the phone number from the JWT token
-- and calls the main bulk_guest_auto_join function. This solves the authentication
-- context issue that was causing 42883 errors.

CREATE OR REPLACE FUNCTION public.bulk_guest_auto_join_from_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_phone text;
BEGIN
  -- Try to get phone from auth context
  v_user_phone := auth.jwt() ->> 'phone';
  
  IF v_user_phone IS NULL THEN
    -- Fallback: try user_metadata.phone
    v_user_phone := (auth.jwt() -> 'user_metadata' ->> 'phone');
  END IF;
  
  -- Call the main function with the extracted phone
  RETURN public.bulk_guest_auto_join(v_user_phone);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.bulk_guest_auto_join_from_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_guest_auto_join_from_auth() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.bulk_guest_auto_join_from_auth() IS 
'Bulk auto-join function that extracts phone from JWT context automatically. Used by client-side auth flow to prevent 42883 errors.';

-- =====================================================
-- Verification Query
-- =====================================================

-- Verify the function was created successfully
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname = 'bulk_guest_auto_join_from_auth';
    
  IF func_count = 0 THEN
    RAISE EXCEPTION 'Function bulk_guest_auto_join_from_auth was not created successfully';
  ELSE
    RAISE NOTICE 'Function bulk_guest_auto_join_from_auth created successfully';
  END IF;
END;
$$;
