-- Migration: Immediate Drop of RSVP Compatibility View
-- Purpose: Remove event_guests_rsvp_compat view immediately (moved up from 2025-10-30)
-- Date: 2025-10-01
-- 
-- CONFIRMED SAFE:
-- ✅ Zero functional usage in app code (grep verified)
-- ✅ Phase 1/2 migrations complete - all code uses declined_at + sms_opt_out
-- ✅ Instant rollback available in 20251001120001_rollback_restore_rsvp_compat_view.sql

BEGIN;

-- Drop the compatibility view
DROP VIEW IF EXISTS public.event_guests_rsvp_compat;

COMMIT;
