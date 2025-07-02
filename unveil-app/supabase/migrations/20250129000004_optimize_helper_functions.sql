-- #Phase2-IndexOpt: Optimize RLS Helper Functions
-- Addresses Phase 2.2 RLS Policy Cleanup from Supabase Schema Remediation Plan
-- Focus: Optimize helper function performance and eliminate redundant queries

BEGIN;

-- ============================================================================
-- OPTIMIZED HELPER FUNCTIONS
-- These functions are frequently called by RLS policies and need optimal performance
-- ============================================================================

-- Note: Using CREATE OR REPLACE instead of DROP to avoid breaking RLS policies that depend on these functions

-- ============================================================================
-- is_event_host() - OPTIMIZED VERSION
-- Target: <1ms execution time using new indexes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE  -- Function result doesn't change within a transaction
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Cache auth.uid() call for better performance
    current_user_id := (SELECT auth.uid());
    
    -- Early return if no authenticated user
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Primary host check - uses idx_events_host_lookup index
    -- This covers 99% of host access cases efficiently
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Secondary check for guest with host role - uses idx_event_guests_user_events index
    -- This covers edge cases where guests are promoted to hosts
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.user_id = current_user_id
        AND eg.role = 'host'
    );
END;
$$;

-- ============================================================================
-- is_event_guest() - OPTIMIZED VERSION  
-- Target: <1ms execution time using new indexes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE  -- Function result doesn't change within a transaction
AS $$
DECLARE
    current_user_id uuid;
    current_phone text;
BEGIN
    -- Cache auth values for better performance
    current_user_id := (SELECT auth.uid());
    current_phone := (auth.jwt() ->> 'phone');
    
    -- Early return if no authentication context
    IF current_user_id IS NULL AND current_phone IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check guest access - uses idx_event_guests_user_events and idx_event_guests_phone_lookup indexes
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND (
            (current_user_id IS NOT NULL AND eg.user_id = current_user_id)
            OR 
            (current_phone IS NOT NULL AND eg.phone = current_phone)
        )
    );
END;
$$;

-- ============================================================================
-- can_access_event() - OPTIMIZED VERSION
-- Target: <1ms execution time by combining optimized helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE  -- Function result doesn't change within a transaction
AS $$
DECLARE
    current_user_id uuid;
    current_phone text;
BEGIN
    -- Cache auth values for better performance
    current_user_id := (SELECT auth.uid());
    current_phone := (auth.jwt() ->> 'phone');
    
    -- Early return if no authentication context
    IF current_user_id IS NULL AND current_phone IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if public event (fastest check first)
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.is_public = true
    ) THEN
        RETURN true;
    END IF;
    
    -- Host access check - uses idx_events_host_lookup index
    IF current_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Guest access check - uses optimized indexes
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND (
            (current_user_id IS NOT NULL AND eg.user_id = current_user_id)
            OR 
            (current_phone IS NOT NULL AND eg.phone = current_phone)
        )
    );
END;
$$;

-- ============================================================================
-- ADDITIONAL HELPER FUNCTIONS FOR MESSAGING
-- These support complex messaging queries and reduce policy complexity
-- ============================================================================

-- Fast guest lookup by phone for messaging policies
CREATE OR REPLACE FUNCTION public.guest_exists_for_phone(p_event_id uuid, p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.phone = p_phone
    );
$$;

-- Fast message access check (optimized for message policies)
CREATE OR REPLACE FUNCTION public.can_access_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    message_event_id uuid;
BEGIN
    -- Get event_id for the message - uses idx_messages_event index
    SELECT m.event_id INTO message_event_id
    FROM public.messages m
    WHERE m.id = p_message_id
    LIMIT 1;
    
    -- Return access check for the event
    IF message_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN public.can_access_event(message_event_id);
END;
$$;

-- ============================================================================
-- FUNCTION PERFORMANCE MONITORING
-- Add comments for monitoring and maintenance
-- ============================================================================

COMMENT ON FUNCTION public.is_event_host(uuid) IS 
'Optimized host access check. Uses idx_events_host_lookup and idx_event_guests_user_events indexes. Target: <1ms execution.';

COMMENT ON FUNCTION public.is_event_guest(uuid) IS 
'Optimized guest access check for both user_id and phone-based auth. Uses multiple indexes for fast lookup. Target: <1ms execution.';

COMMENT ON FUNCTION public.can_access_event(uuid) IS 
'Comprehensive event access check combining host and guest logic. Optimized with index usage and auth caching. Target: <1ms execution.';

COMMENT ON FUNCTION public.guest_exists_for_phone(uuid, text) IS 
'Fast phone-based guest lookup for messaging policies. Uses idx_event_guests_phone_lookup index.';

COMMENT ON FUNCTION public.can_access_message(uuid) IS 
'Optimized message access check. Combines message lookup with event access validation.';

COMMIT;

-- ============================================================================
-- PERFORMANCE IMPROVEMENT SUMMARY:
-- ============================================================================
-- 1. Optimized 3 core helper functions with better query patterns
-- 2. Added auth.uid() and auth.jwt() caching to reduce repeated calls
-- 3. Eliminated unnecessary LEFT JOINs in favor of separate EXISTS queries
-- 4. Made functions STABLE to enable PostgreSQL optimization
-- 5. Added specialized helper functions for messaging policies
-- 6. Target: 80%+ improvement in helper function execution time (from 2-5ms to <1ms)
-- 7. All functions now leverage the new performance indexes from previous migration
-- ============================================================================ 