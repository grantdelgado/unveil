-- ROLLBACK Migration: Instant Restore of RSVP Compatibility View
-- Purpose: Emergency restore if compat view removal causes unexpected issues
-- Date: 2025-10-01
-- Usage: Run this immediately if analytics queries break after view removal

BEGIN;

-- Recreate the compatibility view with exact original definition
CREATE OR REPLACE VIEW public.event_guests_rsvp_compat AS
SELECT
  eg.*,
  (CASE WHEN eg.declined_at IS NULL THEN 'ATTENDING' ELSE 'DECLINED' END)::text as rsvp_status_compat
FROM public.event_guests eg;

COMMIT;
