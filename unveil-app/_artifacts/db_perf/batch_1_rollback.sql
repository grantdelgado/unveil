-- ============================================================================
-- Batch 1 Index Cleanup - ROLLBACK SCRIPT
-- ============================================================================
-- 
-- Generated: October 1, 2025
-- Purpose: Restore indexes dropped in batch_1_drop.sql
-- Usage: Run this script if you need to restore the dropped indexes
-- 
-- NOTE: Only public schema indexes were actually dropped
-- Auth schema indexes are system-protected and were not dropped
-- ============================================================================

-- Restore message_deliveries_user_message_created_id_desc_idx
CREATE INDEX CONCURRENTLY message_deliveries_user_message_created_id_desc_idx 
ON public.message_deliveries USING btree (user_id, message_id, created_at DESC, id DESC);

-- Restore message_deliveries_user_created_id_desc_idx  
CREATE INDEX CONCURRENTLY message_deliveries_user_created_id_desc_idx 
ON public.message_deliveries USING btree (user_id, created_at DESC, id DESC);

-- NOTE: The following auth schema indexes were NOT dropped (system protected):
-- - audit_logs_instance_id_idx
-- - one_time_tokens_relates_to_hash_idx  
-- - idx_user_id_auth_method

-- ============================================================================
-- VERIFICATION QUERIES (run after restoration complete)
-- ============================================================================

-- Check that all indexes are restored
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
)
ORDER BY schemaname, tablename, indexname;

-- ============================================================================
