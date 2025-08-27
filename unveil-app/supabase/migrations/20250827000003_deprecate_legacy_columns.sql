-- Migration: Add Deprecation Comments to Legacy Columns
-- Date: 2025-08-27
-- Purpose: Mark deprecated columns with structured comments
-- 
-- AUDIT REFERENCE: docs/audit/versioned-functions-inventory.json
-- DEPRECATION CANDIDATES: Legacy analytics columns marked as unused
--
-- Items to deprecate:
-- - delivered_count column (legacy analytics field, unused)
-- - failed_count column (legacy analytics field, unused)
--
-- NOTE: get_guest_event_messages_v1 does not exist (already cleaned up)

BEGIN;

-- Add deprecation comments to legacy analytics columns
COMMENT ON COLUMN public.messages.delivered_count IS 
'DEPRECATED: Legacy analytics field marked as unused. Do not rely on this column for new features. Use message_deliveries table for accurate delivery tracking.';

COMMENT ON COLUMN public.messages.failed_count IS 
'DEPRECATED: Legacy analytics field marked as unused. Do not rely on this column for new features. Use message_deliveries table for accurate failure tracking.';

-- Log deprecation actions
DO $$
BEGIN
  RAISE NOTICE 'Deprecation comments added successfully';
  RAISE NOTICE 'Deprecated: messages.delivered_count, messages.failed_count (unused analytics)';
  RAISE NOTICE 'Current canonical: get_guest_event_messages_v2 (active, stable)';
  RAISE NOTICE 'Note: v1 and legacy functions already cleaned up in previous migrations';
END $$;

COMMIT;
