-- migrate:transaction: disable
-- migrate:split

-- Rollback migration: Remove FK indexes added in 20251014173731_add_fk_indexes.sql
-- Drops indexes CONCURRENTLY to avoid blocking operations

-- Set safe timeouts for index drops
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5min';

-- Drop indexes in reverse order of creation
DROP INDEX CONCURRENTLY IF EXISTS idx_user_link_audit__matched_guest_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_user_link_audit__linked_user_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_message_deliveries__scheduled_message_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_message_deliveries__response_message_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_scheduled_messages__sender_user_id;
