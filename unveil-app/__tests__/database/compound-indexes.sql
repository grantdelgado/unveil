-- Test compound cursor indexes for efficient pagination
-- This file validates that the new indexes are created and can be used effectively

-- Test 1: Verify messages compound index exists
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'messages'
  AND indexname = 'messages_event_created_id_desc_idx';

-- Expected: Should return 1 row showing the compound index

-- Test 2: Verify message_deliveries compound indexes exist  
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE tablename = 'message_deliveries'
  AND indexname LIKE '%created_id_desc_idx'
ORDER BY indexname;

-- Expected: Should return 4 rows for user, message, guest, and user_message indexes

-- Test 3: Test query plan for messages by event (should use index)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, content, created_at
FROM public.messages
WHERE event_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC, id DESC
LIMIT 30;

-- Expected: Should show index scan on messages_event_created_id_desc_idx

-- Test 4: Test query plan for deliveries by user (should use index)
EXPLAIN (ANALYZE, BUFFERS)  
SELECT id, message_id, created_at
FROM public.message_deliveries
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC, id DESC
LIMIT 30;

-- Expected: Should show index scan on message_deliveries_user_created_id_desc_idx

-- Test 5: Test cursor pagination query (most important use case)
-- This simulates fetching next page using cursor from previous query
WITH cursor_params AS (
  SELECT 
    '2025-01-01 12:00:00'::timestamptz AS last_created_at,
    '00000000-0000-0000-0000-000000000002'::uuid AS last_id
)
SELECT id, content, created_at
FROM public.messages, cursor_params
WHERE event_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND (
    created_at < cursor_params.last_created_at 
    OR (created_at = cursor_params.last_created_at AND id < cursor_params.last_id)
  )
ORDER BY created_at DESC, id DESC
LIMIT 30;

-- Expected: Should use the compound index efficiently for cursor-based pagination

-- Test 6: Verify index covers common message delivery patterns
EXPLAIN (ANALYZE, BUFFERS)
SELECT md.id, md.message_id, md.created_at, m.content
FROM public.message_deliveries md
JOIN public.messages m ON md.message_id = m.id  
WHERE md.guest_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND m.event_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY md.created_at DESC, md.id DESC
LIMIT 30;

-- Expected: Should use message_deliveries_guest_created_id_desc_idx for deliveries
-- and messages_event_created_id_desc_idx or messages PK for join

-- Test 7: Validate index uniqueness and constraints
SELECT 
  indexname,
  indexdef,
  CASE 
    WHEN indexdef LIKE '%UNIQUE%' THEN 'UNIQUE'
    ELSE 'NON-UNIQUE'
  END as uniqueness,
  CASE
    WHEN indexdef LIKE '%DESC%' THEN 'HAS_DESC'
    ELSE 'NO_DESC'  
  END as sort_order
FROM pg_indexes
WHERE tablename IN ('messages', 'message_deliveries')
  AND indexname LIKE '%created_id_desc_idx'
ORDER BY tablename, indexname;

-- Expected: All indexes should be NON-UNIQUE and HAS_DESC
