-- Migration: Wave 3 - Enable Minimal Ops Infrastructure (Manual Scheduling)
-- Purpose: Document automation approach since pg_cron not available
-- Date: 2025-10-04
-- 
-- NOTE: pg_cron extension not installed - using manual scheduling approach
-- See 20251004120102_wave3_01_enable_minimal_ops_manual.sql for helper function

BEGIN;

-- pg_cron not available - manual scheduling documented in helper function
-- Use show_ops_schedule() to see recommended execution times

-- COMMENTED OUT - pg_cron not installed:
-- SELECT cron.schedule('daily_index_usage_snapshot', '5 3 * * *', 
--   $$SELECT public.capture_index_usage_snapshot();$$);
-- SELECT cron.schedule('weekly_audit_purge', '15 3 * * 0',
--   $$SELECT public.run_user_link_audit_purge(180);$$);
-- SELECT cron.schedule('daily_ops_cleanup', '0 4 * * *',
--   $$SELECT public.cleanup_index_snapshots(90);$$);

-- Instead, use manual execution:
-- Daily: SELECT public.capture_index_usage_snapshot();
-- Weekly: SELECT public.run_user_link_audit_purge(180);
-- Daily: SELECT public.cleanup_index_snapshots(90);

DO $$
BEGIN
  RAISE NOTICE 'Manual scheduling approach - use show_ops_schedule() for recommended execution times';
END $$;

COMMIT;
