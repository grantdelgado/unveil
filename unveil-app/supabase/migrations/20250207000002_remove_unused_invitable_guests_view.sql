-- Remove unused invitable_guests view
-- This view was created but never used in the application
-- The is_invitable logic is already implemented directly in the codebase

-- =====================================================
-- SAFETY CHECK: Verify no dependencies exist
-- =====================================================

-- Check for any views that might depend on this view
DO $$
DECLARE
    dependent_count integer;
BEGIN
    SELECT COUNT(*) INTO dependent_count
    FROM information_schema.view_table_usage 
    WHERE table_name = 'invitable_guests';
    
    IF dependent_count > 0 THEN
        RAISE EXCEPTION 'Cannot drop invitable_guests view: % dependent objects found', dependent_count;
    END IF;
    
    RAISE NOTICE 'Safety check passed: No dependent views found';
END;
$$;

-- =====================================================
-- DROP THE VIEW
-- =====================================================

-- Drop the invitable_guests view
DROP VIEW IF EXISTS public.invitable_guests;

-- =====================================================
-- CLEANUP TYPE DEFINITIONS (if any)
-- =====================================================

-- Remove the view from Supabase type generation
-- This will be reflected in the next typegen run

-- =====================================================
-- LOG COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Successfully removed unused invitable_guests view';
    RAISE NOTICE 'Rationale: View was never used in application code';
    RAISE NOTICE 'The is_invitable logic (role != ''host'' AND removed_at IS NULL) is already implemented directly in:';
    RAISE NOTICE '- API endpoints (guest.role === ''host'' checks)';
    RAISE NOTICE '- Client components (isHost = guest.role === ''host'')';
    RAISE NOTICE '- RPC functions (WHERE role != ''host'')';
END;
$$;
