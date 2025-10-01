-- ROLLBACK Migration: Remove Audit Retention Policy
-- Purpose: Clean removal of audit retention functions and tables
-- Date: 2025-10-02
-- Usage: Run this to completely remove audit retention features

BEGIN;

-- Unschedule cron job if it was enabled
-- SELECT cron.unschedule('daily_user_link_audit_purge');

-- Drop functions (cascade to remove dependencies)
DROP FUNCTION IF EXISTS public.run_user_link_audit_purge(integer);
DROP FUNCTION IF EXISTS public.purge_user_link_audit(integer);

-- Drop log table (preserves existing log data until explicitly dropped)
-- Comment out the next line if you want to preserve purge history:
DROP TABLE IF EXISTS public.user_link_audit_purge_runs;

COMMIT;
