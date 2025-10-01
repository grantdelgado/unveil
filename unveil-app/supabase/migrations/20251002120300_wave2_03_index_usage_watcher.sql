-- Migration: Wave 2 - Index Usage Watcher
-- Purpose: Daily snapshots of pg_stat_user_indexes + 30-day low-usage detection
-- Date: 2025-10-02
-- 
-- OBSERVABILITY: Tracks index usage patterns to identify cleanup candidates
-- NO AUTO-DROP: Only flags indexes, manual review required

BEGIN;

-- Table to store daily index usage snapshots
CREATE TABLE IF NOT EXISTS public.index_usage_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT NOW(),
  table_name text NOT NULL,
  index_name text NOT NULL,
  idx_scan bigint NOT NULL,
  idx_tup_read bigint NOT NULL,
  idx_tup_fetch bigint NOT NULL,
  
  -- Add constraint to prevent duplicate snapshots on same day
  UNIQUE(table_name, index_name, DATE(captured_at))
);

-- Function to capture current index usage statistics
CREATE OR REPLACE FUNCTION public.capture_index_usage_snapshot()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- Insert current index usage stats (ON CONFLICT handles same-day runs)
  INSERT INTO public.index_usage_snapshots(
    table_name, 
    index_name, 
    idx_scan, 
    idx_tup_read, 
    idx_tup_fetch
  )
  SELECT
    ui.relname as table_name,
    ui.indexrelname as index_name,
    ui.idx_scan,
    ui.idx_tup_read,
    ui.idx_tup_fetch
  FROM pg_stat_user_indexes ui
  ON CONFLICT (table_name, index_name, DATE(captured_at)) 
  DO UPDATE SET
    idx_scan = EXCLUDED.idx_scan,
    idx_tup_read = EXCLUDED.idx_tup_read,
    idx_tup_fetch = EXCLUDED.idx_tup_fetch,
    captured_at = NOW();
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RAISE NOTICE 'Captured index usage snapshot: % indexes recorded', v_inserted;
  RETURN v_inserted;
END;
$$;

-- View: Indexes with 0 scans across last 30 days (cleanup candidates)
CREATE OR REPLACE VIEW public.low_usage_indexes_30d AS
WITH index_stats_30d AS (
  SELECT 
    table_name,
    index_name,
    MAX(idx_scan) FILTER (WHERE captured_at >= NOW() - INTERVAL '30 days') as max_scans_30d,
    COUNT(*) FILTER (WHERE captured_at >= NOW() - INTERVAL '30 days') as snapshot_count_30d,
    MAX(captured_at) as last_snapshot
  FROM public.index_usage_snapshots
  GROUP BY table_name, index_name
)
SELECT 
  table_name,
  index_name,
  COALESCE(max_scans_30d, 0) as max_scans_30d,
  snapshot_count_30d,
  last_snapshot,
  CASE 
    WHEN snapshot_count_30d >= 7 AND COALESCE(max_scans_30d, 0) = 0 THEN 'CANDIDATE_FOR_REMOVAL'
    WHEN snapshot_count_30d < 7 THEN 'INSUFFICIENT_DATA'
    ELSE 'IN_USE'
  END as recommendation
FROM index_stats_30d
WHERE COALESCE(max_scans_30d, 0) = 0
ORDER BY snapshot_count_30d DESC, table_name, index_name;

-- Cleanup function to remove old snapshots (keep 90 days by default)
CREATE OR REPLACE FUNCTION public.cleanup_index_snapshots(retain_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.index_usage_snapshots
  WHERE captured_at < NOW() - MAKE_INTERVAL(days => retain_days);
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % old index snapshots (kept last % days)', v_deleted, retain_days;
  RETURN v_deleted;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.index_usage_snapshots IS 
'Daily snapshots of pg_stat_user_indexes for trend analysis. Used to identify unused indexes over time.';

COMMENT ON FUNCTION public.capture_index_usage_snapshot IS 
'Captures current index usage statistics. Run daily to build usage history.
Usage: SELECT capture_index_usage_snapshot();';

COMMENT ON VIEW public.low_usage_indexes_30d IS 
'Indexes with 0 scans in last 30 days. CANDIDATE_FOR_REMOVAL = 7+ snapshots with 0 scans.
Review before dropping - some indexes may be used for constraints or rare queries.';

-- Schedule daily via pg_cron if available (COMMENTED for manual enablement)
-- Uncomment after staging validation:
-- SELECT cron.schedule('daily_index_usage_snapshot', '5 3 * * *', 
--   $$SELECT public.capture_index_usage_snapshot();$$);

COMMIT;
