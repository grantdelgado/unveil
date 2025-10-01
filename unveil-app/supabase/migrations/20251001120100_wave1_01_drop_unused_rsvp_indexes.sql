-- Migration: Wave 1 Cleanup - Drop Unused RSVP-Lite Indexes
-- Purpose: Remove indexes obsoleted by RSVP-Lite migration (declined_at logic)
-- Date: 2025-10-01
-- 
-- CONFIRMED SAFE:
-- ✅ Both indexes have 0 scans in pg_stat_user_indexes
-- ✅ RSVP-Lite migration completed - these indexes are no longer needed
-- ✅ Equivalent functionality covered by other indexes on event_guests

BEGIN;

-- Drop unused declined_at indexes (obsoleted by RSVP-Lite migration)
-- These were created for the old rsvp_status logic but are no longer used
DROP INDEX IF EXISTS public.idx_event_guests_declined_at_null;
DROP INDEX IF EXISTS public.idx_event_guests_declined_at_not_null;

COMMIT;
