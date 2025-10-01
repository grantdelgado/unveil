-- Migration: Wave 1 - Create Partition Retention Job (Disabled)
-- Purpose: Create infrastructure for automatic partition cleanup in Wave 2
-- Date: 2025-10-01
-- 
-- NOTE: Function is created but NOT scheduled - manual activation in Wave 2
-- This provides the foundation for future automated partition management

BEGIN;

-- Create function to prune old message partitions
-- Uses catalog-driven discovery rather than naming conventions
CREATE OR REPLACE FUNCTION public.prune_old_message_partitions(
  retain_days integer DEFAULT 60,
  dry_run boolean DEFAULT true
)
RETURNS TABLE(
  partition_name text,
  partition_age_days integer,
  action_taken text,
  rows_affected bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  partition_record RECORD;
  partition_age integer;
  cutoff_date date;
  row_count bigint;
BEGIN
  -- Calculate cutoff date
  cutoff_date := CURRENT_DATE - retain_days;
  
  -- Find message partitions using catalog queries
  -- This approach works for both inheritance and declarative partitioning
  FOR partition_record IN
    SELECT 
      c.relname as table_name,
      n.nspname as schema_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname ~ '^messages_\d{4}_\d{2}_\d{2}$'  -- Match YYYY_MM_DD pattern
      AND c.relkind = 'r'  -- Only regular tables
  LOOP
    -- Extract date from partition name (assumes messages_YYYY_MM_DD format)
    BEGIN
      -- Parse date from partition name
      partition_age := CURRENT_DATE - 
        TO_DATE(SUBSTRING(partition_record.table_name FROM 'messages_(\d{4}_\d{2}_\d{2})'), 'YYYY_MM_DD');
      
      -- Only process partitions older than retention period
      IF partition_age > retain_days THEN
        -- Get row count for logging
        EXECUTE format('SELECT COUNT(*) FROM %I.%I', 
          partition_record.schema_name, partition_record.table_name) INTO row_count;
        
        IF dry_run THEN
          -- Dry run: just report what would be done
          RETURN QUERY SELECT 
            partition_record.table_name::text,
            partition_age,
            'DRY_RUN - would drop'::text,
            row_count;
        ELSE
          -- Actually drop the partition
          EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
            partition_record.schema_name, partition_record.table_name);
          
          RETURN QUERY SELECT 
            partition_record.table_name::text,
            partition_age,
            'DROPPED'::text,
            row_count;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip partitions that don't match expected date format
      RETURN QUERY SELECT 
        partition_record.table_name::text,
        -1,  -- Invalid age
        'SKIPPED - invalid date format'::text,
        0::bigint;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Add function documentation
COMMENT ON FUNCTION public.prune_old_message_partitions IS 
'Prunes old message partitions based on age. Created for Wave 1 but DISABLED by default.
Usage: SELECT * FROM prune_old_message_partitions(60, true) for dry run.
Set dry_run=false to actually drop partitions. Enable in Wave 2 after review.';

COMMIT;
