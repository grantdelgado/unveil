-- Migration: Wave 3 - Remove Partition Sentinel (Minimal-Keep Decision)
-- Purpose: Remove partition monitoring since no partitions exist
-- Date: 2025-10-04
-- 
-- RATIONALE: No message partitions exist, monitoring is unnecessary overhead

BEGIN;

-- Remove partition monitoring infrastructure
DROP VIEW IF EXISTS public.partition_sightings_recent;
DROP FUNCTION IF EXISTS public.cleanup_partition_sightings(integer);
DROP FUNCTION IF EXISTS public.scan_message_partitions();
DROP TABLE IF EXISTS public.partition_sightings;

COMMIT;
