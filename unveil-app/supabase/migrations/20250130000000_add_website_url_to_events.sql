-- Add website_url column to events table
-- This allows hosts to add a wedding website link for guests

BEGIN;

-- Add website_url column to events table
ALTER TABLE public.events 
ADD COLUMN website_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.events.website_url IS 'Optional wedding website URL displayed to guests';

COMMIT;
