-- Post-deployment health check for FK indexes
-- Verifies index usage, captures query plans, and checks for lock contention
-- Run after deploying 20251014173731_add_fk_indexes.sql

\echo '=== FK Index Health Check ==='
\echo 'Timestamp:' `date`
\echo ''

-- 1. Verify audit shows no unindexed FKs (should return 0 rows)
\echo '1. Audit Check - Unindexed Foreign Keys (expect 0 rows):'
WITH fk AS (
  SELECT
    c.oid AS fk_oid,
    c.conname,
    c.conrelid::regclass AS fk_table,
    unnest(c.conkey) AS fk_colnum
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
fk_cols AS (
  SELECT
    f.conname,
    f.fk_table,
    a.attname AS fk_column
  FROM fk f
  JOIN pg_attribute a
    ON a.attrelid = f.fk_table::regclass
   AND a.attnum   = f.fk_colnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
indexed AS (
  SELECT DISTINCT
    c.relname::regclass AS tbl,
    a.attname AS col
  FROM pg_class c
  JOIN pg_index i ON i.indrelid = c.oid
  JOIN pg_attribute a ON a.attrelid = c.oid
   AND a.attnum = ANY(i.indkey)
  WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND i.indisvalid AND i.indisready
)
SELECT COUNT(*) as unindexed_fk_count
FROM fk_cols f
LEFT JOIN indexed ix
  ON ix.tbl::text = f.fk_table::text
 AND ix.col       = f.fk_column
WHERE ix.col IS NULL;

\echo ''

-- 2. Index usage statistics for the 5 new FK indexes
\echo '2. New FK Index Usage Statistics:'
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 10 THEN 'LOW_USAGE' 
    ELSE 'ACTIVE'
  END as usage_status
FROM pg_stat_user_indexes 
WHERE indexname IN (
  'idx_scheduled_messages__sender_user_id',
  'idx_message_deliveries__response_message_id', 
  'idx_message_deliveries__scheduled_message_id',
  'idx_user_link_audit__linked_user_id',
  'idx_user_link_audit__matched_guest_id'
)
ORDER BY schemaname, tablename, indexname;

\echo ''

-- 3. Check for any current lock contention on affected tables
\echo '3. Current Lock Status on Affected Tables:'
SELECT 
  l.relation::regclass as table_name,
  l.mode,
  COUNT(*) as lock_count
FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
WHERE c.relname IN ('scheduled_messages', 'message_deliveries', 'user_link_audit')
  AND l.granted = true
GROUP BY l.relation, l.mode
ORDER BY table_name, mode;

\echo ''

-- 4. Index size and bloat check
\echo '4. New Index Sizes:'
SELECT 
  schemaname,
  tablename, 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes 
WHERE indexname IN (
  'idx_scheduled_messages__sender_user_id',
  'idx_message_deliveries__response_message_id', 
  'idx_message_deliveries__scheduled_message_id',
  'idx_user_link_audit__linked_user_id',
  'idx_user_link_audit__matched_guest_id'
)
ORDER BY pg_relation_size(indexname::regclass) DESC;

\echo ''
\echo '=== Representative Query Plans ==='
\echo 'Note: Replace UUIDs with actual values from your database'
\echo ''

-- Query Plan 1: scheduled_messages.sender_user_id join
\echo '5a. Query Plan - Scheduled Messages by Sender:'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sm.id, sm.content, sm.send_at, u.full_name
FROM scheduled_messages sm
JOIN users u ON u.id = sm.sender_user_id
WHERE sm.status = 'scheduled'
  AND sm.send_at > NOW()
ORDER BY sm.send_at
LIMIT 10;

\echo ''

-- Query Plan 2: message_deliveries.scheduled_message_id lookup
\echo '5b. Query Plan - Deliveries by Scheduled Message:'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT md.id, md.sms_status, md.phone_number, sm.content
FROM message_deliveries md
JOIN scheduled_messages sm ON sm.id = md.scheduled_message_id
WHERE md.created_at > NOW() - INTERVAL '1 day'
  AND md.sms_status IN ('sent', 'delivered')
LIMIT 20;

\echo ''

-- Query Plan 3: user_link_audit.linked_user_id filtering  
\echo '5c. Query Plan - Audit by Linked User:'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ula.id, ula.outcome, ula.normalized_phone, ula.created_at
FROM user_link_audit ula
WHERE ula.outcome = 'linked'
  AND ula.created_at > NOW() - INTERVAL '7 days'
ORDER BY ula.created_at DESC
LIMIT 15;

\echo ''

-- Query Plan 4: Complex join using multiple new indexes
\echo '5d. Query Plan - Complex Multi-Table Join:'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  sm.content as scheduled_content,
  md.sms_status,
  u.full_name as sender_name,
  ula.outcome as link_outcome
FROM scheduled_messages sm
JOIN message_deliveries md ON md.scheduled_message_id = sm.id
JOIN users u ON u.id = sm.sender_user_id  
LEFT JOIN user_link_audit ula ON ula.linked_user_id = u.id
WHERE sm.created_at > NOW() - INTERVAL '1 day'
  AND md.sms_status = 'sent'
LIMIT 5;

\echo ''
\echo '=== Health Check Complete ==='
\echo 'Expected Results:'
\echo '- Unindexed FK count: 0'
\echo '- Index usage: ACTIVE or LOW_USAGE (depending on traffic)'
\echo '- Lock count: Minimal (shared locks only)'
\echo '- Query plans: Should show "Index Scan" or "Bitmap Index Scan" on new indexes'
