-- Migration: Cleanup RSVP ENUM Type (if exists)
-- Purpose: Remove any remaining rsvp_status_enum type after compat view sunset
-- Date: 2025-10-31 (1 day after compat view removal)
-- 
-- IMPORTANT: Only run this after:
-- 1. Compatibility view has been removed (20251030000000)
-- 2. CI guard confirms no references to rsvp_status or ENUM
-- 3. All code uses declined_at + sms_opt_out model

-- Safety check: Ensure no dependencies on ENUM type
DO $$
DECLARE
  enum_usage_count INTEGER;
BEGIN
  -- Check if any tables, functions, or views reference the ENUM
  SELECT COUNT(*) INTO enum_usage_count
  FROM information_schema.columns 
  WHERE data_type = 'USER-DEFINED' 
    AND udt_name LIKE '%rsvp%';
    
  IF enum_usage_count > 0 THEN
    RAISE EXCEPTION 'RSVP ENUM type still in use. Cannot safely remove.';
  END IF;
  
  RAISE NOTICE 'No ENUM dependencies found. Proceeding with cleanup.';
END $$;

BEGIN;

-- Drop RSVP-related ENUM types if they exist
-- Note: These may not exist if they were already cleaned up
DROP TYPE IF EXISTS public.rsvp_status_enum;
DROP TYPE IF EXISTS public.rsvp_status_type;
DROP TYPE IF EXISTS public.guest_rsvp_status;

-- Clean up any orphaned type references in comments or descriptions
UPDATE pg_description 
SET description = regexp_replace(description, 'rsvp_status_enum', 'declined_at', 'gi')
WHERE description ILIKE '%rsvp_status_enum%';

-- Log the cleanup for audit trail
INSERT INTO public.migration_log (
  migration_name,
  description,
  applied_at,
  applied_by
) VALUES (
  'cleanup_rsvp_enum_type',
  'Removed legacy RSVP ENUM types after full migration to declined_at model',
  NOW(),
  'system'
) ON CONFLICT DO NOTHING;

COMMIT;

-- Final verification
DO $$
DECLARE
  remaining_enums INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_enums
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname LIKE '%rsvp%';
  
  IF remaining_enums > 0 THEN
    RAISE WARNING 'Some RSVP-related types may still exist. Manual review recommended.';
  ELSE
    RAISE NOTICE 'RSVP ENUM cleanup complete. All legacy types removed.';
  END IF;
END $$;
