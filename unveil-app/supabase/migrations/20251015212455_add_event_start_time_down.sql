-- Rollback migration: Remove start_time column from events table
-- This rollback is safe - it only removes the new column
-- The original event_date and time_zone columns remain unchanged

BEGIN;

-- Drop the index first
DROP INDEX IF EXISTS public.idx_events_start_time;

-- Drop the time_zone constraint
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_time_zone_format_check;

-- Remove the start_time column
ALTER TABLE public.events
DROP COLUMN IF EXISTS start_time;

-- Verify rollback
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'events'
    AND column_name = 'start_time'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE EXCEPTION 'Rollback failed: start_time column still exists';
  ELSE
    RAISE NOTICE 'Rollback successful: start_time column removed';
  END IF;
END;
$$;

COMMIT;

