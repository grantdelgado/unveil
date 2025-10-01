-- ROLLBACK Migration: Restore rsvp_status column (Emergency rollback for Phase 2)
-- Purpose: Instant rollback if Phase 2 column removal causes issues
-- Date: 2025-10-02
-- Usage: Run this if Phase 2 needs to be rolled back

BEGIN;

-- Re-add the rsvp_status column
ALTER TABLE public.event_guests 
ADD COLUMN IF NOT EXISTS rsvp_status text;

-- Backfill rsvp_status from declined_at (preserving the canonical logic)
UPDATE public.event_guests eg
SET rsvp_status = CASE 
  WHEN eg.declined_at IS NULL THEN 'ATTENDING' 
  ELSE 'DECLINED' 
END
WHERE rsvp_status IS NULL; -- Only update if not already set

-- Drop the compatibility view since we have the real column back
DROP VIEW IF EXISTS public.event_guests_rsvp_compat;

-- Add comment documenting the rollback
COMMENT ON COLUMN public.event_guests.rsvp_status IS 
'Legacy RSVP status column. RESTORED via rollback on 2025-10-02. 
Canonical source is declined_at field. This column is backfilled from declined_at.';

COMMIT;
