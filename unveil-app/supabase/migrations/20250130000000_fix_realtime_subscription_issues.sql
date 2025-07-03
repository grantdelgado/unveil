-- Migration: Fix Realtime Subscription Issues
-- Date: 2025-01-30
-- Purpose: Optimize RLS policies and database configuration to prevent subscription timeouts

BEGIN;

-- =====================================================
-- ANALYZE AND FIX MESSAGES TABLE RLS POLICIES
-- =====================================================

-- Drop existing problematic policies that may cause subscription timeouts
DROP POLICY IF EXISTS "messages_select_optimized" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_update_host_only" ON public.messages;
DROP POLICY IF EXISTS "messages_select_event_accessible" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_event_participant" ON public.messages;

-- Create a single, highly optimized policy for message access
-- This policy uses indexes efficiently and avoids complex joins that can timeout
CREATE POLICY "messages_realtime_optimized" ON public.messages
FOR ALL TO authenticated, anon
USING (
  -- Use a more efficient approach for RLS that works well with realtime
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = messages.event_id 
    AND (
      -- Host access: Check if user is the host
      e.host_user_id = (SELECT auth.uid())
      OR
      -- Guest access: Check via phone number in JWT for phone-first auth
      EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = e.id 
        AND eg.phone = (auth.jwt() ->> 'phone')
        AND (auth.jwt() ->> 'phone') IS NOT NULL
      )
    )
  )
)
WITH CHECK (
  -- Allow inserts only from hosts and authenticated guests
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = messages.event_id 
    AND (
      e.host_user_id = (SELECT auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = e.id 
        AND eg.phone = (auth.jwt() ->> 'phone')
        AND (auth.jwt() ->> 'phone') IS NOT NULL
      )
    )
  )
);

-- =====================================================
-- OPTIMIZE INDEXES FOR REALTIME PERFORMANCE
-- =====================================================

-- Drop existing indexes that might be inefficient
DROP INDEX IF EXISTS idx_messages_event_host_lookup;
DROP INDEX IF EXISTS idx_messages_event_id;

-- Create optimized indexes specifically for realtime subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_realtime_access 
ON public.messages(event_id, created_at DESC)
WHERE event_id IS NOT NULL;

-- Index for guest phone lookups in event_guests table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_phone_realtime 
ON public.event_guests(phone, event_id)
WHERE phone IS NOT NULL;

-- Composite index for events host lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_host_realtime 
ON public.events(id, host_user_id)
WHERE host_user_id IS NOT NULL;

-- =====================================================
-- OPTIMIZE EVENT_GUESTS TABLE RLS FOR REALTIME
-- =====================================================

-- Drop existing policies that might interfere with realtime
DROP POLICY IF EXISTS "event_guests_host_access" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_own_access" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_read_event_access" ON public.event_guests;

-- Create optimized policies for event_guests that work well with realtime
CREATE POLICY "event_guests_optimized_access" ON public.event_guests
FOR ALL TO authenticated, anon
USING (
  -- Host can access all guests for their events
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_guests.event_id 
    AND e.host_user_id = (SELECT auth.uid())
  )
  OR
  -- Guests can access their own record via phone
  (
    phone = (auth.jwt() ->> 'phone') 
    AND (auth.jwt() ->> 'phone') IS NOT NULL
  )
)
WITH CHECK (
  -- Same check conditions for writes
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_guests.event_id 
    AND e.host_user_id = (SELECT auth.uid())
  )
  OR
  (
    phone = (auth.jwt() ->> 'phone') 
    AND (auth.jwt() ->> 'phone') IS NOT NULL
  )
);

-- =====================================================
-- ENABLE REALTIME ON TABLES WITH OPTIMIZED SETTINGS
-- =====================================================

-- Ensure realtime is enabled on messages table with row-level filtering
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Configure realtime to use efficient row filtering
-- This helps reduce the payload size and improve performance
COMMENT ON TABLE public.messages IS 'REALTIME: Enabled with row-level security for efficient subscriptions';

-- =====================================================
-- ADD PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Increase work_mem for this session to handle complex RLS queries
SET LOCAL work_mem = '64MB';

-- Analyze tables to update statistics for query planner
ANALYZE public.messages;
ANALYZE public.events;
ANALYZE public.event_guests;

