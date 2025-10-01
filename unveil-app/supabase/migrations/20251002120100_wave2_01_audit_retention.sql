-- Migration: Wave 2 - Audit Retention Policy
-- Purpose: Add TTL purge job for user_link_audit with 180-day default
-- Date: 2025-10-02
-- 
-- SAFE DEFAULTS:
-- ✅ 180-day retention (6 months) - conservative for audit data
-- ✅ Manual execution only (no auto-scheduling)
-- ✅ PII-free logging of purge operations

BEGIN;

-- Core purge function with configurable retention
CREATE OR REPLACE FUNCTION public.purge_user_link_audit(retain_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
  v_cutoff_date timestamptz;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := NOW() - MAKE_INTERVAL(days => retain_days);
  
  -- Delete old audit records
  DELETE FROM public.user_link_audit
  WHERE created_at < v_cutoff_date;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Log the operation (PII-free)
  RAISE NOTICE 'Purged % rows from user_link_audit older than % days (cutoff: %)', 
    v_deleted, retain_days, v_cutoff_date;
  
  RETURN v_deleted;
END;
$$;

-- PII-free log table to track purge operations
CREATE TABLE IF NOT EXISTS public.user_link_audit_purge_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT NOW(),
  retain_days integer NOT NULL,
  rows_deleted integer NOT NULL,
  cutoff_date timestamptz NOT NULL
);

-- Wrapper function that logs purge operations
CREATE OR REPLACE FUNCTION public.run_user_link_audit_purge(retain_days integer DEFAULT 180)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_count integer;
  v_cutoff timestamptz;
BEGIN
  v_cutoff := NOW() - MAKE_INTERVAL(days => retain_days);
  v_count := public.purge_user_link_audit(retain_days);
  
  -- Log the operation
  INSERT INTO public.user_link_audit_purge_runs(retain_days, rows_deleted, cutoff_date) 
  VALUES (retain_days, v_count, v_cutoff);
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION public.purge_user_link_audit IS 
'Purges user_link_audit records older than retain_days. Default 180 days (6 months).
Usage: SELECT purge_user_link_audit(180) -- returns count of deleted rows';

COMMENT ON FUNCTION public.run_user_link_audit_purge IS 
'Wrapper that purges audit records AND logs the operation to purge_runs table.
Usage: SELECT run_user_link_audit_purge(180) -- purges and logs';

COMMENT ON TABLE public.user_link_audit_purge_runs IS 
'PII-free log of audit purge operations. Tracks when purges ran and how many rows deleted.';

-- Schedule daily via pg_cron if available (COMMENTED for manual enablement)
-- Uncomment after staging validation:
-- SELECT cron.schedule('daily_user_link_audit_purge', '15 3 * * *', 
--   $$SELECT public.run_user_link_audit_purge(180);$$);

COMMIT;
