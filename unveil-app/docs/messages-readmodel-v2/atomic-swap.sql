-- ============================================================================
-- Messages Read-Model V2 - Atomic Swap Plan
-- ============================================================================
-- Date: January 29, 2025
-- Purpose: Single-transaction RPC swap with rollback capability
-- Approach: Rename functions atomically, no UI changes required

-- ============================================================================
-- PRE-SWAP VERIFICATION
-- ============================================================================

-- Verify both functions exist before swap
SELECT 
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_guest_event_messages', 'get_guest_event_messages_v2')
ORDER BY routine_name;

-- Expected result: Both functions should exist
-- - get_guest_event_messages (current/v1)
-- - get_guest_event_messages_v2 (new implementation)

-- ============================================================================
-- ATOMIC SWAP TRANSACTION
-- ============================================================================

BEGIN;

-- Step 1: Rename current function to legacy
ALTER FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) 
RENAME TO get_guest_event_messages_legacy;

-- Step 2: Rename v2 to canonical name
ALTER FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) 
RENAME TO get_guest_event_messages;

-- Step 3: Update function comments
COMMENT ON FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) IS 
'Canonical guest message feed with union read model: Direct from deliveries + Announcements/Channels from messages table. Swapped from v2 on 2025-01-29.';

COMMENT ON FUNCTION public.get_guest_event_messages_legacy(uuid, int, timestamptz) IS 
'Legacy guest message feed (delivery-only). Renamed during v2 swap on 2025-01-29. Available for rollback.';

COMMIT;

-- ============================================================================
-- POST-SWAP VERIFICATION
-- ============================================================================

-- Verify swap completed successfully
SELECT 
    routine_name,
    routine_type,
    data_type,
    specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_guest_event_messages', 'get_guest_event_messages_legacy')
ORDER BY routine_name;

-- Expected result after swap:
-- - get_guest_event_messages (now v2 implementation)
-- - get_guest_event_messages_legacy (original v1 implementation)

-- Test the swapped function with a sample call
-- SELECT * FROM public.get_guest_event_messages(
--     'your-test-event-id'::uuid, 
--     10, 
--     NULL
-- );

-- ============================================================================
-- ROLLBACK TRANSACTION (if needed)
-- ============================================================================

-- Use this transaction to rollback the swap if issues are detected

/*
BEGIN;

-- Step 1: Rename canonical back to v2
ALTER FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) 
RENAME TO get_guest_event_messages_v2;

-- Step 2: Rename legacy back to canonical
ALTER FUNCTION public.get_guest_event_messages_legacy(uuid, int, timestamptz) 
RENAME TO get_guest_event_messages;

-- Step 3: Restore original comments
COMMENT ON FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) IS 
'Canonical guest message feed that returns only messages delivered to the authenticated user for a specific event. Enforces event membership and proper security boundaries.';

COMMENT ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) IS 
'V2 guest message feed with union read model (rolled back). Available for future re-implementation.';

COMMIT;
*/

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Monitor function usage after swap (run periodically)
-- Note: This requires pg_stat_statements extension

/*
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%get_guest_event_messages%'
ORDER BY calls DESC;
*/

-- Monitor for errors in logs
-- Check Supabase logs for any function execution errors after swap

-- ============================================================================
-- CLEANUP (after 48-hour observation period)
-- ============================================================================

-- After confirming v2 works correctly, optionally remove legacy function

/*
-- Only run this after confirming v2 is stable
DROP FUNCTION IF EXISTS public.get_guest_event_messages_legacy(uuid, int, timestamptz);
*/

-- ============================================================================
-- GO/NO-GO CHECKLIST
-- ============================================================================

/*
PRE-SWAP CHECKLIST:
□ RLS probes pass for host/guest/non-member
□ Shadow diff shows only expected additions (Announcements/Channels), no missing Directs  
□ Twilio parity test shows identical delivery creation and SMS sends
□ Indexes present; RPC v2 explain plan is acceptable
□ Rollback command tested (rename back)

POST-SWAP MONITORING:
□ No function execution errors in logs
□ Guest UI loads correctly
□ Message counts match expectations (v2 >= v1)
□ SMS delivery volume unchanged
□ Performance within acceptable range (<500ms)

ROLLBACK TRIGGERS:
□ Function execution errors
□ Missing direct messages
□ UI loading failures  
□ SMS volume changes
□ Performance degradation >50%
*/
