-- Test queries to validate FK index performance improvements
-- Run these before and after the migration to compare execution plans

-- Test 1: scheduled_messages.sender_user_id joins
-- Should show index scan after migration
EXPLAIN (ANALYZE, BUFFERS) 
SELECT sm.id, sm.content, u.full_name
FROM scheduled_messages sm
JOIN users u ON u.id = sm.sender_user_id
WHERE sm.event_id = '00000000-0000-0000-0000-000000000000'::uuid  -- Replace with real event_id
LIMIT 10;

-- Test 2: message_deliveries.response_message_id lookups  
-- Should show index scan after migration
EXPLAIN (ANALYZE, BUFFERS)
SELECT md.id, md.sms_status, m.content
FROM message_deliveries md
JOIN messages m ON m.id = md.response_message_id
WHERE md.guest_id = '00000000-0000-0000-0000-000000000000'::uuid  -- Replace with real guest_id
LIMIT 10;

-- Test 3: message_deliveries.scheduled_message_id joins
-- Should show index scan after migration  
EXPLAIN (ANALYZE, BUFFERS)
SELECT md.id, md.sms_status, sm.content
FROM message_deliveries md
JOIN scheduled_messages sm ON sm.id = md.scheduled_message_id
WHERE md.created_at > NOW() - INTERVAL '1 day'
LIMIT 10;

-- Test 4: user_link_audit.linked_user_id filtering
-- Should show index scan after migration
EXPLAIN (ANALYZE, BUFFERS)
SELECT ula.id, ula.outcome, ula.created_at
FROM user_link_audit ula
WHERE ula.linked_user_id = '00000000-0000-0000-0000-000000000000'::uuid  -- Replace with real user_id
ORDER BY ula.created_at DESC
LIMIT 10;

-- Test 5: user_link_audit.matched_guest_id filtering  
-- Should show index scan after migration
EXPLAIN (ANALYZE, BUFFERS)
SELECT ula.id, ula.outcome, ula.normalized_phone
FROM user_link_audit ula
WHERE ula.matched_guest_id = '00000000-0000-0000-0000-000000000000'::uuid  -- Replace with real guest_id
ORDER BY ula.created_at DESC
LIMIT 10;

-- Monitor index usage after migration
-- Run this periodically to confirm indexes are being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname IN (
  'idx_scheduled_messages__sender_user_id',
  'idx_message_deliveries__response_message_id', 
  'idx_message_deliveries__scheduled_message_id',
  'idx_user_link_audit__linked_user_id',
  'idx_user_link_audit__matched_guest_id'
)
ORDER BY schemaname, tablename, indexname;
