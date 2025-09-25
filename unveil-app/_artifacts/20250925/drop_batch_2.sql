-- Batch 2: Events and Event Guests Indexes (Medium Confidence)
-- Event-related tables with unused tracking features
-- Expected storage savings: ~0.12 MB

-- ==================================================
-- Events Table - 2 unused indexes
-- ==================================================

-- 0 scans, timezone queries not used in application
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_time_zone;

-- 0 scans, duplicate of unique creation_key index
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_creation_key_lookup;

-- ==================================================
-- Event Guests Table - 3 unused tracking indexes
-- ==================================================

-- 0 scans, decline tracking feature unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_declined_at;

-- 0 scans, removal tracking unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_removed_at;

-- 0 scans, carrier opt-out tracking unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_carrier_opted_out_at;

-- ==================================================
-- Users Table - 1 unused index
-- ==================================================

-- 0 scans, SMS consent date queries unused
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_sms_consent_given_at;

-- ==================================================
-- Post-Drop Analysis
-- ==================================================

-- Update table statistics after index drops
ANALYZE public.events;
ANALYZE public.event_guests;  
ANALYZE public.users;

-- Verify remaining critical indexes are intact
SELECT 
  schemaname,
  tablename, 
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('events', 'event_guests', 'users')
  AND indexname IN (
    'events_pkey',
    'idx_events_host',
    'event_guests_pkey',
    'unique_event_guest_user',
    'idx_event_guests_user_id',
    'users_pkey',
    'users_phone_key'
  )
ORDER BY tablename, indexname;
