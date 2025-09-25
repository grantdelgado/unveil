-- Batch 1: Message Delivery Indexes (Highest Confidence)
-- Write-heavy tables with clear 0-scan unused indexes
-- Expected storage savings: ~0.11 MB

-- ==================================================
-- Message Deliveries Table - 4 unused indexes
-- ==================================================

-- 0 scans, potential duplicate functionality
DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_message_user;

-- 0 scans, migration artifact for phone lookups  
DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_phone_user_null;

-- 0 scans, SMS provider queries unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_sms_provider;

-- 0 scans, scheduled message delivery unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_scheduled_message;

-- ==================================================
-- Messages Table - 1 unused index
-- ==================================================

-- 0 scans, delivery tracking feature unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_messages_delivery_tracking;

-- ==================================================
-- Post-Drop Analysis
-- ==================================================

-- Update table statistics after index drops
ANALYZE public.message_deliveries;
ANALYZE public.messages;

-- Verify remaining critical indexes are intact
SELECT 
  schemaname,
  tablename, 
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('message_deliveries', 'messages')
  AND indexname IN (
    'unique_message_guest_delivery',
    'message_deliveries_pkey', 
    'messages_pkey',
    'idx_messages_event_created_id'
  )
ORDER BY tablename, indexname;
