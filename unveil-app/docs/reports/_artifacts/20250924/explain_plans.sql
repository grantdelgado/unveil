-- EXPLAIN ANALYZE Query Performance Analysis
-- Generated: September 24, 2025
-- Database: PostgreSQL 15.8.1.085

-- Query 1: Recent Messages (Most Common Query Pattern)
-- Usage: Message threads, recent activity, host dashboards
EXPLAIN (ANALYZE, BUFFERS) 
SELECT m.id, m.content, m.created_at, m.sender_user_id, m.message_type,
       u.full_name as sender_name, u.avatar_url as sender_avatar
FROM messages m
LEFT JOIN users u ON m.sender_user_id = u.id
WHERE m.event_id = (SELECT id FROM events LIMIT 1)
ORDER BY m.created_at DESC, m.id DESC
LIMIT 50;

-- RESULTS:
-- Limit  (cost=0.56..6.04 rows=50 width=125) (actual time=2.429..2.430 rows=0 loops=1)
-- Buffers: shared hit=2
-- InitPlan 1 (returns $0)
--   ->  Limit  (cost=0.00..0.26 rows=1 width=16) (actual time=0.626..0.626 rows=1 loops=1)
--         Buffers: shared hit=1
--         ->  Seq Scan on events  (cost=0.00..1.04 rows=4 width=16) (actual time=0.625..0.625 rows=1 loops=1)
--               Buffers: shared hit=1
-- ->  Nested Loop Left Join  (cost=0.30..7.64 rows=67 width=125) (actual time=2.428..2.429 rows=0 loops=1)
--       Buffers: shared hit=2
--       ->  Index Scan using idx_messages_event_created_id on messages m  (cost=0.14..5.32 rows=67 width=79) (actual time=2.427..2.427 rows=0 loops=1)
--             Index Cond: (event_id = $0)
--             Buffers: shared hit=2
--       ->  Memoize  (cost=0.15..0.24 rows=1 width=62) (never executed)
--             Cache Key: m.sender_user_id
--             Cache Mode: logical
--             ->  Index Scan using users_pkey on users u  (cost=0.14..0.23 rows=1 width=62) (never executed)
--                   Index Cond: (id = m.sender_user_id)
-- Planning Time: 14.178 ms
-- Execution Time: 3.098 ms

-- ANALYSIS: ✅ OPTIMAL
-- - Uses idx_messages_event_created_id composite index effectively
-- - Memoize node would cache user lookups efficiently with data
-- - Planning time high (14ms) but acceptable for complex query
-- - Execution time excellent (3ms)


-- Query 2: Message Deliveries Lookup (Delivery Status Tracking)  
-- Usage: Message analytics, delivery confirmation, retry logic
EXPLAIN (ANALYZE, BUFFERS)
SELECT md.id, md.sms_status, md.push_status, md.has_responded, md.created_at
FROM message_deliveries md
WHERE md.message_id IN (SELECT id FROM messages WHERE event_id = (SELECT id FROM events LIMIT 1) LIMIT 10);

-- RESULTS:
-- Nested Loop  (cost=1.36..42.95 rows=149 width=44) (actual time=4.432..4.434 rows=0 loops=1)
-- Buffers: shared hit=4
-- ->  HashAggregate  (cost=1.08..1.18 rows=10 width=16) (actual time=4.432..4.433 rows=0 loops=1)
--       Group Key: messages.id
--       Batches: 1  Memory Usage: 24kB
--       Buffers: shared hit=4
--       ->  Limit  (cost=0.26..0.96 rows=10 width=16) (actual time=4.429..4.430 rows=0 loops=1)
--             Buffers: shared hit=4
--             InitPlan 1 (returns $0)
--               ->  Limit  (cost=0.00..0.26 rows=1 width=16) (actual time=0.009..0.010 rows=1 loops=1)
--                     Buffers: shared hit=1
--                     ->  Seq Scan on events  (cost=0.00..1.04 rows=4 width=16) (actual time=0.008..0.008 rows=1 loops=1)
--                           Buffers: shared hit=1
--             ->  Seq Scan on messages  (cost=0.00..4.67 rows=67 width=16) (actual time=4.428..4.428 rows=0 loops=1)
--                   Filter: (event_id = $0)
--                   Rows Removed by Filter: 103
--                   Buffers: shared hit=4
-- ->  Index Scan using idx_message_deliveries_message_id on message_deliveries md  (cost=0.28..4.03 rows=15 width=60) (never executed)
--       Index Cond: (message_id = messages.id)
-- Planning Time: 20.734 ms
-- Execution Time: 4.548 ms

