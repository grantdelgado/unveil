-- migrate:transaction: disable
-- migrate:split

-- Add missing indexes for foreign key columns to improve join performance
-- This migration adds indexes CONCURRENTLY to avoid blocking operations
-- Based on audit findings: 5 unindexed FK columns identified

-- Set safe timeouts for index builds
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15min';

-- Index for scheduled_messages.sender_user_id
-- Improves queries filtering/joining on message sender
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages__sender_user_id 
ON public.scheduled_messages (sender_user_id);

-- Index for message_deliveries.response_message_id  
-- Improves queries linking delivery responses to original messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_deliveries__response_message_id 
ON public.message_deliveries (response_message_id);

-- Index for message_deliveries.scheduled_message_id
-- Improves queries linking deliveries to scheduled messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_deliveries__scheduled_message_id 
ON public.message_deliveries (scheduled_message_id);

-- Index for user_link_audit.linked_user_id
-- Improves audit queries filtering by linked user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_link_audit__linked_user_id 
ON public.user_link_audit (linked_user_id);

-- Index for user_link_audit.matched_guest_id  
-- Improves audit queries filtering by matched guest
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_link_audit__matched_guest_id 
ON public.user_link_audit (matched_guest_id);
