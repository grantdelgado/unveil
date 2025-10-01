-- Migration: Sunset RSVP Compatibility View
-- Purpose: Remove event_guests_rsvp_compat view after analyst migration period
-- Date: 2025-10-30 (4 weeks after Phase 2)
-- 
-- IMPORTANT: Only run this after confirming:
-- 1. All analytics queries have been migrated to use declined_at directly
-- 2. No BI/ETL tools are using rsvp_status_compat field
-- 3. Ops team has confirmed migration is complete

-- Safety check: Ensure no recent queries against the compat view
DO $$
BEGIN
  -- This is a placeholder check - implement based on your query logging
  -- IF recent_queries_exist('event_guests_rsvp_compat') THEN
  --   RAISE EXCEPTION 'Recent queries detected against compat view. Migration not complete.';
  -- END IF;
  
  RAISE NOTICE 'Proceeding with compat view removal. Ensure analytics migration is complete.';
END $$;

BEGIN;

-- Drop the compatibility view
DROP VIEW IF EXISTS public.event_guests_rsvp_compat;

-- Log the removal for audit trail
INSERT INTO public.migration_log (
  migration_name,
  description,
  applied_at,
  applied_by
) VALUES (
  'sunset_rsvp_compat_view',
  'Removed event_guests_rsvp_compat view after analyst migration period',
  NOW(),
  'system'
) ON CONFLICT DO NOTHING;

COMMIT;

-- Add comment for future reference
COMMENT ON TABLE public.event_guests IS 
'RSVP model uses declined_at + sms_opt_out fields. 
Compatibility view removed 2025-10-30 after analyst migration.
Use: declined_at IS NULL = attending, declined_at IS NOT NULL = declined';
