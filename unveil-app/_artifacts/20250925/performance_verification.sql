-- Performance Verification Queries
-- Run these queries before and after index drops to verify no regressions

-- ==================================================
-- BASELINE QUERY PERFORMANCE TESTS
-- ==================================================

-- Test 1: Last 50 messages by event (critical path)
-- Expected: Should use idx_messages_event_created_id
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, content, created_at, sender_user_id, message_type
FROM messages 
WHERE event_id = 'test-event-id-here'  -- Replace with actual event_id
ORDER BY created_at DESC, id DESC 
LIMIT 50;

-- Test 2: Message deliveries by message_id (high usage)
-- Expected: Should use idx_message_deliveries_message_id or unique_message_guest_delivery
EXPLAIN (ANALYZE, BUFFERS)
SELECT md.id, md.guest_id, md.user_id, md.status, md.delivered_at
FROM message_deliveries md
WHERE md.message_id = 'test-message-id-here'  -- Replace with actual message_id
ORDER BY md.created_at DESC;

-- Test 3: Guest lookup by event and phone (messaging critical path)  
-- Expected: Should use event_guests_event_id_phone_active_key or idx_event_guests_phone_messaging
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, phone, user_id, rsvp_status
FROM event_guests
WHERE event_id = 'test-event-id-here'  -- Replace with actual event_id
  AND phone = '+1234567890'  -- Replace with actual phone
  AND removed_at IS NULL;

-- Test 4: Media feed by event (common query)
-- Expected: Should use idx_media_event_created  
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, filename, file_size, content_type, created_at, uploader_user_id
FROM media
WHERE event_id = 'test-event-id-here'  -- Replace with actual event_id
ORDER BY created_at DESC
LIMIT 20;

-- Test 5: Host event lookup (high usage - 25k scans)
-- Expected: Should use idx_events_host
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, event_date, created_at
FROM events  
WHERE host_user_id = 'test-user-id-here'  -- Replace with actual user_id
ORDER BY created_at DESC;

-- Test 6: Scheduled message processing (critical for messaging system)
-- Expected: Should use idx_scheduled_messages_processing  
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, event_id, content, send_at, status
FROM scheduled_messages
WHERE status IN ('scheduled', 'sending')
  AND send_at <= NOW()
ORDER BY send_at ASC
LIMIT 100;

-- Test 7: Event guests by user (high usage - 4k scans)
-- Expected: Should use idx_event_guests_user_id
EXPLAIN (ANALYZE, BUFFERS) 
SELECT eg.event_id, eg.rsvp_status, e.name as event_name
FROM event_guests eg
JOIN events e ON e.id = eg.event_id  
WHERE eg.user_id = 'test-user-id-here'  -- Replace with actual user_id
  AND eg.removed_at IS NULL
ORDER BY e.event_date DESC;

-- ==================================================
-- INDEX USAGE VERIFICATION
-- ==================================================

-- Verify no critical indexes were accidentally dropped
SELECT 
  schemaname,
  tablename, 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'unique_message_guest_delivery',
    'idx_messages_event_created_id', 
    'idx_scheduled_messages_processing',
    'idx_events_host',
    'idx_event_guests_user_id',
    'event_guests_event_id_phone_active_key',
    'idx_media_event_created'
  )
ORDER BY tablename, indexname;

-- ==================================================
-- CONSTRAINT INTEGRITY CHECK  
-- ==================================================

-- Verify all constraints still have backing indexes
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint  
WHERE conrelid IN (
  SELECT oid FROM pg_class 
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('events', 'messages', 'message_deliveries', 'event_guests', 'users', 'scheduled_messages', 'media', 'event_schedule_items', 'user_link_audit')
)
ORDER BY conname;

-- ==================================================
-- WRITE PERFORMANCE MICRO-BENCHMARK  
-- ==================================================

-- Measure INSERT performance on key tables (run before/after)
-- Note: Use in transaction that you ROLLBACK to avoid data pollution

BEGIN;

-- Time message inserts
\timing on
INSERT INTO messages (id, event_id, content, sender_user_id, message_type, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'test-event-id-here',  -- Replace with actual event_id
  'Test message content ' || generate_series,
  'test-user-id-here',   -- Replace with actual user_id  
  'channel',
  NOW(),
  NOW()
FROM generate_series(1, 100);

-- Time message_delivery inserts  
INSERT INTO message_deliveries (id, message_id, guest_id, status, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'test-message-id-here',  -- Use message from above
  'test-guest-id-here',    -- Replace with actual guest_id
  'pending',
  NOW(),
  NOW()  
FROM generate_series(1, 100);

\timing off

-- Don't commit the test data
ROLLBACK;

-- ==================================================
-- STORAGE VERIFICATION
-- ==================================================

-- Check total index storage after drops
SELECT 
  schemaname,
  tablename,
  COUNT(*) as index_count,
  ROUND(SUM(pg_relation_size(indexname::regclass))/1024.0/1024.0, 2) as total_mb
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY total_mb DESC;
