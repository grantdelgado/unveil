-- Migration: Add start_time column to events table
-- Date: 2025-10-15
-- Purpose: Properly store event datetime with timezone to fix data integrity issue
--          where event time entered by users was being lost

BEGIN;

-- =====================================================
-- STEP 1: Add start_time column
-- =====================================================

ALTER TABLE public.events
ADD COLUMN start_time TIMESTAMPTZ;

COMMENT ON COLUMN public.events.start_time IS 
'Full event start datetime in UTC. Use with time_zone column for local time display and scheduled message timing.';

-- =====================================================
-- STEP 2: Backfill existing events
-- =====================================================

-- For existing events, set start_time to noon UTC on the event_date
-- This is a safe conservative default since we don't have the actual time
UPDATE public.events
SET start_time = (event_date || ' 12:00:00')::timestamptz
WHERE start_time IS NULL;

-- =====================================================
-- STEP 3: Add index for query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_events_start_time 
ON public.events(start_time);

COMMENT ON INDEX idx_events_start_time IS 
'Index for querying events by start time, used in schedule queries and message scheduling.';

-- =====================================================
-- STEP 4: Add constraint to ensure time_zone is set for new events
-- =====================================================

-- Note: We don't make time_zone NOT NULL to allow backward compatibility,
-- but we'll enforce it at the application level for new events

-- Add check constraint to ensure time_zone format is valid (if provided)
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_time_zone_format_check;

ALTER TABLE public.events
ADD CONSTRAINT events_time_zone_format_check
CHECK (
  time_zone IS NULL OR 
  (time_zone ~ '^[A-Za-z_]+/[A-Za-z_]+$' AND length(time_zone) >= 3 AND length(time_zone) <= 50)
);

COMMENT ON CONSTRAINT events_time_zone_format_check ON public.events IS 
'Ensures time_zone follows standard IANA format (e.g., America/Los_Angeles) when provided.';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify all events now have start_time
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.events
  WHERE start_time IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % events with NULL start_time after backfill', null_count;
  ELSE
    RAISE NOTICE 'All events successfully backfilled with start_time';
  END IF;
END;
$$;

-- Sample query to verify backfill worked correctly
-- SELECT id, title, event_date, start_time, time_zone 
-- FROM public.events 
-- ORDER BY created_at DESC 
-- LIMIT 5;

COMMIT;

