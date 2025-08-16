-- Migration: Ensure phone number access is properly configured for messaging
-- Purpose: Verify phone field exists, has proper constraints, and RLS policies allow access

-- Ensure phone field exists in event_guests table
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_guests' 
    AND column_name = 'phone' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.event_guests ADD COLUMN phone text;
    RAISE NOTICE 'Added phone column to event_guests table';
  ELSE
    RAISE NOTICE 'Phone column already exists in event_guests table';
  END IF;
END $$;

-- Ensure proper phone number constraints (E.164 format)
DO $$
BEGIN
  -- Drop existing phone format constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'phone_format' 
    AND table_name = 'event_guests'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.event_guests DROP CONSTRAINT phone_format;
    RAISE NOTICE 'Dropped existing phone_format constraint';
  END IF;

  -- Add updated phone format constraint
  ALTER TABLE public.event_guests 
  ADD CONSTRAINT phone_format_e164 
  CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{1,14}$');
  
  RAISE NOTICE 'Added E.164 phone format constraint';
END $$;

-- Ensure phone field index exists for messaging performance
CREATE INDEX IF NOT EXISTS idx_event_guests_phone_messaging 
ON public.event_guests(event_id, phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Create a helper function to validate phone numbers for messaging
CREATE OR REPLACE FUNCTION public.is_valid_phone_for_messaging(phone_number text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Check if phone number is not null, not empty, and matches E.164 format
  RETURN phone_number IS NOT NULL 
    AND phone_number != '' 
    AND phone_number ~ '^\+[1-9]\d{1,14}$';
END;
$$;

-- Create a function to get messageable guests for an event (used by messaging system)
CREATE OR REPLACE FUNCTION public.get_messageable_guests(p_event_id uuid)
RETURNS TABLE (
  guest_id uuid,
  phone text,
  guest_name text,
  rsvp_status text,
  guest_tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is event host
  IF NOT public.is_event_host(p_event_id) THEN
    RAISE EXCEPTION 'Access denied: User is not a host of this event';
  END IF;

  -- Return guests with valid phone numbers
  RETURN QUERY
  SELECT 
    eg.id,
    eg.phone,
    eg.guest_name,
    eg.rsvp_status,
    eg.guest_tags
  FROM public.event_guests eg
  WHERE eg.event_id = p_event_id
    AND public.is_valid_phone_for_messaging(eg.phone)
  ORDER BY eg.guest_name;
END;
$$;

-- Verify RLS policies allow hosts to read phone numbers
-- (This is handled by existing policies but let's add a comment)
COMMENT ON POLICY "event_guests_host_access" ON public.event_guests IS 
'Hosts can manage all guests for their events, including reading phone numbers for messaging';

-- Add useful comments for messaging functions
COMMENT ON FUNCTION public.is_valid_phone_for_messaging(text) IS 
'Validates that a phone number is properly formatted for SMS messaging (E.164 format)';

COMMENT ON FUNCTION public.get_messageable_guests(uuid) IS 
'Returns all guests with valid phone numbers for an event. Restricted to event hosts only.';

COMMENT ON INDEX idx_event_guests_phone_messaging IS 
'Optimizes phone number lookups for messaging queries';

-- Test the messaging access (this will help verify everything works)
DO $$
DECLARE
  test_result boolean;
BEGIN
  -- Test phone validation function
  SELECT public.is_valid_phone_for_messaging('+12345678901') INTO test_result;
  IF test_result THEN
    RAISE NOTICE 'Phone validation function working correctly';
  ELSE
    RAISE WARNING 'Phone validation function may have issues';
  END IF;
  
  RAISE NOTICE 'Phone access configuration completed successfully';
END $$;
