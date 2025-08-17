-- Add event timezone support for consistent schedule rendering
-- This enables all schedule times to be anchored to the venue's local timezone

BEGIN;

-- Add time_zone column to events table
ALTER TABLE public.events 
ADD COLUMN time_zone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.events.time_zone IS 'IANA timezone identifier for the event location (e.g., "America/Los_Angeles"). All schedule times are rendered in this timezone.';

-- Create an index for timezone-based queries
CREATE INDEX IF NOT EXISTS idx_events_time_zone ON public.events(time_zone);

-- Add a check constraint to ensure valid IANA timezone format
-- This will help catch obviously invalid values during development
ALTER TABLE public.events 
ADD CONSTRAINT check_time_zone_format 
CHECK (
  time_zone IS NULL OR 
  (
    time_zone ~ '^[A-Za-z_]+/[A-Za-z_]+$' AND  -- Basic IANA format check
    length(time_zone) BETWEEN 3 AND 50         -- Reasonable length limits
  )
);

COMMIT;
