-- ROLLBACK Migration: Remove Partition Sentinel
-- Purpose: Clean removal of partition monitoring infrastructure
-- Date: 2025-10-02
-- Usage: Run this to remove partition monitoring features

BEGIN;

-- Unschedule cron job if it was enabled
-- SELECT cron.unschedule('daily_partition_sentinel');

-- Drop view and functions
DROP VIEW IF EXISTS public.partition_sightings_recent;
DROP FUNCTION IF EXISTS public.cleanup_partition_sightings(integer);
DROP FUNCTION IF EXISTS public.scan_message_partitions();

-- Drop sightings table (preserves historical data until explicitly dropped)
-- Comment out the next line if you want to preserve sighting history:
DROP TABLE IF EXISTS public.partition_sightings;

COMMIT;
