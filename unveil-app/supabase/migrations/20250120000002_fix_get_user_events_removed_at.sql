-- Fix get_user_events to exclude removed guests from event list
-- This ensures removed guests don't see events they were removed from

CREATE OR REPLACE FUNCTION public.get_user_events(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, title text, event_date date, location text, role text, rsvp_status text, is_host boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN 'host'::TEXT
      ELSE COALESCE(eg.role, 'guest'::TEXT)
    END,
    eg.rsvp_status,
    (e.host_user_id = COALESCE(user_id_param, auth.uid()))
  FROM public.events e
  LEFT JOIN public.event_guests eg ON (
    eg.event_id = e.id 
    AND eg.user_id = COALESCE(user_id_param, auth.uid())
    AND eg.removed_at IS NULL  -- Only include active memberships
  )
  WHERE 
    e.host_user_id = COALESCE(user_id_param, auth.uid()) 
    OR (eg.user_id = COALESCE(user_id_param, auth.uid()) AND eg.removed_at IS NULL)
  ORDER BY e.event_date DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_events(uuid) IS 
'Returns events for a user - hosted events and events where user has active (non-removed) guest membership';
