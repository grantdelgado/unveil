-- ROLLBACK Migration: Disable Ops Infrastructure (Manual Scheduling)
-- Purpose: No-op rollback since no cron jobs were scheduled
-- Date: 2025-10-04
-- Usage: This is a no-op since pg_cron is not installed

BEGIN;

-- No cron jobs to unschedule since pg_cron is not available
-- COMMENTED OUT - pg_cron not installed:
-- SELECT cron.unschedule('daily_index_usage_snapshot');
-- SELECT cron.unschedule('weekly_audit_purge');
-- SELECT cron.unschedule('daily_ops_cleanup');

DO $$
BEGIN
  RAISE NOTICE 'No cron jobs to disable - manual scheduling approach used';
END $$;

COMMIT;
