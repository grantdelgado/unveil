-- ============================================================================
-- Migration: Add get_guest_event_messages RPC for canonical guest message feed
-- ============================================================================
--
-- Creates a secure, performant RPC function that serves as the single source
-- of truth for guest message feeds. This replaces complex client-side queries
-- with a server-side function that enforces proper security and performance.

-- Create the canonical guest message feed RPC
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
            u.avatar_url as sender_avatar_url,
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
            u.avatar_url as sender_avatar_url,
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
    ORDER BY um.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Add performance index for the primary query path
CREATE INDEX IF NOT EXISTS idx_md_user_event_created 
ON public.message_deliveries(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) IS 
'Canonical guest message feed that returns only messages delivered to the authenticated user for a specific event. Enforces event membership and proper security boundaries.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_guest_event_messages(uuid, int, timestamptz) TO authenticated;
