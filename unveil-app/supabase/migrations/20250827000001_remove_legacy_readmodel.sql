-- Migration: Remove Legacy Read-Model Functions and Views
-- Date: 2025-08-27
-- Purpose: Clean up unused legacy functions identified in versioned functions audit
-- 
-- AUDIT REFERENCE: docs/audit/versioned-functions-inventory.json
-- SAFE REMOVALS: Functions with zero active callers and no dependencies
--
-- Items to remove:
-- - get_guest_event_messages_legacy (zero callers, superseded by v2)
-- - message_delivery_rollups_v1 view (marked unused in migrations)
-- - get_message_rollups(uuid) RPC (dependent on rollups view)

BEGIN;

-- Emit notices for visibility during deployment
DO $$
BEGIN
  RAISE NOTICE 'Starting legacy read-model cleanup...';
  RAISE NOTICE 'Checking for get_guest_event_messages_legacy function...';
END $$;

-- 1) Drop legacy guest messages function (if exists)
-- This function was completely superseded by v2 and has zero active callers
DROP FUNCTION IF EXISTS public.get_guest_event_messages_legacy(uuid, int, timestamptz);
DROP FUNCTION IF EXISTS public.get_guest_event_messages_legacy(uuid, int, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_guest_event_messages_legacy(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.get_guest_event_messages_legacy(uuid, integer, timestamp with time zone);

DO $$
BEGIN
  RAISE NOTICE 'Checking for message_delivery_rollups_v1 view...';
END $$;

-- 2) Drop unused analytics view and dependent RPC
-- These were created for analytics but never adopted according to audit
DROP VIEW IF EXISTS public.message_delivery_rollups_v1 CASCADE;
DROP FUNCTION IF EXISTS public.get_message_rollups(uuid);

DO $$
BEGIN
  RAISE NOTICE 'Legacy read-model cleanup completed successfully';
  RAISE NOTICE 'Removed: get_guest_event_messages_legacy, message_delivery_rollups_v1, get_message_rollups';
  RAISE NOTICE 'Current canonical function: get_guest_event_messages_v2 (unchanged)';
END $$;

COMMIT;

-- DOWN migration: Create deprecated stubs for rollback safety
-- These stubs return empty results and are clearly marked as deprecated

-- Note: Uncomment and run these if rollback is needed
/*
BEGIN;

-- Recreate legacy function as deprecated stub
CREATE OR REPLACE FUNCTION public.get_guest_event_messages_legacy(
  p_event_id uuid, 
  p_limit int DEFAULT 50, 
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(
  message_id uuid,
  content text,
  created_at timestamptz,
  delivery_status text,
  sender_name text
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  -- DEPRECATED STUB: This function was removed in cleanup
  -- Use get_guest_event_messages_v2 instead
  SELECT 
    NULL::uuid as message_id,
    'DEPRECATED FUNCTION'::text as content,
    NULL::timestamptz as created_at,
    'deprecated'::text as delivery_status,
    'System'::text as sender_name
  WHERE FALSE; -- Always returns empty
$$;

COMMENT ON FUNCTION public.get_guest_event_messages_legacy IS 
'DEPRECATED STUB: Function removed in legacy cleanup. Use get_guest_event_messages_v2.';

-- Recreate rollup view as deprecated stub
CREATE OR REPLACE VIEW public.message_delivery_rollups_v1 AS
SELECT 
  NULL::uuid AS message_id,
  0::int AS delivered_count,
  0::int AS failed_count,
  NULL::timestamptz AS delivered_at
WHERE FALSE; -- Always empty

COMMENT ON VIEW public.message_delivery_rollups_v1 IS 
'DEPRECATED STUB: View removed in legacy cleanup. Analytics data available through other means.';

-- Recreate rollup function as deprecated stub
CREATE OR REPLACE FUNCTION public.get_message_rollups(p_event_id uuid)
RETURNS TABLE(
  message_id uuid, 
  delivered_count int, 
  failed_count int, 
  delivered_at timestamptz
) 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  -- DEPRECATED STUB: Function removed in cleanup
  SELECT 
    NULL::uuid,
    0::int,
    0::int,
    NULL::timestamptz
  WHERE FALSE; -- Always returns empty
$$;

COMMENT ON FUNCTION public.get_message_rollups IS 
'DEPRECATED STUB: Function removed in legacy cleanup. Use current analytics methods.';

COMMIT;
*/
