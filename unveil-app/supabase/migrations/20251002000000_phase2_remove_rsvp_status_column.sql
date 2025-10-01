-- Migration: Phase 2 - Remove rsvp_status column (ONLY run after Phase 1 is deployed and verified)
-- Purpose: Atomic removal of legacy rsvp_status column with analyst compatibility view
-- Date: 2025-10-02
-- Phase: 2 of 2 (Phase 1 must be deployed first)

-- SAFETY CHECK: Ensure Phase 1 RPC function is deployed
DO $$
BEGIN
  -- Verify the RPC function has been updated to use declined_at
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
    AND p.proname = 'resolve_message_recipients'
    AND pg_get_functiondef(p.oid) LIKE '%declined_at%'
    AND pg_get_functiondef(p.oid) LIKE '%Phase 1 of rsvp_status removal%'
  ) THEN
    RAISE EXCEPTION 'Phase 1 migration must be deployed first. RPC function not updated.';
  END IF;
END $$;

BEGIN;

-- Safety: Ensure required indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_event_guests_event_id
  ON public.event_guests (event_id);

CREATE INDEX IF NOT EXISTS idx_event_guests_event_attending
  ON public.event_guests (event_id)
  WHERE declined_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_guests_event_declined
  ON public.event_guests (event_id)  
  WHERE declined_at IS NOT NULL;

-- Drop the legacy rsvp_status column
ALTER TABLE public.event_guests
  DROP COLUMN IF EXISTS rsvp_status;

-- Create analyst compatibility view for reporting/analytics
CREATE OR REPLACE VIEW public.event_guests_rsvp_compat AS
SELECT
  eg.*,
  -- Provide rsvp_status_compat for legacy analytics queries
  (CASE 
    WHEN eg.declined_at IS NULL THEN 'ATTENDING' 
    ELSE 'DECLINED' 
  END)::text as rsvp_status_compat,
  -- Additional computed fields for analytics
  (eg.declined_at IS NULL)::boolean as is_attending,
  (eg.declined_at IS NOT NULL)::boolean as is_declined
FROM public.event_guests eg
WHERE eg.removed_at IS NULL; -- Only include active guests

-- Add helpful comment for analysts
COMMENT ON VIEW public.event_guests_rsvp_compat IS 
'Compatibility view for analytics. Use rsvp_status_compat instead of rsvp_status. 
ATTENDING = declined_at IS NULL, DECLINED = declined_at IS NOT NULL.
Created during rsvp_status column removal on 2025-10-02.';

-- Grant appropriate permissions to the view
GRANT SELECT ON public.event_guests_rsvp_compat TO authenticated;

COMMIT;
