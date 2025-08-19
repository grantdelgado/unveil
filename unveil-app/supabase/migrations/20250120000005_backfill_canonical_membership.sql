-- Backfill/dedupe migration for canonical membership
-- Handles existing duplicate rows for same (event_id, phone)

-- Step 1: Create function to safely dedupe and preserve history
CREATE OR REPLACE FUNCTION public.dedupe_event_guests()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_duplicate_count integer := 0;
  v_canonical_count integer := 0;
  v_removed_count integer := 0;
  v_result json;
  duplicate_record record;
  canonical_record record;
  dependent_record record;
BEGIN
  -- Process each group of duplicates
  FOR duplicate_record IN
    SELECT event_id, phone, array_agg(id ORDER BY created_at ASC) as guest_ids
    FROM public.event_guests 
    WHERE phone IS NOT NULL
    GROUP BY event_id, phone
    HAVING COUNT(*) > 1
  LOOP
    v_duplicate_count := v_duplicate_count + 1;
    
    -- Choose canonical record (oldest with most history)
    SELECT * INTO canonical_record
    FROM public.event_guests 
    WHERE id = duplicate_record.guest_ids[1]  -- First (oldest) record
    LIMIT 1;
    
    v_canonical_count := v_canonical_count + 1;
    
    -- Process dependent records (message_deliveries, etc.)
    FOR dependent_record IN
      SELECT DISTINCT guest_id 
      FROM public.message_deliveries 
      WHERE guest_id = ANY(duplicate_record.guest_ids[2:])  -- Skip canonical (first)
    LOOP
      -- Re-point message_deliveries to canonical record
      UPDATE public.message_deliveries 
      SET guest_id = canonical_record.id
      WHERE guest_id = dependent_record.guest_id;
    END LOOP;
    
    -- Mark non-canonical records as removed (preserve them for audit)
    UPDATE public.event_guests 
    SET 
      removed_at = COALESCE(removed_at, NOW()),
      updated_at = NOW()
    WHERE id = ANY(duplicate_record.guest_ids[2:])  -- Skip canonical (first)
      AND removed_at IS NULL;  -- Don't double-remove
    
    v_removed_count := v_removed_count + array_length(duplicate_record.guest_ids, 1) - 1;
  END LOOP;

  -- Build result
  SELECT json_build_object(
    'success', true,
    'duplicate_groups_processed', v_duplicate_count,
    'canonical_records_preserved', v_canonical_count,
    'duplicate_records_removed', v_removed_count,
    'message', format('Processed %s duplicate groups, preserved %s canonical records, marked %s duplicates as removed',
      v_duplicate_count, v_canonical_count, v_removed_count)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Step 2: Execute the deduplication (with logging)
DO $$
DECLARE
  v_result json;
  v_pre_count integer;
  v_post_active_count integer;
  v_post_removed_count integer;
BEGIN
  -- Count before
  SELECT COUNT(*) INTO v_pre_count FROM public.event_guests;
  
  RAISE NOTICE 'Starting canonical membership backfill...';
  RAISE NOTICE 'Total event_guests records before: %', v_pre_count;
  
  -- Execute deduplication
  SELECT public.dedupe_event_guests() INTO v_result;
  
  -- Count after
  SELECT COUNT(*) INTO v_post_active_count 
  FROM public.event_guests WHERE removed_at IS NULL;
  
  SELECT COUNT(*) INTO v_post_removed_count 
  FROM public.event_guests WHERE removed_at IS NOT NULL;
  
  RAISE NOTICE 'Deduplication result: %', v_result;
  RAISE NOTICE 'Active records after: %', v_post_active_count;
  RAISE NOTICE 'Removed records after: %', v_post_removed_count;
  RAISE NOTICE 'Total records after: %', v_post_active_count + v_post_removed_count;
  RAISE NOTICE 'Canonical membership backfill completed successfully';
END;
$$;

-- Step 3: Verify canonical constraint can now be enforced
DO $$
DECLARE
  v_constraint_violations integer;
BEGIN
  -- Check for any remaining active duplicates
  SELECT COUNT(*) INTO v_constraint_violations
  FROM (
    SELECT event_id, phone, COUNT(*) as cnt
    FROM public.event_guests 
    WHERE removed_at IS NULL AND phone IS NOT NULL
    GROUP BY event_id, phone
    HAVING COUNT(*) > 1
  ) violations;
  
  IF v_constraint_violations > 0 THEN
    RAISE EXCEPTION 'Canonical constraint violations still exist: % groups have multiple active records', v_constraint_violations;
  END IF;
  
  RAISE NOTICE 'Canonical constraint verification passed - no active duplicates found';
END;
$$;

-- Step 4: Clean up the deduplication function
DROP FUNCTION IF EXISTS public.dedupe_event_guests();

-- Step 5: Add final verification comment
COMMENT ON TABLE public.event_guests IS 
'Event guest memberships with canonical constraint: one active row per (event_id, phone). Historical duplicates preserved with removed_at timestamp.';
