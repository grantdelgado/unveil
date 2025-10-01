-- Migration: Wave 2 - Drop RSVP Status ENUM if Unused
-- Purpose: Remove rsvp_status_enum only if it exists and has zero dependencies
-- Date: 2025-10-02
-- 
-- SAFETY: Migration will no-op if enum doesn't exist or has dependencies

BEGIN;

-- Safety check: only drop if enum exists and has no dependencies
DO $$
DECLARE
  enum_exists boolean;
  dependency_count integer;
BEGIN
  -- Check if enum exists
  SELECT EXISTS(
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'rsvp_status_enum'
  ) INTO enum_exists;
  
  IF enum_exists THEN
    -- Count non-extension dependencies
    SELECT COUNT(*) INTO dependency_count
    FROM pg_depend d
    JOIN pg_type t ON t.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' 
      AND t.typname = 'rsvp_status_enum'
      AND d.deptype != 'e';  -- Exclude extension dependencies
    
    IF dependency_count = 0 THEN
      DROP TYPE public.rsvp_status_enum;
      RAISE NOTICE 'Dropped unused rsvp_status_enum type';
    ELSE
      RAISE NOTICE 'Skipped dropping rsvp_status_enum - has % dependencies', dependency_count;
    END IF;
  ELSE
    RAISE NOTICE 'rsvp_status_enum does not exist - no action needed';
  END IF;
END;
$$;

COMMIT;
