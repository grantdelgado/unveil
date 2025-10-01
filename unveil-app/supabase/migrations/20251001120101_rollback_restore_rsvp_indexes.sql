-- ROLLBACK Migration: Restore RSVP-Lite Indexes
-- Purpose: Emergency restore if declined_at indexes are needed
-- Date: 2025-10-01
-- Usage: Run this if queries show performance regressions after index removal

BEGIN;

-- Recreate the declined_at indexes with exact original definitions
CREATE INDEX IF NOT EXISTS idx_event_guests_declined_at_null 
  ON public.event_guests USING btree (event_id, declined_at) 
  WHERE (declined_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_event_guests_declined_at_not_null 
  ON public.event_guests USING btree (event_id, declined_at) 
  WHERE (declined_at IS NOT NULL);

COMMIT;
