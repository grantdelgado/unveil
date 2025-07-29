-- Migration: Safe JWT Claim Extraction Functions
-- Purpose: Fix auth claim parsing issues by providing null-safe JWT claim extraction
-- Related: auth-claim-parsing-fix.md

-- Function to safely extract phone from JWT with multiple fallback locations
CREATE OR REPLACE FUNCTION get_user_phone_safe()
RETURNS TEXT AS $$
DECLARE
  jwt_phone TEXT;
  metadata_phone TEXT;
BEGIN
  -- Method 1: Direct phone claim (SMS auth)
  jwt_phone := auth.jwt() ->> 'phone';
  IF jwt_phone IS NOT NULL AND jwt_phone != '' THEN
    RETURN jwt_phone;
  END IF;

  -- Method 2: Phone in user_metadata (phone-based signup)
  BEGIN
    metadata_phone := auth.jwt() -> 'user_metadata' ->> 'phone';
    IF metadata_phone IS NOT NULL AND metadata_phone != '' THEN
      RETURN metadata_phone;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- user_metadata might not exist, continue to next method
      NULL;
  END;

  -- Method 3: Phone in app_metadata (admin-set)
  BEGIN
    metadata_phone := auth.jwt() -> 'app_metadata' ->> 'phone';
    IF metadata_phone IS NOT NULL AND metadata_phone != '' THEN
      RETURN metadata_phone;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- app_metadata might not exist, return null
      NULL;
  END;

  -- No phone found in any location
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely extract email from JWT
CREATE OR REPLACE FUNCTION get_user_email_safe()
RETURNS TEXT AS $$
DECLARE
  jwt_email TEXT;
  metadata_email TEXT;
BEGIN
  -- Method 1: Direct email claim
  jwt_email := auth.jwt() ->> 'email';
  IF jwt_email IS NOT NULL AND jwt_email != '' THEN
    RETURN jwt_email;
  END IF;

  -- Method 2: Email in user_metadata
  BEGIN
    metadata_email := auth.jwt() -> 'user_metadata' ->> 'email';
    IF metadata_email IS NOT NULL AND metadata_email != '' THEN
      RETURN metadata_email;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely extract role from JWT
CREATE OR REPLACE FUNCTION get_user_role_safe()
RETURNS TEXT AS $$
DECLARE
  metadata_role TEXT;
BEGIN
  -- Check user_metadata for role
  BEGIN
    metadata_role := auth.jwt() -> 'user_metadata' ->> 'role';
    IF metadata_role IS NOT NULL AND metadata_role != '' THEN
      RETURN LOWER(metadata_role);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- Check app_metadata for role (admin-managed)
  BEGIN
    metadata_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF metadata_role IS NOT NULL AND metadata_role != '' THEN
      RETURN LOWER(metadata_role);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has valid JWT with required claims
CREATE OR REPLACE FUNCTION has_valid_jwt_with_phone()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if JWT exists and has a valid phone
  RETURN auth.jwt() IS NOT NULL 
    AND get_user_phone_safe() IS NOT NULL 
    AND get_user_phone_safe() != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced is_event_guest function with safe JWT handling
CREATE OR REPLACE FUNCTION is_event_guest(event_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  current_phone TEXT;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Method 1: Check if user is directly linked as guest
  IF current_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM event_guests eg
      WHERE eg.event_id = $1
      AND eg.user_id = current_user_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Method 2: Check if user has valid JWT with phone and matches unlinked guest
  IF has_valid_jwt_with_phone() THEN
    current_phone := get_user_phone_safe();
    
    IF EXISTS (
      SELECT 1 FROM event_guests eg
      WHERE eg.event_id = $1
      AND eg.phone = current_phone
      AND eg.user_id IS NULL
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced is_event_host function with safe JWT handling
CREATE OR REPLACE FUNCTION is_event_host(event_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Must have authenticated user ID
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user is the host of the event
  RETURN EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = $1
    AND e.host_user_id = current_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_phone_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_jwt_with_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION is_event_guest(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_event_host(UUID) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_user_phone_safe() IS 'Safely extract phone number from JWT with multiple fallback locations and null checking';
COMMENT ON FUNCTION get_user_email_safe() IS 'Safely extract email from JWT with null checking';
COMMENT ON FUNCTION get_user_role_safe() IS 'Safely extract user role from JWT metadata with null checking';
COMMENT ON FUNCTION has_valid_jwt_with_phone() IS 'Check if current session has valid JWT with extractable phone number';
COMMENT ON FUNCTION is_event_guest(UUID) IS 'Enhanced guest check with safe JWT claim parsing';
COMMENT ON FUNCTION is_event_host(UUID) IS 'Enhanced host check with safe JWT claim parsing'; 