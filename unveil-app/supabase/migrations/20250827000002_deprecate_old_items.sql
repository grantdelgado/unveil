-- Migration: Add Deprecation Comments to Legacy Items
-- Date: 2025-08-27
-- Purpose: Mark deprecated functions and fields with structured comments
-- 
-- AUDIT REFERENCE: docs/audit/versioned-functions-inventory.json
-- DEPRECATION CANDIDATES: Items with planned removal after stability period
--
-- Items to deprecate:
-- - get_guest_event_messages_v1 (emergency rollback only, remove after 6 months)
-- - delivered_count column (legacy analytics field, unused)
-- - failed_count column (legacy analytics field, unused)

BEGIN;

-- Add deprecation comment to v1 function (emergency rollback only)
COMMENT ON FUNCTION public.get_guest_event_messages_v1(uuid, int, timestamptz) IS 
'DEPRECATED: Emergency rollback function only. Use get_guest_event_messages_v2 for all new code. Planned removal after 6 months of V2 stability (target: March 2025).';

-- Add deprecation comments to legacy analytics columns
COMMENT ON COLUMN public.messages.delivered_count IS 
'DEPRECATED: Legacy analytics field marked as unused. Do not rely on this column for new features. Use message_deliveries table for accurate delivery tracking.';

COMMENT ON COLUMN public.messages.failed_count IS 
'DEPRECATED: Legacy analytics field marked as unused. Do not rely on this column for new features. Use message_deliveries table for accurate failure tracking.';

-- Log deprecation actions
DO $$
BEGIN
  RAISE NOTICE 'Deprecation comments added successfully';
  RAISE NOTICE 'Deprecated: get_guest_event_messages_v1 (rollback only, remove March 2025)';
  RAISE NOTICE 'Deprecated: messages.delivered_count, messages.failed_count (unused analytics)';
  RAISE NOTICE 'Current canonical: get_guest_event_messages_v2 (active, stable)';
END $$;

COMMIT;
