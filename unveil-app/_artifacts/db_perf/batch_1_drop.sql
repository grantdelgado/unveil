-- ============================================================================
-- Batch 1 Index Cleanup - DROP SCRIPT
-- ============================================================================
-- 
-- Generated: October 1, 2025
-- Purpose: Drop unused indexes identified in performance audit
-- Safety: All indexes have 0 scans and are not primary/unique/FK-backing
-- 
-- BEFORE RUNNING: Ensure rollback script (batch_1_rollback.sql) is available
-- ============================================================================

-- Batch 1: Unused indexes by size (PUBLIC SCHEMA ONLY)
-- Total space savings: ~216KB (2 indexes dropped)
-- NOTE: Auth schema indexes are system-protected and cannot be dropped

-- ✅ EXECUTED: message_deliveries_user_message_created_id_desc_idx (120KB, 0 scans)
DROP INDEX CONCURRENTLY IF EXISTS public.message_deliveries_user_message_created_id_desc_idx;

-- ✅ EXECUTED: message_deliveries_user_created_id_desc_idx (96KB, 0 scans) 
DROP INDEX CONCURRENTLY IF EXISTS public.message_deliveries_user_created_id_desc_idx;

-- ⚠️ SKIPPED: audit_logs_instance_id_idx (32KB, 0 scans) - System protected
-- DROP INDEX CONCURRENTLY IF EXISTS auth.audit_logs_instance_id_idx;

-- ⚠️ SKIPPED: one_time_tokens_relates_to_hash_idx (32KB, 0 scans) - System protected
-- DROP INDEX CONCURRENTLY IF EXISTS auth.one_time_tokens_relates_to_hash_idx;

-- ⚠️ SKIPPED: idx_user_id_auth_method (16KB, 0 scans) - System protected
-- DROP INDEX CONCURRENTLY IF EXISTS auth.idx_user_id_auth_method;

-- ============================================================================
-- VERIFICATION QUERIES (run after drops complete)
-- ============================================================================

-- Check that indexes are gone
SELECT 
  schemaname, 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE indexname IN (
  'message_deliveries_user_message_created_id_desc_idx',
  'message_deliveries_user_created_id_desc_idx', 
  'audit_logs_instance_id_idx',
  'one_time_tokens_relates_to_hash_idx',
  'idx_user_id_auth_method'
);

-- Check total index size reduction
SELECT 
  schemaname,
  SUM(pg_relation_size(schemaname||'.'||indexname)) as total_index_size_bytes
FROM pg_indexes 
WHERE schemaname IN ('public', 'auth')
GROUP BY schemaname
ORDER BY total_index_size_bytes DESC;

-- ============================================================================
