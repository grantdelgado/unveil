-- Drop Unused Indexes Migration
-- Generated: September 25, 2025
-- Stats Window: 141 days (May 6, 2025 - Sep 25, 2025)
-- Total indexes to drop: 17
-- Expected storage savings: ~0.35 MB

-- ==================================================
-- BATCH 1: Zero-scan unused indexes (0 scans)
-- ==================================================

-- message_deliveries table unused indexes
DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_message_user;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_phone_user_null;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_sms_provider;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_scheduled_message;

-- messages table unused indexes  
DROP INDEX CONCURRENTLY IF EXISTS public.idx_messages_delivery_tracking;

-- events table unused indexes
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_time_zone;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_creation_key_lookup;

-- event_guests table unused indexes
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_declined_at;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_removed_at;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_carrier_opted_out_at;

-- users table unused indexes
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_sms_consent_given_at;

-- scheduled_messages table unused indexes
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_sender_user_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_trigger_source;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_timezone;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_recipient_snapshot;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_idempotency;

-- ==================================================  
-- BATCH 2: Duplicate indexes (keep unique version)
-- ==================================================

-- Drop non-unique duplicate of unique_event_guest_user
DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_event_user;

-- ==================================================
-- Post-drop maintenance
-- ==================================================

-- Analyze affected tables to update statistics
ANALYZE public.message_deliveries;
ANALYZE public.messages;  
ANALYZE public.events;
ANALYZE public.event_guests;
ANALYZE public.users;
ANALYZE public.scheduled_messages;

-- Verify constraint integrity
DO $$
BEGIN
    RAISE NOTICE 'Verifying constraint integrity...';
    PERFORM 1 FROM pg_constraint WHERE conindid IS NOT NULL;
    RAISE NOTICE 'Constraint verification complete.';
END $$;
