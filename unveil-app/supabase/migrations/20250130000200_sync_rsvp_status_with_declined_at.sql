-- Sync rsvp_status with declined_at for RSVP-Lite consistency
-- This ensures the dashboard shows accurate counts

-- First, update existing data to sync rsvp_status with declined_at (RSVP-Lite logic)
UPDATE public.event_guests 
SET rsvp_status = CASE 
  WHEN declined_at IS NOT NULL THEN 'declined'
  WHEN invited_at IS NOT NULL THEN 'attending'  -- Invited guests are attending by default in RSVP-Lite
  ELSE 'pending'  -- Not yet invited
END
WHERE rsvp_status != CASE 
  WHEN declined_at IS NOT NULL THEN 'declined'
  WHEN invited_at IS NOT NULL THEN 'attending'
  ELSE 'pending'
END;

-- Create trigger to keep rsvp_status in sync with declined_at going forward
CREATE OR REPLACE FUNCTION public.sync_rsvp_status_with_declined_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync rsvp_status based on RSVP-Lite logic
  NEW.rsvp_status = CASE 
    WHEN NEW.declined_at IS NOT NULL THEN 'declined'
    WHEN NEW.invited_at IS NOT NULL THEN 'attending'  -- Invited = attending by default
    ELSE 'pending'  -- Not yet invited
  END;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to event_guests table
DROP TRIGGER IF EXISTS sync_rsvp_status_trigger ON public.event_guests;
CREATE TRIGGER sync_rsvp_status_trigger
  BEFORE INSERT OR UPDATE ON public.event_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rsvp_status_with_declined_at();

-- Update the RPC to use the correct RSVP-Lite logic with synced rsvp_status
CREATE OR REPLACE FUNCTION public.get_event_guest_counts(p_event_id uuid)
RETURNS TABLE(
    total_guests integer,
    total_invited integer,
    attending integer,
    declined integer,
    not_invited integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user can access this event
    IF NOT public.can_access_event(p_event_id) THEN
        RAISE EXCEPTION 'Access denied to event %', p_event_id;
    END IF;

    RETURN QUERY
    SELECT 
        -- Total guests (includes hosts for visibility)
        COUNT(*)::integer as total_guests,
        
        -- Invitable counts exclude hosts (following RSVP-Lite logic)
        COUNT(*) FILTER (
            WHERE invited_at IS NOT NULL AND role != 'host'
        )::integer as total_invited,
        
        -- Attending: invited guests who haven't declined (RSVP-Lite default)
        COUNT(*) FILTER (
            WHERE invited_at IS NOT NULL AND declined_at IS NULL AND role != 'host'
        )::integer as attending,
        
        -- Declined: explicitly declined guests
        COUNT(*) FILTER (
            WHERE declined_at IS NOT NULL AND role != 'host'
        )::integer as declined,
        
        -- Not invited: guests not yet invited
        COUNT(*) FILTER (
            WHERE invited_at IS NULL AND declined_at IS NULL AND role != 'host'
        )::integer as not_invited
        
    FROM public.event_guests
    WHERE event_id = p_event_id 
      AND removed_at IS NULL;
END;
$$;

-- Update comment to reflect RSVP-Lite logic
COMMENT ON FUNCTION public.get_event_guest_counts(uuid) IS 
'Returns guest counts using RSVP-Lite logic: invited guests are attending by default unless they explicitly decline. Hosts are included in total_guests but excluded from invitable counts.';

-- Log the sync operation
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'RSVP-Lite sync completed: Updated % guest records to sync rsvp_status with declined_at', v_updated_count;
  RAISE NOTICE 'Going forward, rsvp_status will be automatically synced via trigger';
END;
$$;