-- ANALYSIS: ⚠️ SUBOPTIMAL  
-- - Sequential scan on messages table instead of using index
-- - High planning time (20.7ms) suggests optimizer confusion
-- - Better approach: Use EXISTS clause instead of IN clause
-- RECOMMENDATION: Rewrite query to use EXISTS for better index usage


-- Query 3: Guest Authentication Lookup (Phone-based Auth)
-- Usage: User login, guest verification, phone matching
EXPLAIN (ANALYZE, BUFFERS)
SELECT eg.id, eg.display_name, eg.phone, eg.rsvp_status, eg.joined_at
FROM event_guests eg
WHERE eg.event_id = (SELECT id FROM events LIMIT 1) AND eg.phone = '+15551234567';

-- RESULTS:
-- Index Scan using idx_event_guests_event_phone on event_guests eg  (cost=0.41..2.62 rows=1 width=59) (actual time=1.292..1.293 rows=0 loops=1)
-- Index Cond: ((event_id = $0) AND (phone = '+15551234567'::text))
-- Buffers: shared hit=2
-- InitPlan 1 (returns $0)
--   ->  Limit  (cost=0.00..0.26 rows=1 width=16) (actual time=0.009..0.010 rows=1 loops=1)
--         Buffers: shared hit=1
--         ->  Seq Scan on events  (cost=0.00..1.04 rows=4 width=16) (actual time=0.008..0.009 rows=1 loops=1)
--               Buffers: shared hit=1
-- Planning Time: 12.668 ms
-- Execution Time: 1.366 ms

-- ANALYSIS: ✅ EXCELLENT
-- - Perfect index usage with idx_event_guests_event_phone
-- - Single index scan covers both conditions efficiently  
-- - Execution time excellent (1.4ms)
-- - Critical for authentication performance


-- Query 4: Media Gallery Display (Photo/Video Loading)
-- Usage: Guest photo galleries, media upload confirmation
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id, m.storage_path, m.media_type, m.caption, m.created_at
FROM media m
WHERE m.event_id = (SELECT id FROM events LIMIT 1)
ORDER BY m.created_at DESC
LIMIT 20;

-- RESULTS:
-- Limit  (cost=3.67..3.67 rows=2 width=120) (actual time=0.054..0.054 rows=0 loops=1)
-- Buffers: shared hit=6
-- InitPlan 1 (returns $0)
--   ->  Limit  (cost=0.00..0.26 rows=1 width=16) (actual time=0.010..0.010 rows=1 loops=1)
--         Buffers: shared hit=1
--         ->  Seq Scan on events  (cost=0.00..1.04 rows=4 width=16) (actual time=0.010..0.010 rows=1 loops=1)
--               Buffers: shared hit=1
-- ->  Sort  (cost=3.41..3.41 rows=2 width=120) (actual time=0.053..0.053 rows=0 loops=1)
--       Sort Key: m.created_at DESC
--       Sort Method: quicksort  Memory: 25kB
--       Buffers: shared hit=6
--       ->  Bitmap Heap Scan on media m  (cost=1.26..3.40 rows=2 width=120) (actual time=0.017..0.017 rows=0 loops=1)
--             Recheck Cond: (event_id = $0)
--             Buffers: shared hit=3
--             ->  Bitmap Index Scan on idx_media_event_created  (cost=0.00..1.26 rows=2 width=0) (actual time=0.014..0.014 rows=0 loops=1)
--                   Index Cond: (event_id = $0)
--                   Buffers: shared hit=3
-- Planning Time: 4.275 ms
-- Execution Time: 0.169 ms

-- ANALYSIS: ✅ EXCELLENT  
-- - Optimal bitmap index scan using idx_media_event_created
-- - Sort operation efficient with small dataset
-- - Execution time outstanding (0.17ms)
-- - Well-optimized for media gallery use cases


-- PERFORMANCE SUMMARY:
-- ✅ Guest auth queries: 1.4ms (excellent)
-- ✅ Media gallery queries: 0.17ms (outstanding)  
-- ✅ Recent messages: 3.1ms (good)
-- ⚠️  Message deliveries: 4.5ms (needs optimization)

-- OPTIMIZATION RECOMMENDATIONS:
-- 1. Fix message deliveries query pattern (use EXISTS instead of IN)
-- 2. Consider composite indexes for multi-table analytics queries
-- 3. Monitor query plan stability as data grows
-- 4. Add query performance alerts for regression detection
