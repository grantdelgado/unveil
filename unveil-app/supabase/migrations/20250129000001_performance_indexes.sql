-- Migration: Add performance indexes for messaging system
-- Date: 2025-01-29
-- Purpose: Optimize query performance for message delivery and analytics

-- Index for message deliveries by guest and message (for getGuestMessages queries)
CREATE INDEX IF NOT EXISTS idx_message_deliveries_guest_message 
ON message_deliveries(guest_id, message_id);

-- Index for messages by event, type and created date (for getEventMessages queries)
CREATE INDEX IF NOT EXISTS idx_messages_event_type_created 
ON messages(event_id, message_type, created_at DESC);

-- Index for scheduled messages by send time and status (for CRON processing)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_send_status 
ON scheduled_messages(send_at, status);

-- Additional indexes for common query patterns

-- Index for message deliveries by status for analytics
CREATE INDEX IF NOT EXISTS idx_message_deliveries_status 
ON message_deliveries(guest_id, sms_status, email_status, push_status);

-- Index for event guests by tags for targeted messaging
CREATE INDEX IF NOT EXISTS idx_event_guests_tags 
ON event_guests USING GIN (guest_tags);

-- Index for event guests by RSVP status for targeted messaging  
CREATE INDEX IF NOT EXISTS idx_event_guests_rsvp 
ON event_guests(event_id, rsvp_status);

-- Index for messages by sender for analytics
CREATE INDEX IF NOT EXISTS idx_messages_sender_created 
ON messages(sender_user_id, created_at DESC);

-- Index for scheduled messages by event for analytics
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_event 
ON scheduled_messages(event_id, status, sent_at DESC);

-- Composite index for message deliveries analytics queries
CREATE INDEX IF NOT EXISTS idx_message_deliveries_analytics 
ON message_deliveries(message_id, has_responded, created_at);

-- Comments for documentation
COMMENT ON INDEX idx_message_deliveries_guest_message IS 'Optimizes getGuestMessages queries';
COMMENT ON INDEX idx_messages_event_type_created IS 'Optimizes getEventMessages queries with filtering';
COMMENT ON INDEX idx_scheduled_messages_send_status IS 'Optimizes CRON message processing queries';
COMMENT ON INDEX idx_event_guests_tags IS 'Optimizes tag-based message targeting using GIN index';
COMMENT ON INDEX idx_event_guests_rsvp IS 'Optimizes RSVP-based message targeting';
COMMENT ON INDEX idx_message_deliveries_analytics IS 'Optimizes message delivery analytics queries'; 