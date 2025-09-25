-- Batch 3: Scheduled Messages and Duplicates (Final Cleanup)
-- Remaining unused indexes and duplicate cleanup
-- Expected storage savings: ~0.12 MB

-- ==================================================
-- Scheduled Messages Table - 5 unused indexes
-- ==================================================

-- 0 scans, sender user queries unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_sender_user_id;

-- 0 scans, trigger source queries unused (duplicate functionality)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_trigger_source;

-- 0 scans, timezone queries unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_timezone;

-- 0 scans, recipient snapshot queries unused (GIN index)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_recipient_snapshot;

-- 0 scans, idempotency key unique constraint unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_idempotency;

-- ==================================================
-- Duplicate Index Cleanup
-- ==================================================

-- Drop non-unique duplicate of unique_event_guest_user
-- Both cover (event_id, user_id) but unique version is constraint-backed
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_event_user;

-- ==================================================
-- Post-Drop Analysis
-- ==================================================

-- Update table statistics after index drops
ANALYZE public.scheduled_messages;
ANALYZE public.event_guests;

-- Verify remaining critical indexes are intact
SELECT 
  schemaname,
  tablename, 
  indexname,
  pg_get_indexdef(indexname::regclass) as definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('scheduled_messages', 'event_guests')
  AND indexname IN (
    'scheduled_messages_pkey',
    'idx_scheduled_messages_event_id',
    'idx_scheduled_messages_processing',
    'unique_event_guest_user',
    'idx_event_guests_event_id'
  )
ORDER BY tablename, indexname;

-- Final constraint integrity check
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint  
WHERE conrelid = 'public.event_guests'::regclass
  AND contype IN ('p', 'u', 'f')
ORDER BY conname;
