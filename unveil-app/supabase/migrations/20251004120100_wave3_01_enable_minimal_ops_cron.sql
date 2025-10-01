-- Migration: Wave 3 - Enable Minimal Ops Infrastructure
-- Purpose: Enable lightweight daily/weekly automation for database hygiene
-- Date: 2025-10-04
-- 
-- MINIMAL-KEEP APPROACH:
-- ✅ Daily index usage snapshots
-- ✅ Weekly audit purge (180-day retention)
-- ✅ Daily snapshot cleanup (90-day retention)

BEGIN;

-- Enable daily index usage snapshots @3:05 AM
-- This builds 30-day trend data for future optimization
SELECT cron.schedule(
  'daily_index_usage_snapshot', 
  '5 3 * * *', 
  $$SELECT public.capture_index_usage_snapshot();$$
);

-- Enable weekly audit purge @3:15 AM Sunday (180-day retention)
-- Prevents unbounded growth of user_link_audit table
SELECT cron.schedule(
  'weekly_audit_purge', 
  '15 3 * * 0',
  $$SELECT public.run_user_link_audit_purge(180);$$
);

-- Enable daily ops cleanup @4:00 AM (90-day snapshot retention)
-- Keeps index_usage_snapshots table from growing unbounded
SELECT cron.schedule(
  'daily_ops_cleanup', 
  '0 4 * * *',
  $$SELECT public.cleanup_index_snapshots(90);$$
);

COMMIT;
