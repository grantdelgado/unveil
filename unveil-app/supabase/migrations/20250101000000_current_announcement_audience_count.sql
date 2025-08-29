-- Migration: Add function to get current audience count for scheduled messages
-- This provides live audience counts for UI display without affecting delivery logic

-- Create function to get current eligible audience count for a scheduled message
CREATE OR REPLACE FUNCTION public.current_announcement_audience_count(p_scheduled_message_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event_id uuid;
    v_target_all_guests boolean;
    v_target_guest_ids uuid[];
    v_target_guest_tags text[];
    v_result_count bigint;
BEGIN
    -- Get scheduled message details
    SELECT event_id, target_all_guests, target_guest_ids, target_guest_tags
    INTO v_event_id, v_target_all_guests, v_target_guest_ids, v_target_guest_tags
    FROM scheduled_messages
    WHERE id = p_scheduled_message_id;
    
    -- Return 0 if message not found
    IF v_event_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Verify user can access this event (same security as scheduled_messages RLS)
    IF NOT EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = v_event_id 
        AND (
            e.host_user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM event_guests eg 
                WHERE eg.event_id = e.id 
                AND eg.user_id = auth.uid() 
                AND eg.role = 'host'
            )
        )
    ) THEN
        RAISE EXCEPTION 'Access denied to event %', v_event_id;
    END IF;
    
    -- Handle 'all guests' filter (most common case for announcements)
    IF v_target_all_guests = true THEN
        -- Count current eligible guests with phone deduplication
        WITH eligible_guests AS (
            SELECT DISTINCT eg.phone
            FROM event_guests eg
            WHERE eg.event_id = v_event_id
              AND eg.removed_at IS NULL
              AND eg.invited_at IS NOT NULL
              AND COALESCE(eg.sms_opt_out, false) = false
              AND eg.phone IS NOT NULL
              AND eg.phone != ''
        )
        SELECT COUNT(*)::bigint INTO v_result_count FROM eligible_guests;
        
        RETURN v_result_count;
    END IF;
    
    -- Handle explicit guest selection
    IF v_target_guest_ids IS NOT NULL AND array_length(v_target_guest_ids, 1) > 0 THEN
        WITH eligible_guests AS (
            SELECT DISTINCT eg.phone
            FROM event_guests eg
            WHERE eg.event_id = v_event_id
              AND eg.id = ANY(v_target_guest_ids)
              AND eg.removed_at IS NULL
              AND COALESCE(eg.sms_opt_out, false) = false
              AND eg.phone IS NOT NULL
              AND eg.phone != ''
        )
        SELECT COUNT(*)::bigint INTO v_result_count FROM eligible_guests;
        
        RETURN v_result_count;
    END IF;
    
    -- Handle tag-based filtering
    IF v_target_guest_tags IS NOT NULL AND array_length(v_target_guest_tags, 1) > 0 THEN
        -- Extract regular tags and RSVP status tags
        WITH tag_filters AS (
            SELECT 
                array_agg(tag) FILTER (WHERE NOT tag LIKE 'rsvp:%') as regular_tags,
                array_agg(substring(tag from 6)) FILTER (WHERE tag LIKE 'rsvp:%') as rsvp_statuses
            FROM unnest(v_target_guest_tags) as tag
        ),
        eligible_guests AS (
            SELECT DISTINCT eg.phone
            FROM event_guests eg, tag_filters tf
            WHERE eg.event_id = v_event_id
              AND eg.removed_at IS NULL
              AND eg.invited_at IS NOT NULL
              AND COALESCE(eg.sms_opt_out, false) = false
              AND eg.phone IS NOT NULL
              AND eg.phone != ''
              -- Apply tag filters if present
              AND (
                tf.regular_tags IS NULL 
                OR array_length(tf.regular_tags, 1) IS NULL
                OR eg.guest_tags && tf.regular_tags
              )
              -- Apply RSVP filters if present (RSVP-Lite: use declined_at)
              AND (
                tf.rsvp_statuses IS NULL 
                OR array_length(tf.rsvp_statuses, 1) IS NULL
                OR (
                  ('attending' = ANY(tf.rsvp_statuses) AND eg.declined_at IS NULL)
                  OR ('declined' = ANY(tf.rsvp_statuses) AND eg.declined_at IS NOT NULL)
                )
              )
        )
        SELECT COUNT(*)::bigint INTO v_result_count FROM eligible_guests;
        
        RETURN v_result_count;
    END IF;
    
    -- Fallback: no specific targeting, treat as all guests
    WITH eligible_guests AS (
        SELECT DISTINCT eg.phone
        FROM event_guests eg
        WHERE eg.event_id = v_event_id
          AND eg.removed_at IS NULL
          AND eg.invited_at IS NOT NULL
          AND COALESCE(eg.sms_opt_out, false) = false
          AND eg.phone IS NOT NULL
          AND eg.phone != ''
    )
    SELECT COUNT(*)::bigint INTO v_result_count FROM eligible_guests;
    
    RETURN v_result_count;
END;
$$;

-- Set permissions
REVOKE ALL ON FUNCTION public.current_announcement_audience_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_announcement_audience_count(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.current_announcement_audience_count(uuid) IS 
'Returns current eligible audience count for a scheduled message. Uses same filtering logic as send-time resolution with phone deduplication.';
