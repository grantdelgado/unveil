-- Migration: Wave 3 - Enable Minimal Ops Infrastructure (Manual Scheduling)
-- Purpose: Document manual scheduling approach since pg_cron not installed
-- Date: 2025-10-04
-- 
-- MINIMAL-KEEP APPROACH (Manual Execution):
-- ✅ Functions ready for daily/weekly execution
-- ✅ No auto-scheduling (pg_cron not installed)

BEGIN;

-- Create a helper function to show recommended schedule
CREATE OR REPLACE FUNCTION public.show_ops_schedule()
RETURNS TABLE(
  job_name text,
  frequency text,
  sql_command text,
  next_recommended_run text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    'daily_index_usage_snapshot'::text,
    'Daily at 3:05 AM'::text,
    'SELECT public.capture_index_usage_snapshot();'::text,
    'Run daily to build 30-day usage trends'::text
  UNION ALL
  SELECT 
    'weekly_audit_purge'::text,
    'Weekly Sunday at 3:15 AM'::text, 
    'SELECT public.run_user_link_audit_purge(180);'::text,
    'Run weekly to maintain 180-day audit retention'::text
  UNION ALL
  SELECT
    'daily_ops_cleanup'::text,
    'Daily at 4:00 AM'::text,
    'SELECT public.cleanup_index_snapshots(90);'::text,
    'Run daily to maintain 90-day snapshot retention'::text;
$$;

-- Add documentation
COMMENT ON FUNCTION public.show_ops_schedule IS 
'Shows recommended manual execution schedule for database hygiene operations.
Usage: SELECT * FROM show_ops_schedule();';

COMMIT;
