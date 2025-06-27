-- Migration: Cleanup RLS Policies and Update Helper Functions
-- Purpose: Remove references to event_participants and consolidate event_guests policies

-- First, drop problematic policies that reference event_participants
DROP POLICY IF EXISTS "event_guests_guest_read_own" ON public.event_guests;

-- Update helper functions to use event_guests instead of event_participants
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id
    WHERE e.id = p_event_id 
    AND (
      e.host_user_id = auth.uid() 
      OR eg.user_id = auth.uid()
      OR (eg.phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (
      e.host_user_id = auth.uid() 
      OR eg.role = 'host'
    )
  );
END;
$$;

-- Create a new helper function specifically for guest access that supports both user_id and phone
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_guests eg
    WHERE eg.event_id = p_event_id 
    AND (
      eg.user_id = auth.uid()
      OR (eg.phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
    )
  );
END;
$$;

-- Drop redundant/overlapping policies on event_guests
DROP POLICY IF EXISTS "Guests can view and update their own records" ON public.event_guests;
DROP POLICY IF EXISTS "Hosts can manage guests for their events" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_host_full_access" ON public.event_guests;

-- Create consolidated, clean RLS policies for event_guests
-- Policy 1: Hosts have full access to manage guests for their events
CREATE POLICY "event_guests_host_access" ON public.event_guests
FOR ALL
TO authenticated
USING (is_event_host(event_id))
WITH CHECK (is_event_host(event_id));

-- Policy 2: Guests can read and update their own records (supports both user_id and phone)
CREATE POLICY "event_guests_own_access" ON public.event_guests
FOR ALL
TO authenticated, anon
USING (
  user_id = auth.uid() 
  OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
)
WITH CHECK (
  user_id = auth.uid() 
  OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
);

-- Policy 3: Allow read access for event participants (for messaging, etc.)
CREATE POLICY "event_guests_read_event_access" ON public.event_guests
FOR SELECT
TO authenticated, anon
USING (can_access_event(event_id));

-- Ensure RLS is enabled on event_guests
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON FUNCTION public.can_access_event(uuid) IS 'Check if user can access an event (as host or guest via user_id or phone)';
COMMENT ON FUNCTION public.is_event_host(uuid) IS 'Check if user is a host of an event (primary host or guest with host role)';
COMMENT ON FUNCTION public.is_event_guest(uuid) IS 'Check if user is a guest of an event (via user_id or phone)';

COMMENT ON POLICY "event_guests_host_access" ON public.event_guests IS 'Hosts can manage all guests for their events';
COMMENT ON POLICY "event_guests_own_access" ON public.event_guests IS 'Guests can manage their own records (supports user_id and phone access)';
COMMENT ON POLICY "event_guests_read_event_access" ON public.event_guests IS 'Allow reading guest records for messaging and analytics within events'; 