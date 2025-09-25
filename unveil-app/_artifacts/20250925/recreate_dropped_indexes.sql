-- Rollback Script: Recreate Dropped Indexes  
-- Generated: September 25, 2025
-- Use this script to restore any dropped indexes if needed

-- ==================================================
-- ROLLBACK: Recreate all dropped indexes with exact definitions
-- ==================================================

-- message_deliveries table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_message_user 
    ON public.message_deliveries USING btree (message_id, user_id) 
    WHERE (user_id IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_deliveries_phone_user_null 
    ON public.message_deliveries USING btree (phone_number) 
    WHERE ((user_id IS NULL) AND (phone_number IS NOT NULL));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_deliveries_sms_provider 
    ON public.message_deliveries USING btree (sms_provider_id) 
    WHERE (sms_provider_id IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_scheduled_message 
    ON public.message_deliveries USING btree (scheduled_message_id) 
    WHERE (scheduled_message_id IS NOT NULL);

-- messages table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_delivery_tracking 
    ON public.messages USING btree (delivered_at, delivered_count, failed_count) 
    WHERE (delivered_at IS NOT NULL);

-- events table indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_time_zone 
    ON public.events USING btree (time_zone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_creation_key_lookup 
    ON public.events USING btree (creation_key) 
    WHERE (creation_key IS NOT NULL);

-- event_guests table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_declined_at 
    ON public.event_guests USING btree (event_id, declined_at) 
    WHERE (declined_at IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_removed_at 
    ON public.event_guests USING btree (removed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_carrier_opted_out_at 
    ON public.event_guests USING btree (carrier_opted_out_at) 
    WHERE (carrier_opted_out_at IS NOT NULL);

-- users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sms_consent_given_at 
    ON public.users USING btree (sms_consent_given_at) 
    WHERE (sms_consent_given_at IS NOT NULL);

-- scheduled_messages table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages_sender_user_id 
    ON public.scheduled_messages USING btree (sender_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages_trigger_source 
    ON public.scheduled_messages USING btree (trigger_source, trigger_ref_id) 
    WHERE (trigger_source = 'event_reminder'::text);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages_timezone 
    ON public.scheduled_messages USING btree (scheduled_tz) 
    WHERE (scheduled_tz IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages_recipient_snapshot 
    ON public.scheduled_messages USING gin (recipient_snapshot);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_messages_idempotency 
    ON public.scheduled_messages USING btree (idempotency_key) 
    WHERE (idempotency_key IS NOT NULL);

-- Duplicate index (non-unique version)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_event_user 
    ON public.event_guests USING btree (event_id, user_id);

-- ==================================================
-- Post-recreation maintenance  
-- ==================================================

-- Analyze affected tables to update statistics
ANALYZE public.message_deliveries;
ANALYZE public.messages;
ANALYZE public.events; 
ANALYZE public.event_guests;
ANALYZE public.users;
ANALYZE public.scheduled_messages;
