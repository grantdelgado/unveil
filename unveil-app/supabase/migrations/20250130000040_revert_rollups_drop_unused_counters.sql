-- ============================================================================
-- Migration: Revert Message Rollups Implementation
-- ============================================================================
-- 
-- Reverts the rollup analytics implementation added in 20250130000030.
-- Removes view, RPC, generated column and related indexes.
-- Keeps messages.delivered_count/failed_count due to active UI dependencies.
--
-- Changes:
-- 1. Drop rollup view and RPC function
-- 2. Drop generated column and performance indexes
-- 3. Keep messages table columns (delivered_count, failed_count, delivered_at)
--
-- No functional changes to messaging or Twilio pipeline.

-- 1. Drop view and RPC if present
DROP VIEW IF EXISTS public.message_delivery_rollups_v1 CASCADE;
DROP FUNCTION IF EXISTS public.get_message_rollups(uuid);

-- 2. Drop generated column + related indexes (if they exist)
DROP INDEX IF EXISTS public.idx_md_message_final_updated;
DROP INDEX IF EXISTS public.idx_md_message_final;
ALTER TABLE public.message_deliveries
  DROP COLUMN IF EXISTS final_status;

-- Note: Keeping messages.delivered_count, messages.failed_count, messages.delivered_at
-- due to active usage in UI components (RecentMessages, useEventMessages)

-- Add comment for clarity
COMMENT ON COLUMN public.messages.delivered_count IS 
'Legacy analytics field - currently unused but kept for UI compatibility';

COMMENT ON COLUMN public.messages.failed_count IS 
'Legacy analytics field - currently unused but kept for UI compatibility';
