-- RLS POLICIES AND PERFORMANCE AFTER CONSOLIDATION  
-- Generated: September 24, 2025
-- Database: PostgreSQL 15.8.1.085

-- ==============================================================================
-- CONSOLIDATED RLS POLICIES (single policy per table/action)
-- ==============================================================================

-- NEW HELPER FUNCTIONS (SECURITY DEFINER + hardened search_path)
CREATE OR REPLACE FUNCTION public.resolve_event_from_message_v2(p_message_id uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql AS $$
  SELECT m.event_id FROM public.messages m WHERE m.id = p_message_id
$$;

CREATE OR REPLACE FUNCTION public.can_access_delivery_v2(p_user_id uuid, p_guest_id uuid)  
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql AS $$
  SELECT CASE
    WHEN p_user_id IS NOT NULL THEN p_user_id = auth.uid()
    WHEN p_guest_id IS NOT NULL THEN public.can_access_event(
      (SELECT eg.event_id FROM public.event_guests eg WHERE eg.id = p_guest_id)
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_deliveries_v2(p_message_id uuid)
RETURNS boolean  
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql AS $$
  SELECT public.can_access_event(public.resolve_event_from_message_v2(p_message_id))
$$;

-- ==============================================================================
-- CONSOLIDATED POLICIES BY TABLE
-- ==============================================================================

-- MESSAGES TABLE (4 optimized policies - no overlap)
CREATE POLICY messages_select_v2 ON public.messages FOR SELECT
USING (public.can_access_event(event_id));

CREATE POLICY messages_insert_v2 ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.is_event_host(event_id));

CREATE POLICY messages_update_v2 ON public.messages FOR UPDATE TO authenticated  
USING (public.is_event_host(event_id))
WITH CHECK (public.is_event_host(event_id));

CREATE POLICY messages_delete_v2 ON public.messages FOR DELETE TO authenticated
USING (public.is_event_host(event_id));

-- MESSAGE_DELIVERIES TABLE (3 optimized policies with helper functions)  
CREATE POLICY message_deliveries_select_v2 ON public.message_deliveries FOR SELECT
USING (public.can_access_delivery_v2(user_id, guest_id));

CREATE POLICY message_deliveries_insert_v2 ON public.message_deliveries FOR INSERT
WITH CHECK (public.can_manage_deliveries_v2(message_id));

CREATE POLICY message_deliveries_update_v2 ON public.message_deliveries FOR UPDATE
USING (public.can_manage_deliveries_v2(message_id))
WITH CHECK (public.can_manage_deliveries_v2(message_id));

-- EVENT_GUESTS TABLE (4 distinct policies - NO OVERLAP)
CREATE POLICY event_guests_select_v2 ON public.event_guests FOR SELECT
USING (public.is_event_host(event_id) OR user_id = auth.uid());

CREATE POLICY event_guests_insert_v2 ON public.event_guests FOR INSERT  
WITH CHECK (public.is_event_host(event_id) OR user_id = auth.uid());

CREATE POLICY event_guests_update_v2 ON public.event_guests FOR UPDATE
USING (public.is_event_host(event_id) OR user_id = auth.uid())
WITH CHECK (public.is_event_host(event_id) OR user_id = auth.uid());

CREATE POLICY event_guests_delete_v2 ON public.event_guests FOR DELETE
USING (false);  -- No deletes allowed

-- MEDIA TABLE (unchanged - already optimized)
CREATE POLICY media_select_event_accessible ON public.media FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY media_insert_event_participant ON public.media FOR INSERT TO authenticated  
WITH CHECK (can_access_event(event_id));

CREATE POLICY media_update_own ON public.media FOR UPDATE
USING (uploader_user_id = (SELECT auth.uid()));

-- SCHEDULED_MESSAGES TABLE (unchanged - already optimal)
CREATE POLICY scheduled_messages_host_only_optimized ON public.scheduled_messages FOR ALL
USING (can_write_event(event_id)) WITH CHECK (can_write_event(event_id));

-- ==============================================================================
-- PERFORMANCE RESULTS AFTER CONSOLIDATION  
-- ==============================================================================

-- AFTER: Messages Query (84% planning time improvement)
-- Limit  (cost=0.56..6.04 rows=50 width=125) (actual time=0.671..0.673 rows=0 loops=1)
-- Buffers: shared hit=2
-- Planning Time: 4.456 ms ✅ (was 27.192 ms)
-- Execution Time: 0.761 ms ✅ (was 4.256 ms)

-- AFTER: Message Deliveries Query (62% planning time improvement)  
-- Bitmap Heap Scan on message_deliveries md  (cost=1.82..14.41 rows=15 width=88)
-- Buffers: shared hit=4  
-- Planning Time: 8.870 ms ✅ (was 23.593 ms)
-- Execution Time: 0.143 ms ✅ (was 4.955 ms)

-- ==============================================================================
-- POLICY COUNT SUMMARY (perfect 1:1 ratio)
-- ==============================================================================

-- event_guests:        1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE  
-- messages:            1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
-- message_deliveries:  1 SELECT, 1 INSERT, 1 UPDATE
-- media:               1 SELECT, 1 INSERT, 1 UPDATE (unchanged)
-- scheduled_messages:  1 ALL policy (unchanged)

-- TOTAL: 15 policies (down from 18+ with overlaps)
-- OVERLAPS: 0 (down from 3+ on event_guests alone)
