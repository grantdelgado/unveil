-- ============================================================================
-- Messages Read-Model V2 - RPC Implementation
-- ============================================================================
-- Date: January 29, 2025
-- Purpose: Create get_guest_event_messages_v2 with union read model
-- Approach: Direct + Announcements + Channels with tag filtering

CREATE OR REPLACE FUNCTION public.get_guest_event_messages_v2(
    p_event_id uuid,
    p_limit int DEFAULT 50,
    p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(
    message_id uuid,
    content text,
    created_at timestamptz,
    delivery_status text,
    sender_name text,
    sender_avatar_url text,
    message_type text,
    is_own_message boolean,
    source text,                    -- NEW: 'delivery' | 'message'
    is_catchup boolean,            -- NEW: true if before guest joined
    channel_tags text[]            -- NEW: tags for channel messages
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
    guest_record RECORD;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Verify user is a guest of this event and get guest details
    SELECT 
        eg.id, 
        eg.user_id, 
        eg.phone, 
        eg.guest_name, 
        eg.removed_at,
        eg.guest_tags,
        eg.joined_at
    INTO guest_record
    FROM public.event_guests eg
    WHERE eg.event_id = p_event_id 
    AND eg.user_id = current_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Access denied: User is not a guest of this event';
    END IF;
    
    -- Check if user has been removed from the event
    IF guest_record.removed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Access denied: User has been removed from this event';
    END IF;
    
    -- Return union of all message sources
    RETURN QUERY
    WITH combined_messages AS (
        -- A) Direct messages from deliveries (UNCHANGED - delivery-backed)
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            COALESCE(md.sms_status, 'delivered') as delivery_status,
            COALESCE(u.full_name, 'Host') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            false as is_own_message,
            'delivery'::text as source,
            (guest_record.joined_at IS NOT NULL AND m.created_at < guest_record.joined_at) as is_catchup,
            NULL::text[] as channel_tags
        FROM public.message_deliveries md
        JOIN public.messages m ON m.id = md.message_id
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE md.user_id = current_user_id
        AND m.event_id = p_event_id
        AND m.message_type = 'direct'
        AND (p_before IS NULL OR m.created_at < p_before)
        
        UNION ALL
        
        -- B) Announcements from messages (NEW - message-backed)
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            'delivered'::text as delivery_status,
            COALESCE(u.full_name, 'Host') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            false as is_own_message,
            'message'::text as source,
            (guest_record.joined_at IS NOT NULL AND m.created_at < guest_record.joined_at) as is_catchup,
            NULL::text[] as channel_tags
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE m.event_id = p_event_id
        AND m.message_type = 'announcement'
        AND (p_before IS NULL OR m.created_at < p_before)
        -- Exclude if already in deliveries (deduplication)
        AND NOT EXISTS (
            SELECT 1 FROM public.message_deliveries md2 
            WHERE md2.message_id = m.id 
            AND md2.user_id = current_user_id
        )
        
        UNION ALL
        
        -- C) Channels from messages with tag filtering (NEW - message-backed)
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            'delivered'::text as delivery_status,
            COALESCE(u.full_name, 'Host') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            false as is_own_message,
            'message'::text as source,
            (guest_record.joined_at IS NOT NULL AND m.created_at < guest_record.joined_at) as is_catchup,
            COALESCE(sm.target_guest_tags, '{}'::text[]) as channel_tags
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        LEFT JOIN public.scheduled_messages sm ON m.scheduled_message_id = sm.id
        WHERE m.event_id = p_event_id
        AND m.message_type = 'channel'
        AND (p_before IS NULL OR m.created_at < p_before)
        -- Channel tag filtering using verified helper functions
        AND (
            -- No tag targeting (broadcast to all guests)
            sm.target_guest_tags IS NULL 
            OR array_length(sm.target_guest_tags, 1) IS NULL
            OR sm.target_all_guests = true
            OR 
            -- Guest has matching tags (uses existing helper functions)
            (
                sm.target_guest_tags IS NOT NULL 
                AND public.guest_has_any_tags(guest_record.id, sm.target_guest_tags)
            )
        )
        -- Exclude if already in deliveries (deduplication)
        AND NOT EXISTS (
            SELECT 1 FROM public.message_deliveries md3 
            WHERE md3.message_id = m.id 
            AND md3.user_id = current_user_id
        )
        
        UNION ALL
        
        -- D) User's own messages (UNCHANGED - message-backed)
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            'sent'::text as delivery_status,
            COALESCE(u.full_name, guest_record.guest_name, 'You') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            true as is_own_message,
            'message'::text as source,
            false as is_catchup, -- Own messages are never catchup
            NULL::text[] as channel_tags
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE m.sender_user_id = current_user_id
        AND m.event_id = p_event_id
        AND (p_before IS NULL OR m.created_at < p_before)
    )
    SELECT 
        cm.message_id,
        cm.content,
        cm.created_at,
        cm.delivery_status,
        cm.sender_name,
        cm.sender_avatar_url,
        cm.message_type,
        cm.is_own_message,
        cm.source,
        cm.is_catchup,
        cm.channel_tags
    FROM combined_messages cm
    ORDER BY cm.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) IS 
'V2 guest message feed with union read model: Direct from deliveries + Announcements/Channels from messages table with tag filtering. Includes source tracking and catchup detection.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test the new RPC (replace with actual event_id and user context)
-- SELECT * FROM public.get_guest_event_messages_v2(
--     'your-event-id-here'::uuid, 
--     20, 
--     NULL
-- );

-- Compare with v1 results
-- SELECT 
--     'v1' as version,
--     COUNT(*) as message_count,
--     COUNT(CASE WHEN message_type = 'direct' THEN 1 END) as direct_count,
--     COUNT(CASE WHEN message_type = 'announcement' THEN 1 END) as announcement_count,
--     COUNT(CASE WHEN message_type = 'channel' THEN 1 END) as channel_count
-- FROM public.get_guest_event_messages('your-event-id-here'::uuid, 50, NULL)
-- 
-- UNION ALL
-- 
-- SELECT 
--     'v2' as version,
--     COUNT(*) as message_count,
--     COUNT(CASE WHEN message_type = 'direct' THEN 1 END) as direct_count,
--     COUNT(CASE WHEN message_type = 'announcement' THEN 1 END) as announcement_count,
--     COUNT(CASE WHEN message_type = 'channel' THEN 1 END) as channel_count
-- FROM public.get_guest_event_messages_v2('your-event-id-here'::uuid, 50, NULL);
