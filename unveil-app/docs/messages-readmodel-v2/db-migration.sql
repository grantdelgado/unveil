-- ============================================================================
-- Messages Read-Model V2 - Database Migration
-- ============================================================================
-- Date: January 29, 2025
-- Purpose: Add indexes and verify RLS for announcement/channel read model
-- Approach: Minimal changes - existing schema already supports requirements

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for efficient message type filtering and pagination
CREATE INDEX IF NOT EXISTS idx_messages_event_type_created 
ON public.messages(event_id, message_type, created_at DESC)
WHERE message_type IN ('announcement', 'channel');

-- Index for scheduled message lookups (channel targeting)
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_message_id 
ON public.messages(scheduled_message_id) 
WHERE scheduled_message_id IS NOT NULL;

-- Verify existing GIN index for guest tags (should already exist)
-- CREATE INDEX IF NOT EXISTS idx_event_guests_tags_gin 
-- ON public.event_guests USING gin(guest_tags);

-- ============================================================================
-- RLS POLICY VERIFICATION
-- ============================================================================

-- Verify guests can read messages via existing policy
-- Policy: messages_select_optimized USING (can_access_event(event_id))
-- This already allows guests to SELECT announcements and channels

-- Verify message_deliveries policy for direct messages
-- Policy: message_deliveries_select_optimized 
-- USING (CASE WHEN user_id IS NOT NULL THEN user_id = auth.uid() ...)
-- This ensures direct messages remain delivery-gated

-- ============================================================================
-- HELPER FUNCTION VERIFICATION
-- ============================================================================

-- Verify tag filtering functions exist (should already be implemented)
-- guest_has_any_tags(guest_id uuid, target_tags text[])
-- guest_has_all_tags(guest_id uuid, target_tags text[])

-- Test query to verify guest access to messages
-- (This will be used in shadow verification)
-- SELECT m.id, m.message_type, m.content 
-- FROM messages m 
-- WHERE m.event_id = $event_id 
-- AND m.message_type IN ('announcement', 'channel');

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_messages_event_type_created;
-- DROP INDEX IF EXISTS idx_messages_scheduled_message_id;

-- Note: No RLS policy changes needed - existing policies already support
-- the read model requirements. The RPC logic will handle access control.

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check index creation
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'messages'
AND indexname IN ('idx_messages_event_type_created', 'idx_messages_scheduled_message_id');

-- Check existing RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('messages', 'message_deliveries')
ORDER BY tablename, policyname;
