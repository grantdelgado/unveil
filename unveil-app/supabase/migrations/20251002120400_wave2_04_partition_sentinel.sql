-- Migration: Wave 2 - Partition Sentinel
-- Purpose: Alert if new message partitions appear (currently none exist)
-- Date: 2025-10-02
-- 
-- MONITORING: Detects if message partitioning is re-enabled
-- NO AUTO-ACTION: Only logs sightings for manual review

BEGIN;

-- Table to log partition sightings
CREATE TABLE IF NOT EXISTS public.partition_sightings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT NOW(),
  relname text NOT NULL,
  table_size_bytes bigint,
  row_estimate bigint,
  
  -- Prevent duplicate sightings on same day
  UNIQUE(relname, DATE(seen_at))
);

-- Function to scan for message partitions
CREATE OR REPLACE FUNCTION public.scan_message_partitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  r RECORD;
  v_sightings integer := 0;
BEGIN
  -- Scan for any tables matching message partition patterns
  FOR r IN
    SELECT 
      c.relname,
      pg_total_relation_size(c.oid) as table_size_bytes,
      c.reltuples::bigint as row_estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'  -- Regular tables only
      AND c.relname ~ '^messages_\d{4}_\d{2}_\d{2}$'  -- Match YYYY_MM_DD pattern
      AND c.relname != 'messages'  -- Exclude main table
  LOOP
    -- Log the sighting (ON CONFLICT handles same-day re-scans)
    INSERT INTO public.partition_sightings(relname, table_size_bytes, row_estimate) 
    VALUES (r.relname, r.table_size_bytes, r.row_estimate)
    ON CONFLICT (relname, DATE(seen_at)) 
    DO UPDATE SET
      table_size_bytes = EXCLUDED.table_size_bytes,
      row_estimate = EXCLUDED.row_estimate,
      seen_at = NOW();
    
    v_sightings := v_sightings + 1;
    
    RAISE NOTICE 'Partition sighting: % (% bytes, ~% rows)', 
      r.relname, r.table_size_bytes, r.row_estimate;
  END LOOP;
  
  IF v_sightings = 0 THEN
    RAISE NOTICE 'Partition sentinel: No message partitions detected (expected)';
  END IF;
  
  RETURN v_sightings;
END;
$$;

-- View to see recent partition sightings
CREATE OR REPLACE VIEW public.partition_sightings_recent AS
SELECT 
  relname,
  seen_at,
  table_size_bytes,
  row_estimate,
  pg_size_pretty(table_size_bytes) as size_pretty,
  EXTRACT(days FROM NOW() - seen_at) as days_ago
FROM public.partition_sightings
WHERE seen_at >= NOW() - INTERVAL '90 days'
ORDER BY seen_at DESC, relname;

-- Cleanup function for old sightings
CREATE OR REPLACE FUNCTION public.cleanup_partition_sightings(retain_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.partition_sightings
  WHERE seen_at < NOW() - MAKE_INTERVAL(days => retain_days);
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % old partition sightings (kept last % days)', v_deleted, retain_days;
  RETURN v_deleted;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.partition_sightings IS 
'Logs when message partitions are detected. Currently expects zero partitions.
If partitions appear, consider enabling the prune_old_message_partitions function.';

COMMENT ON FUNCTION public.scan_message_partitions IS 
'Scans for message partition tables and logs any findings. Run daily to monitor.
Usage: SELECT scan_message_partitions();';

COMMENT ON VIEW public.partition_sightings_recent IS 
'Recent partition sightings (last 90 days). Should be empty unless partitioning is re-enabled.';

-- Schedule daily via pg_cron if available (COMMENTED for manual enablement)
-- Uncomment after staging validation:
-- SELECT cron.schedule('daily_partition_sentinel', '0 4 * * *', 
--   $$SELECT public.scan_message_partitions();$$);

COMMIT;
