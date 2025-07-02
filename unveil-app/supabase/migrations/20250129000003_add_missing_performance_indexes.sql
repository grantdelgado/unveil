-- #Phase2-IndexOpt: Add Missing Performance Indexes
-- Addresses Phase 2.1 Database Index Optimization from Supabase Schema Remediation Plan
-- Focus: Critical missing indexes for high-traffic query patterns

BEGIN;

-- ============================================================================
-- MISSING CRITICAL INDEXES
-- These indexes support foreign key relationships and common lookup patterns
-- ============================================================================

-- message_deliveries.message_id - Critical for delivery lookup by message
-- Used in: Message delivery status queries, analytics, delivery tracking
CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id 
ON public.message_deliveries(message_id)
WHERE message_id IS NOT NULL;

-- event_guests.user_id - Critical for user event access lookup  
-- Used in: User's events list, authentication checks, access control
CREATE INDEX IF NOT EXISTS idx_event_guests_user_id 
ON public.event_guests(user_id)
WHERE user_id IS NOT NULL;

-- ============================================================================
-- HIGH-TRAFFIC COMPOSITE INDEXES
-- These indexes optimize common query patterns with multiple conditions
-- ============================================================================

-- message_deliveries(guest_id, created_at DESC) - Guest message history timeline
-- Used in: Guest message delivery history, analytics dashboards, status tracking
-- Replaces: Sequential scans on message_deliveries for guest-specific queries
CREATE INDEX IF NOT EXISTS idx_message_deliveries_guest_timeline 
ON public.message_deliveries(guest_id, created_at DESC)
WHERE guest_id IS NOT NULL;

-- event_guests(event_id, rsvp_status) - Event RSVP filtering and counts
-- Used in: RSVP status reports, guest list filtering, event analytics
-- Replaces: Full table scans when filtering guests by RSVP status
CREATE INDEX IF NOT EXISTS idx_event_guests_event_rsvp 
ON public.event_guests(event_id, rsvp_status)
WHERE event_id IS NOT NULL AND rsvp_status IS NOT NULL;

-- event_guests(user_id, event_id) - User's event membership lookup
-- Used in: User dashboard, event access validation, cross-event queries
-- Optimizes: Multi-event user queries and access control checks
CREATE INDEX IF NOT EXISTS idx_event_guests_user_events 
ON public.event_guests(user_id, event_id)
WHERE user_id IS NOT NULL AND event_id IS NOT NULL;

-- ============================================================================
-- ANALYTICAL QUERY OPTIMIZATION INDEXES
-- These indexes support dashboard and reporting features
-- ============================================================================

-- message_deliveries(scheduled_message_id, sms_status) - SMS delivery analytics
-- Used in: SMS delivery success rates, failed delivery reports, campaign analytics
CREATE INDEX IF NOT EXISTS idx_message_deliveries_sms_analytics 
ON public.message_deliveries(scheduled_message_id, sms_status)
WHERE scheduled_message_id IS NOT NULL AND sms_status IS NOT NULL;

-- message_deliveries(created_at, sms_status) - Time-based delivery analytics
-- Used in: Delivery performance over time, daily/weekly delivery reports
CREATE INDEX IF NOT EXISTS idx_message_deliveries_delivery_performance 
ON public.message_deliveries(created_at DESC, sms_status)
WHERE created_at IS NOT NULL;

-- event_guests(invited_at, rsvp_status) - Invitation response analytics  
-- Used in: Response rate tracking, invitation campaign performance
CREATE INDEX IF NOT EXISTS idx_event_guests_invitation_analytics 
ON public.event_guests(invited_at DESC, rsvp_status)
WHERE invited_at IS NOT NULL;

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- These indexes target specific query patterns with WHERE conditions
-- ============================================================================

-- message_deliveries - Failed deliveries only (for retry logic)
-- Used in: Failed delivery retry processing, error handling systems
CREATE INDEX IF NOT EXISTS idx_message_deliveries_failed_sms 
ON public.message_deliveries(scheduled_message_id, created_at DESC)
WHERE sms_status IN ('failed', 'rejected', 'undelivered');

-- event_guests - Pending RSVPs only (for follow-up campaigns)
-- Used in: RSVP reminder campaigns, pending guest follow-ups
CREATE INDEX IF NOT EXISTS idx_event_guests_pending_rsvp 
ON public.event_guests(event_id, invited_at DESC)
WHERE rsvp_status = 'pending';

-- ============================================================================
-- INDEX MAINTENANCE AND DOCUMENTATION
-- ============================================================================

-- Add index comments for maintainability and future optimization
COMMENT ON INDEX idx_message_deliveries_message_id IS 
'Critical for message delivery lookup and status tracking. Used by delivery analytics and retry logic.';

COMMENT ON INDEX idx_event_guests_user_id IS 
'Critical for user event access control and dashboard queries. Used by authentication and user event listing.';

COMMENT ON INDEX idx_message_deliveries_guest_timeline IS 
'Optimizes guest message history queries. Supports chronological delivery tracking and guest communication history.';

COMMENT ON INDEX idx_event_guests_event_rsvp IS 
'Optimizes RSVP filtering and counting. Supports event analytics and guest list management features.';

COMMENT ON INDEX idx_event_guests_user_events IS 
'Optimizes user multi-event queries. Supports user dashboard and cross-event access validation.';

COMMENT ON INDEX idx_message_deliveries_sms_analytics IS 
'Supports SMS campaign analytics and delivery success rate reporting.';

COMMENT ON INDEX idx_message_deliveries_delivery_performance IS 
'Supports time-based delivery performance analytics and operational monitoring.';

COMMENT ON INDEX idx_event_guests_invitation_analytics IS 
'Supports invitation campaign performance tracking and response rate analytics.';

COMMENT ON INDEX idx_message_deliveries_failed_sms IS 
'Partial index for failed delivery retry processing. Reduces index size while targeting specific retry workflows.';

COMMENT ON INDEX idx_event_guests_pending_rsvp IS 
'Partial index for pending RSVP follow-up campaigns. Optimizes reminder and follow-up query performance.';

COMMIT;

-- ============================================================================
-- PERFORMANCE IMPROVEMENT SUMMARY:
-- ============================================================================
-- 1. Added 10 new performance indexes targeting high-traffic query patterns
-- 2. Covered all missing foreign key relationship indexes  
-- 3. Added composite indexes for multi-condition queries (guest history, RSVP filtering)
-- 4. Added analytical indexes for dashboard and reporting features
-- 5. Used partial indexes to optimize specific use cases while minimizing storage overhead
-- 6. All indexes include proper WHERE conditions to exclude NULL values
-- 7. Target: 70%+ improvement in query performance for affected operations
-- ============================================================================ 