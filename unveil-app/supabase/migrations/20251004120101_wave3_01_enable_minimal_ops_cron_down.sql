-- ROLLBACK Migration: Disable Ops Infrastructure Cron Jobs
-- Purpose: Disable all automated database hygiene jobs
-- Date: 2025-10-04
-- Usage: Run this to disable automation (keeps functions and data)

BEGIN;

-- Disable all scheduled jobs
SELECT cron.unschedule('daily_index_usage_snapshot');
SELECT cron.unschedule('weekly_audit_purge');
SELECT cron.unschedule('daily_ops_cleanup');

COMMIT;
