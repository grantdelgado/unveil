-- Fix get_user_events function to prevent duplicate results
-- The issue was that hosts could appear both as host_user_id AND as event_guests
-- This improved version uses DISTINCT and better logic to prevent duplicates

CREATE OR REPLACE FUNCTION public.get_user_events(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, title text, event_date date, location text, role text, rsvp_status text, is_host boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN 'host'::TEXT
      ELSE COALESCE(eg.role, 'guest'::TEXT)
    END,
    -- For hosts, don't show guest RSVP status (they don't RSVP to their own events)
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN NULL::TEXT
      ELSE eg.rsvp_status
    END,
    (e.host_user_id = COALESCE(user_id_param, auth.uid()))
  FROM public.events e
  LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = COALESCE(user_id_param, auth.uid())
  WHERE e.host_user_id = COALESCE(user_id_param, auth.uid()) OR eg.user_id = COALESCE(user_id_param, auth.uid())
  ORDER BY e.event_date DESC;
END;
$function$;

-- Add unique constraint to prevent future duplicate guest records
-- This constraint ensures a user can only have one guest record per event
ALTER TABLE public.event_guests 
DROP CONSTRAINT IF EXISTS unique_event_guest_user;

ALTER TABLE public.event_guests 
ADD CONSTRAINT unique_event_guest_user 
UNIQUE (event_id, user_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_event_guest_user ON public.event_guests IS 
'Prevents duplicate guest records for the same user and event combination';
