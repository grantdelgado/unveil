-- Migration: Drop Legacy event_participants Table
-- Purpose: Clean up the database by removing the legacy table and all dependent objects

-- First, check that event_guests has all data
DO $$
DECLARE
    guest_count INTEGER;
    participant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO guest_count FROM public.event_guests;
    SELECT COUNT(*) INTO participant_count FROM public.event_participants;
    
    -- Log the counts for verification
    RAISE NOTICE 'event_guests count: %, event_participants count: %', guest_count, participant_count;
    
    -- Safety check: ensure we have guests migrated
    IF guest_count = 0 AND participant_count > 0 THEN
        RAISE EXCEPTION 'Cannot drop event_participants table: no guests found in event_guests but participants exist in event_participants';
    END IF;
END $$;

-- Drop all policies on event_participants table
DROP POLICY IF EXISTS "participants_manage_as_host" ON public.event_participants;
DROP POLICY IF EXISTS "participants_select_event_related" ON public.event_participants;

-- Drop any indexes specifically for event_participants
DROP INDEX IF EXISTS idx_event_participants_user_role;
DROP INDEX IF EXISTS idx_event_participants_event_status;
DROP INDEX IF EXISTS idx_event_participants_event_id;
DROP INDEX IF EXISTS idx_event_participants_user_id;

-- Drop foreign key constraints (if they exist as separate objects)
-- Note: CASCADE on the table drop should handle this, but being explicit

-- Drop the event_participants table with CASCADE to remove all dependent objects
DROP TABLE IF EXISTS public.event_participants CASCADE;

-- Verify the table is gone
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_participants' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'event_participants table still exists after drop attempt';
    ELSE
        RAISE NOTICE 'Successfully dropped event_participants table and all dependent objects';
    END IF;
END $$;

-- Double-check that our helper functions are correctly using event_guests
-- (This is validation, not modification)
DO $$
DECLARE
    func_def TEXT;
BEGIN
    SELECT routine_definition INTO func_def 
    FROM information_schema.routines 
    WHERE routine_name = 'can_access_event' AND routine_schema = 'public';
    
    IF func_def LIKE '%event_participants%' THEN
        RAISE WARNING 'can_access_event function still references event_participants';
    ELSE
        RAISE NOTICE 'can_access_event function correctly uses event_guests';
    END IF;
    
    SELECT routine_definition INTO func_def 
    FROM information_schema.routines 
    WHERE routine_name = 'is_event_host' AND routine_schema = 'public';
    
    IF func_def LIKE '%event_participants%' THEN
        RAISE WARNING 'is_event_host function still references event_participants';
    ELSE
        RAISE NOTICE 'is_event_host function correctly uses event_guests';
    END IF;
END $$;

-- Create a final summary
DO $$
DECLARE
    tables_with_participants INTEGER;
    functions_with_participants INTEGER;
    policies_with_participants INTEGER;
BEGIN
    -- Check for any remaining references to event_participants
    SELECT COUNT(*) INTO tables_with_participants
    FROM information_schema.tables 
    WHERE table_name = 'event_participants';
    
    SELECT COUNT(*) INTO functions_with_participants
    FROM information_schema.routines 
    WHERE routine_definition LIKE '%event_participants%' 
    AND routine_schema = 'public';
    
    SELECT COUNT(*) INTO policies_with_participants
    FROM pg_policies 
    WHERE (qual LIKE '%event_participants%' OR with_check LIKE '%event_participants%');
    
    RAISE NOTICE 'Cleanup Summary:';
    RAISE NOTICE '  - Tables with event_participants: %', tables_with_participants;
    RAISE NOTICE '  - Functions with event_participants references: %', functions_with_participants;
    RAISE NOTICE '  - Policies with event_participants references: %', policies_with_participants;
    
    IF tables_with_participants = 0 AND functions_with_participants = 0 AND policies_with_participants = 0 THEN
        RAISE NOTICE 'SUCCESS: All event_participants references have been removed!';
    ELSE
        RAISE WARNING 'Some event_participants references may still exist and need manual cleanup';
    END IF;
END $$; 