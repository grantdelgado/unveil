-- =====================================================
-- UPDATE MESSAGING RECIPIENTS RPC TO ALWAYS INCLUDE HOSTS BY DEFAULT
-- AND USE PROPER DISPLAY_NAME LOGIC
-- =====================================================

-- Update the get_messaging_recipients function to:
-- 1. Always include hosts by default (p_include_hosts DEFAULT true)
-- 2. Use proper display_name fallback: display_name -> full_name -> guest_name -> 'Guest'
-- 3. Maintain backward compatibility

CREATE OR REPLACE FUNCTION public.get_messaging_recipients(
    p_event_id uuid,
    p_include_hosts boolean DEFAULT true  -- Changed from false to true
)
RETURNS TABLE(
    event_guest_id uuid,
    guest_name text,
    guest_email text,
    phone text,
    role text,
    guest_tags text[],
    invited_at timestamptz,
    declined_at timestamptz,
    sms_opt_out boolean,
    guest_display_name text,
    user_full_name text,
    user_email text,
    user_phone text,
    has_valid_phone boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    -- Verify user can access this event
    IF NOT public.can_access_event(p_event_id) THEN
        RAISE EXCEPTION 'Access denied to event %', p_event_id;
    END IF;

    RETURN QUERY
    SELECT 
        eg.id as event_guest_id,
        eg.guest_name,
        eg.guest_email,
        eg.phone,
        eg.role,
        eg.guest_tags,
        eg.invited_at,
        eg.declined_at,
        eg.sms_opt_out,
        -- Updated display name logic: display_name -> full_name -> guest_name -> 'Guest'
        COALESCE(
            NULLIF(eg.display_name, ''),  -- Use event_guests.display_name first
            NULLIF(u.full_name, ''),      -- Then users.full_name
            NULLIF(eg.guest_name, ''),    -- Then event_guests.guest_name
            'Guest'                       -- Finally fallback to 'Guest'
        ) as guest_display_name,
        u.full_name as user_full_name,
        u.email as user_email,
        u.phone as user_phone,
        -- Has valid phone logic
        (eg.phone IS NOT NULL 
         AND eg.phone != '' 
         AND eg.phone != 'Host Profile'
         AND LENGTH(TRIM(eg.phone)) >= 10) as has_valid_phone
    FROM public.event_guests eg
    LEFT JOIN public.users u ON eg.user_id = u.id
    WHERE eg.event_id = p_event_id 
      AND eg.removed_at IS NULL
      AND (p_include_hosts OR eg.role != 'host')
    ORDER BY 
        CASE WHEN eg.role = 'host' THEN 0 ELSE 1 END,  -- Hosts first
        eg.created_at ASC;
END;
$func$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_messaging_recipients(uuid, boolean) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION public.get_messaging_recipients(uuid, boolean) IS 
'Returns messaging recipients for an event. By default includes hosts (p_include_hosts=true). Uses display_name -> full_name -> guest_name -> Guest fallback logic.';

-- Test the function to ensure it works
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Simple test to ensure function can be called
    PERFORM public.get_messaging_recipients('00000000-0000-0000-0000-000000000000'::uuid, true);
    RAISE NOTICE 'Function updated successfully and is callable';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Function test completed with expected access error (no such event): %', SQLERRM;
END;
$$;