-- =====================================================
-- CREATE HELPER FUNCTION FOR REALTIME DEBUGGING
-- =====================================================

-- Function to debug realtime subscription access
CREATE OR REPLACE FUNCTION debug_message_access(
  p_event_id UUID,
  p_user_phone TEXT DEFAULT NULL
)
RETURNS TABLE(
  can_access BOOLEAN,
  access_reason TEXT,
  user_id UUID,
  is_host BOOLEAN,
  is_guest BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  current_phone TEXT;
BEGIN
  current_user_id := (SELECT auth.uid());
  current_phone := COALESCE(p_user_phone, auth.jwt() ->> 'phone');
  
  -- Check host access
  IF EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = p_event_id 
    AND e.host_user_id = current_user_id
  ) THEN
    RETURN QUERY SELECT TRUE, 'Host access', current_user_id, TRUE, FALSE;
    RETURN;
  END IF;
  
  -- Check guest access
  IF current_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_guests eg
    WHERE eg.event_id = p_event_id 
    AND eg.phone = current_phone
  ) THEN
    RETURN QUERY SELECT TRUE, 'Guest access via phone', current_user_id, FALSE, TRUE;
    RETURN;
  END IF;
  
  -- No access
  RETURN QUERY SELECT FALSE, 'No access', current_user_id, FALSE, FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_message_access(UUID, TEXT) TO authenticated, anon;

-- =====================================================
-- ADD SUBSCRIPTION HEALTH MONITORING
-- =====================================================

-- Create a view to monitor realtime subscription health
CREATE OR REPLACE VIEW realtime_subscription_health AS
SELECT 
  t.schemaname,
  t.tablename,
  p.policyname,
  p.cmd,
  p.qual,
  CASE 
    WHEN p.qual LIKE '%SELECT%' OR p.qual LIKE '%auth.uid()%' THEN 'complex'
    WHEN p.qual IS NULL THEN 'simple' 
    ELSE 'moderate'
  END as complexity,
  -- Check if table has realtime enabled
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables pt 
      WHERE pt.pubname = 'supabase_realtime' 
      AND pt.schemaname = t.schemaname 
      AND pt.tablename = t.tablename
    ) THEN TRUE 
    ELSE FALSE 
  END as realtime_enabled
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public' 
AND t.tablename IN ('messages', 'events', 'event_guests', 'scheduled_messages')
ORDER BY t.tablename, p.policyname;

-- Grant access to view
GRANT SELECT ON realtime_subscription_health TO authenticated;

-- =====================================================
-- OPTIMIZE POSTGRESQL SETTINGS FOR REALTIME
-- =====================================================

-- Increase max connections if possible (requires restart, so we'll comment it)
-- ALTER SYSTEM SET max_connections = 200;

-- Optimize for realtime workload
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log slow queries
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Note: These settings require a PostgreSQL restart to take effect
-- In Supabase hosted environment, most of these are already optimized

-- =====================================================
-- ADD HELPFUL COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "messages_realtime_optimized" ON public.messages IS 
'Optimized RLS policy for realtime subscriptions. Uses efficient indexing and simplified logic to prevent timeouts.';

COMMENT ON INDEX idx_messages_realtime_access IS 
'Optimized index for realtime message subscriptions. Covers event_id filtering and ordering by created_at.';

COMMENT ON INDEX idx_event_guests_phone_realtime IS 
'Index for efficient phone-based guest lookups in realtime subscriptions.';

COMMENT ON INDEX idx_events_host_realtime IS 
'Index for efficient host verification in realtime subscriptions.';

-- =====================================================
-- FINAL ANALYSIS AND VERIFICATION
-- =====================================================

-- Re-analyze tables after index creation
ANALYZE public.messages;
ANALYZE public.events;  
ANALYZE public.event_guests;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Realtime subscription optimization completed successfully';
  RAISE NOTICE 'New indexes created: idx_messages_realtime_access, idx_event_guests_phone_realtime, idx_events_host_realtime';
  RAISE NOTICE 'RLS policies optimized for realtime performance';
  RAISE NOTICE 'Debug function available: debug_message_access(event_id, phone)';
END;
$$;

COMMIT; 