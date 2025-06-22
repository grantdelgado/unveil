-- Fix RLS policies for events table to allow INSERT operations
-- The previous policy used is_event_host(id) for ALL operations, but this fails on INSERT
-- because the event ID doesn't exist yet during insertion

BEGIN;

-- Drop the problematic policies
DROP POLICY IF EXISTS "events_manage_own" ON public.events;
DROP POLICY IF EXISTS "events_select_accessible" ON public.events;

-- Create separate policies for different operations
-- INSERT: Allow users to create events for themselves
CREATE POLICY "events_insert_own" ON public.events 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (host_user_id = auth.uid());

-- SELECT: Allow access to public events or events user is involved in
CREATE POLICY "events_select_accessible" ON public.events 
  FOR SELECT 
  TO authenticated 
  USING (is_public = true OR can_access_event(id));

-- UPDATE/DELETE: Allow hosts to manage their events
CREATE POLICY "events_update_delete_own" ON public.events 
  FOR UPDATE 
  TO authenticated 
  USING (is_event_host(id));

CREATE POLICY "events_delete_own" ON public.events 
  FOR DELETE 
  TO authenticated 
  USING (is_event_host(id));

COMMIT; 