-- Migration: Add Event Reminder Tracking
-- This migration adds the necessary columns and constraints to support per-sub-event 1-hour reminders

BEGIN;

-- =====================================================
-- 1. ADD REMINDER TRACKING COLUMNS
-- =====================================================

-- Add trigger_source column to identify reminder vs manual messages
ALTER TABLE public.scheduled_messages 
ADD COLUMN IF NOT EXISTS trigger_source TEXT 
CHECK (trigger_source IN ('manual','event_reminder')) 
DEFAULT 'manual';

-- Add trigger_ref_id to link reminders to specific sub-events
ALTER TABLE public.scheduled_messages 
ADD COLUMN IF NOT EXISTS trigger_ref_id UUID NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.scheduled_messages.trigger_source IS 
'Source of the scheduled message: manual (created by host) or event_reminder (auto-created for sub-events)';

COMMENT ON COLUMN public.scheduled_messages.trigger_ref_id IS 
'Reference ID for the trigger source. For event_reminder, this is the event_schedule_items.id';

-- =====================================================
-- 2. CREATE UNIQUE CONSTRAINT FOR REMINDER IDEMPOTENCY
-- =====================================================

-- Prevent duplicate reminders per sub-event
-- Only applies to scheduled reminders (not sent/cancelled ones)
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_messages_unique_event_reminder
  ON public.scheduled_messages (event_id, trigger_source, trigger_ref_id)
  WHERE trigger_source = 'event_reminder' AND status IN ('scheduled');

-- =====================================================
-- 3. ADD PERFORMANCE INDEXES
-- =====================================================

-- Index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_trigger_source 
  ON public.scheduled_messages (trigger_source, trigger_ref_id) 
  WHERE trigger_source = 'event_reminder';

-- Index for reminder cleanup queries
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_event_trigger
  ON public.scheduled_messages (event_id, trigger_source)
  WHERE trigger_source = 'event_reminder';

-- =====================================================
-- 4. UPDATE EXISTING ROWS
-- =====================================================

-- Set trigger_source = 'manual' for all existing scheduled messages
-- (This is already the default, but being explicit for clarity)
UPDATE public.scheduled_messages 
SET trigger_source = 'manual' 
WHERE trigger_source IS NULL;

COMMIT;
