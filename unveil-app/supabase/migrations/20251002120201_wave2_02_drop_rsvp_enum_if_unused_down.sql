-- ROLLBACK Migration: Restore RSVP Status ENUM
-- Purpose: Recreate rsvp_status_enum if it was dropped
-- Date: 2025-10-02
-- Usage: Run this if you need to restore the enum type

BEGIN;

-- Recreate enum only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'rsvp_status_enum'
  ) THEN
    CREATE TYPE public.rsvp_status_enum AS ENUM ('ATTENDING', 'DECLINED');
    RAISE NOTICE 'Recreated rsvp_status_enum type';
  ELSE
    RAISE NOTICE 'rsvp_status_enum already exists - no action needed';
  END IF;
END;
$$;

COMMIT;
