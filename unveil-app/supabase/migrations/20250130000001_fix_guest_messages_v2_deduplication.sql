-- Migration: Fix Guest Messages V2 Deduplication Logic
-- Date: 2025-01-30
-- Purpose: Fix deduplication logic in get_guest_event_messages_v2 to use guest_id instead of user_id
-- 
-- ISSUE: The deduplication logic in branches B and C was using md.user_id = current_user_id
-- instead of md.guest_id = guest_record.id, causing announcements to be incorrectly excluded
-- when deliveries existed for the same user but different guest records.
--
-- IMPACT: Guests only see the newest announcement instead of all announcements in their feed.

-- Fix the get_guest_event_messages_v2 RPC with correct deduplication logic
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
        
        -- B) Announcements from messages (FIXED - message-backed)
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
        -- FIXED: Exclude if already in deliveries for THIS GUEST (correct deduplication)
        AND NOT EXISTS (
            SELECT 1 FROM public.message_deliveries md2 
            WHERE md2.message_id = m.id 
            AND md2.guest_id = guest_record.id  -- FIXED: Use guest_id instead of user_id
        )
        
        UNION ALL
        
        -- C) Channels from messages with tag filtering (FIXED - message-backed)
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
        -- FIXED: Exclude if already in deliveries for THIS GUEST (correct deduplication)
        AND NOT EXISTS (
            SELECT 1 FROM public.message_deliveries md3 
            WHERE md3.message_id = m.id 
            AND md3.guest_id = guest_record.id  -- FIXED: Use guest_id instead of user_id
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
    ORDER BY cm.created_at DESC, cm.message_id DESC  -- STABLE ORDERING: tie-breaker added
    LIMIT p_limit;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) IS 
'V2 guest message feed with union read model: Direct from deliveries + Announcements/Channels from messages table with tag filtering. Includes source tracking, catchup detection, stable ordering, and FIXED deduplication logic using guest_id.';
