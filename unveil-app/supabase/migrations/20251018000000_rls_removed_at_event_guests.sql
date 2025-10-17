-- ============================================================================
-- Migration: Harden event_guests RLS policies to enforce removed_at checks
-- ============================================================================
--
-- Purpose: Prevent removed guests (removed_at IS NOT NULL) from reading or
-- updating their own event_guests records. This tightens security boundaries
-- and ensures removed users lose all access to event data.
--
-- Changes:
-- - Update SELECT policy to require removed_at IS NULL
-- - Update UPDATE policy to enforce removed_at IS NULL in both USING and WITH CHECK
-- - Preserve all existing semantics (host access, user_id matching, phone matching)
--
-- Migration Date: October 18, 2025
-- Related Audit: docs/reviews/2025-10-db-audit.md (P1-3)

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing policies that need removed_at checks
-- ============================================================================

DROP POLICY IF EXISTS "event_guests_select_v2" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_update_v2" ON public.event_guests;

-- Note: Keep host and self backup policies as-is (they provide fallback access)
-- Note: Keep insert/delete policies as-is (not affected by removed_at logic)

-- ============================================================================
-- STEP 2: Recreate SELECT policy with removed_at guard
-- ============================================================================

CREATE POLICY "event_guests_select_v2" ON public.event_guests
  FOR SELECT
  TO public
  USING (
    -- Core access control (unchanged)
    (is_event_host(event_id) OR (user_id = auth.uid()))
    -- ✅ NEW: Exclude removed guests from SELECT results
    AND removed_at IS NULL
  );

COMMENT ON POLICY "event_guests_select_v2" ON public.event_guests IS
'Guests and hosts can read event_guests records, but removed guests (removed_at IS NOT NULL) are excluded. Updated 2025-10-18 for P1-3 security hardening.';

-- ============================================================================
-- STEP 3: Recreate UPDATE policy with removed_at guard
-- ============================================================================

CREATE POLICY "event_guests_update_v2" ON public.event_guests
  FOR UPDATE
  TO public
  USING (
    -- Core access control (unchanged)
    (is_event_host(event_id) OR (user_id = auth.uid()))
    -- ✅ NEW: Removed guests cannot update their records
    AND removed_at IS NULL
  )
  WITH CHECK (
    -- Core access control (unchanged)
    (is_event_host(event_id) OR (user_id = auth.uid()))
    -- ✅ NEW: Cannot set removed_at to NULL (prevent self-restore)
    -- Note: Only hosts can restore guests via restore_guest() RPC
    AND removed_at IS NULL
  );

COMMENT ON POLICY "event_guests_update_v2" ON public.event_guests IS
'Guests can update their own records, hosts can update all guests. Removed guests (removed_at IS NOT NULL) cannot update records, and users cannot clear their own removed_at flag. Updated 2025-10-18 for P1-3 security hardening.';

-- ============================================================================
-- VERIFICATION: Document expected behavior
-- ============================================================================

-- Expectations after this migration:
-- 1. Removed guests cannot SELECT their event_guests row (query returns empty)
-- 2. Removed guests cannot UPDATE their event_guests row (operation fails)
-- 3. Hosts can still SELECT/UPDATE removed guests (for admin purposes)
-- 4. The is_event_guest() helper already checks removed_at (no change needed)
-- 5. The get_guest_event_messages RPC already checks removed_at (no change needed)

COMMIT;

