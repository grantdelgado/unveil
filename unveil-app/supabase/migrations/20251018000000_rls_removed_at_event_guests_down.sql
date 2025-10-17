-- ============================================================================
-- Rollback Migration: Restore original event_guests RLS policies
-- ============================================================================
--
-- Purpose: Revert the removed_at checks added in the forward migration
-- Restores previous behavior where removed guests could still read their records
--
-- Migration Date: October 18, 2025
-- Rollback for: 20251018000000_rls_removed_at_event_guests.sql

BEGIN;

-- ============================================================================
-- STEP 1: Drop hardened policies
-- ============================================================================

DROP POLICY IF EXISTS "event_guests_select_v2" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_update_v2" ON public.event_guests;

-- ============================================================================
-- STEP 2: Recreate original policies WITHOUT removed_at checks
-- ============================================================================

CREATE POLICY "event_guests_select_v2" ON public.event_guests
  FOR SELECT
  TO public
  USING (
    is_event_host(event_id) OR (user_id = auth.uid())
    -- Note: NO removed_at check (original behavior)
  );

COMMENT ON POLICY "event_guests_select_v2" ON public.event_guests IS
'Guests and hosts can read event_guests records. Rolled back to original behavior without removed_at check.';

CREATE POLICY "event_guests_update_v2" ON public.event_guests
  FOR UPDATE
  TO public
  USING (
    is_event_host(event_id) OR (user_id = auth.uid())
    -- Note: NO removed_at check (original behavior)
  )
  WITH CHECK (
    is_event_host(event_id) OR (user_id = auth.uid())
    -- Note: NO removed_at check (original behavior)
  );

COMMENT ON POLICY "event_guests_update_v2" ON public.event_guests IS
'Guests can update their own records, hosts can update all guests. Rolled back to original behavior without removed_at check.';

COMMIT;

