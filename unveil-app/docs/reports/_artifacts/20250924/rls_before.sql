-- RLS POLICIES AND FUNCTIONS BEFORE CONSOLIDATION
-- Generated: September 24, 2025
-- Database: PostgreSQL 15.8.1.085

-- ==============================================================================
-- CURRENT RLS POLICIES (showing overlapping patterns)
-- ==============================================================================

-- EVENT_GUESTS TABLE (3 overlapping policies for ALL operations)
-- Policy 1: Host management access
CREATE POLICY event_guests_host_management ON public.event_guests FOR ALL 
USING (is_event_host(event_id));

-- Policy 2: Self-access for linked users
CREATE POLICY event_guests_self_access ON public.event_guests FOR ALL 
USING (user_id = (SELECT auth.uid()));

-- Policy 3: Prevent all deletes (permissive but blocks deletion)
CREATE POLICY event_guests_no_delete ON public.event_guests FOR DELETE 
USING (false);

-- MESSAGES TABLE (4 separate policies by operation)
-- Policy 1: Read access via can_access_event
CREATE POLICY messages_select_optimized ON public.messages FOR SELECT 
USING (can_access_event(event_id));

-- Policy 2: Insert restricted to hosts only  
CREATE POLICY messages_insert_host_only ON public.messages FOR INSERT TO authenticated
WITH CHECK (is_event_host(event_id));

-- Policy 3: Update restricted to hosts only
CREATE POLICY messages_update_host_only ON public.messages FOR UPDATE TO authenticated
USING (is_event_host(event_id)) WITH CHECK (is_event_host(event_id));

-- Policy 4: Delete restricted to hosts only
CREATE POLICY messages_delete_host_only ON public.messages FOR DELETE TO authenticated
USING (is_event_host(event_id));

-- MESSAGE_DELIVERIES TABLE (3 policies with complex logic)
-- Policy 1: Complex SELECT with CASE logic and subqueries
CREATE POLICY message_deliveries_select_optimized ON public.message_deliveries FOR SELECT
USING (
  CASE
    WHEN (user_id IS NOT NULL) THEN (user_id = (SELECT auth.uid()))
    WHEN (guest_id IS NOT NULL) THEN can_access_event((SELECT eg.event_id FROM event_guests eg WHERE eg.id = message_deliveries.guest_id))
    ELSE false
  END
);

-- Policy 2: Insert with delivery management function
CREATE POLICY message_deliveries_insert_host_only ON public.message_deliveries FOR INSERT
WITH CHECK (can_manage_message_delivery(message_id, scheduled_message_id));

-- Policy 3: Update with delivery management function  
CREATE POLICY message_deliveries_update_host_only ON public.message_deliveries FOR UPDATE
USING (can_manage_message_delivery(message_id, scheduled_message_id))
WITH CHECK (can_manage_message_delivery(message_id, scheduled_message_id));

-- MEDIA TABLE (3 policies for different operations)
-- Policy 1: SELECT access via can_access_event
CREATE POLICY media_select_event_accessible ON public.media FOR SELECT TO authenticated
USING (can_access_event(event_id));

-- Policy 2: INSERT access via can_access_event
CREATE POLICY media_insert_event_participant ON public.media FOR INSERT TO authenticated
WITH CHECK (can_access_event(event_id));

-- Policy 3: UPDATE only own uploads
CREATE POLICY media_update_own ON public.media FOR UPDATE
USING (uploader_user_id = (SELECT auth.uid()));

-- SCHEDULED_MESSAGES TABLE (1 consolidated policy - already optimized)
CREATE POLICY scheduled_messages_host_only_optimized ON public.scheduled_messages FOR ALL
USING (can_write_event(event_id)) WITH CHECK (can_write_event(event_id));

-- ==============================================================================
-- CURRENT HELPER FUNCTIONS 
-- ==============================================================================

-- Function: can_access_event (already SECURITY DEFINER with proper search_path)
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN public.is_event_host(p_event_id) OR public.is_event_guest(p_event_id);
END;
$function$;

-- Function: is_event_host (already SECURITY DEFINER with proper search_path)
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Secondary check for guest with host role
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.user_id = current_user_id
        AND eg.role = 'host'
    );
END;
$function$;

-- Function: is_event_guest (single parameter version)
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1
        FROM public.event_guests eg
        WHERE eg.event_id = p_event_id
          AND eg.user_id = (SELECT auth.uid())
          AND eg.removed_at IS NULL
    );
END;
$function$;

-- Function: is_event_guest (two parameter version)
CREATE OR REPLACE FUNCTION public.is_event_guest(p_user_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, pg_temp'  -- NOTE: Inconsistent search_path format
AS $function$
BEGIN
    IF p_user_id IS NULL OR p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1
        FROM public.event_guests eg
        WHERE eg.event_id = p_event_id
          AND eg.user_id = p_user_id
          AND eg.removed_at IS NULL
    );
END;
$function$;

-- ==============================================================================
-- PERFORMANCE BASELINES BEFORE CONSOLIDATION
-- ==============================================================================

-- BASELINE 1: Last 50 messages by event
-- Planning Time: 27.192 ms ⚠️ High planning overhead
-- Execution Time: 4.256 ms ✅ Good execution
-- Index Used: idx_messages_event_created_id ✅ Optimal

-- BASELINE 2: Deliveries by message_id  
-- Planning Time: 23.593 ms ⚠️ High planning overhead
-- Execution Time: 4.955 ms ⚠️ Moderate execution
-- Issue: Sequential scan on messages table in subquery ⚠️

-- ==============================================================================
-- IDENTIFIED ISSUES
-- ==============================================================================

-- 1. OVERLAPPING POLICIES: event_guests has 3 permissive policies for same operations
-- 2. COMPLEX RLS LOGIC: message_deliveries SELECT uses expensive CASE + subqueries  
-- 3. HIGH PLANNING TIME: 20-27ms planning overhead suggests policy complexity
-- 4. SUBQUERY INEFFICIENCY: Multiple nested EXISTS and SELECT auth.uid() calls
-- 5. INCONSISTENT SEARCH_PATH: Some functions use different formats
