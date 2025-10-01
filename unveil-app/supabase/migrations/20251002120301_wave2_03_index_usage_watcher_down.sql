-- ROLLBACK Migration: Remove Index Usage Watcher
-- Purpose: Clean removal of index usage monitoring infrastructure
-- Date: 2025-10-02
-- Usage: Run this to remove index usage tracking features

BEGIN;

-- Unschedule cron job if it was enabled
-- SELECT cron.unschedule('daily_index_usage_snapshot');

-- Drop view and functions
DROP VIEW IF EXISTS public.low_usage_indexes_30d;
DROP FUNCTION IF EXISTS public.cleanup_index_snapshots(integer);
DROP FUNCTION IF EXISTS public.capture_index_usage_snapshot();

-- Drop snapshots table (preserves historical data until explicitly dropped)
-- Comment out the next line if you want to preserve snapshot history:
DROP TABLE IF EXISTS public.index_usage_snapshots;

COMMIT;
