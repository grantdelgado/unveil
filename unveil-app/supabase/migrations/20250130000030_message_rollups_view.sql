-- ============================================================================
-- Migration: Message Delivery Rollups - View-based Analytics
-- ============================================================================
-- 
-- Adds computed rollup analytics for messages without touching send pipeline.
-- Creates view-based approach for delivered_count, failed_count, delivered_at.
--
-- Changes:
-- 1. Generated column for unified delivery status
-- 2. Performance indexes for rollup queries
-- 3. View for computed message rollups
-- 4. RPC wrapper with RLS enforcement
--
-- No backfills, no send pipeline changes, preserves existing RLS.

-- 1. Add generated column for unified delivery outcome
ALTER TABLE public.message_deliveries
  ADD COLUMN IF NOT EXISTS final_status text
  GENERATED ALWAYS AS (
    CASE
      WHEN coalesce(push_status,'') = 'delivered' OR coalesce(sms_status,'') = 'delivered' THEN 'delivered'
      WHEN coalesce(push_status,'') IN ('failed','undelivered') OR coalesce(sms_status,'') IN ('failed','undelivered') THEN 'failed'
      ELSE 'pending'
    END
  ) STORED;

-- 2. Add performance indexes for rollup queries
CREATE INDEX IF NOT EXISTS idx_md_message_final 
  ON public.message_deliveries (message_id, final_status);

CREATE INDEX IF NOT EXISTS idx_md_message_final_updated 
  ON public.message_deliveries (message_id, final_status, updated_at);

-- 3. Create rollup view for computed analytics
CREATE OR REPLACE VIEW public.message_delivery_rollups_v1 AS
SELECT
  m.id as message_id,
  count(*) FILTER (WHERE md.final_status = 'delivered') as delivered_count,
  count(*) FILTER (WHERE md.final_status = 'failed') as failed_count,
  min(md.updated_at) FILTER (WHERE md.final_status = 'delivered') as delivered_at
FROM public.messages m
LEFT JOIN public.message_deliveries md ON md.message_id = m.id
GROUP BY m.id;

-- 4. Add RPC wrapper with RLS enforcement
CREATE OR REPLACE FUNCTION public.get_message_rollups(p_event_id uuid)
RETURNS TABLE(
  message_id uuid, 
  delivered_count bigint, 
  failed_count bigint, 
  delivered_at timestamptz
)
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public, pg_temp 
AS $$
  SELECT r.message_id, r.delivered_count, r.failed_count, r.delivered_at
  FROM public.message_delivery_rollups_v1 r
  JOIN public.messages m ON m.id = r.message_id
  WHERE m.event_id = p_event_id
  AND can_access_event(m.event_id); -- Enforce RLS
$$;

-- 5. Grant permissions
GRANT SELECT ON public.message_delivery_rollups_v1 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_rollups(uuid) TO authenticated;

-- 6. Add helpful comments
COMMENT ON COLUMN public.message_deliveries.final_status IS 
'Generated column: unified delivery status (delivered/failed/pending) for rollup analytics';

COMMENT ON VIEW public.message_delivery_rollups_v1 IS 
'Computed rollups for message delivery analytics. Use get_message_rollups(event_id) for RLS-safe access.';

COMMENT ON FUNCTION public.get_message_rollups(uuid) IS 
'RLS-safe access to message delivery rollups for a specific event. Respects can_access_event() permissions.';
