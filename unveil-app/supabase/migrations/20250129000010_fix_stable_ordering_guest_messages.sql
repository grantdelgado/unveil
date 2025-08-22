-- ============================================================================
-- Migration: Fix stable ordering in get_guest_event_messages RPC
-- ============================================================================
--
-- Ensures stable, deterministic ordering across UNION results by adding
-- id DESC as tie-breaker for identical created_at timestamps.
-- This prevents pagination flicker and duplicate messages at boundaries.

-- Update existing get_guest_event_messages function with stable ordering
CREATE OR REPLACE FUNCTION public.get_guest_event_messages(
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
    is_own_message boolean
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
    
    -- Verify user is a guest of this event (enforce event membership)
    SELECT eg.id, eg.user_id, eg.phone, eg.guest_name, eg.removed_at
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
    
    -- Return messages delivered to this user + their own sent messages
    RETURN QUERY
    WITH user_messages AS (
        -- Messages delivered to this user via message_deliveries
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            md.sms_status as delivery_status,
            COALESCE(u.full_name, 'Host') as sender_name,
            COALESCE(u.avatar_url, NULL) as sender_avatar_url, -- Explicitly handle null
            m.message_type::text,
            false as is_own_message
        FROM public.message_deliveries md
        JOIN public.messages m ON m.id = md.message_id
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE md.user_id = current_user_id
        AND m.event_id = p_event_id
        AND (p_before IS NULL OR m.created_at < p_before)
        
        UNION ALL
        
        -- User's own messages (replies) sent to this event
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            'sent'::text as delivery_status,
            COALESCE(u.full_name, guest_record.guest_name, 'You') as sender_name,
            COALESCE(u.avatar_url, NULL) as sender_avatar_url, -- Explicitly handle null
            m.message_type::text,
            true as is_own_message
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE m.sender_user_id = current_user_id
        AND m.event_id = p_event_id
        AND (p_before IS NULL OR m.created_at < p_before)
    )
    SELECT 
        um.message_id,
        um.content,
        um.created_at,
        um.delivery_status,
        um.sender_name,
        um.sender_avatar_url,
        um.message_type,
        um.is_own_message
    FROM user_messages um
    ORDER BY um.created_at DESC, um.message_id DESC  -- STABLE ORDERING: tie-breaker added
    LIMIT p_limit;
END;
$$;

-- Update V2 RPC with stable ordering (if it exists)
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
    ORDER BY cm.created_at DESC, cm.message_id DESC  -- STABLE ORDERING: tie-breaker added
    LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) TO authenticated;

-- Update function comments
COMMENT ON FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) IS 
'Canonical guest message feed that returns only messages delivered to the authenticated user for a specific event. Enforces event membership and proper security boundaries. Fixed with stable ordering (created_at DESC, id DESC).';

COMMENT ON FUNCTION public.get_guest_event_messages_v2(uuid, int, timestamptz) IS 
'V2 guest message feed with union read model: Direct from deliveries + Announcements/Channels from messages table with tag filtering. Includes source tracking, catchup detection, and stable ordering.';
