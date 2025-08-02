-- Add atomic event creation function for better transaction safety
-- This ensures event + host guest creation happens in a single database transaction

CREATE OR REPLACE FUNCTION create_event_with_host_atomic(event_data jsonb)
RETURNS TABLE(
    success boolean,
    event_id uuid,
    created_at timestamptz,
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_event_id uuid;
    current_user_id uuid;
    host_profile_name text;
    event_record public.events;
BEGIN
    -- Get current user
    current_user_id := (SELECT auth.uid());
    
    -- Validate authentication
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, 'Authentication required';
        RETURN;
    END IF;
    
    -- Validate that the host_user_id matches current user
    IF (event_data->>'host_user_id')::uuid != current_user_id THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, 'User validation failed';
        RETURN;
    END IF;
    
    BEGIN
        -- Insert event record
        INSERT INTO public.events (
            title,
            event_date,
            location,
            description,
            header_image_url,
            host_user_id,
            is_public
        ) VALUES (
            event_data->>'title',
            (event_data->>'event_date')::date,
            NULLIF(event_data->>'location', ''),
            NULLIF(event_data->>'description', ''),
            NULLIF(event_data->>'header_image_url', ''),
            (event_data->>'host_user_id')::uuid,
            COALESCE((event_data->>'is_public')::boolean, false)
        )
        RETURNING * INTO event_record;
        
        new_event_id := event_record.id;
        
        -- Get host profile name
        SELECT full_name INTO host_profile_name 
        FROM public.users 
        WHERE id = current_user_id;
        
        -- Insert host guest entry
        INSERT INTO public.event_guests (
            event_id,
            user_id,
            phone,
            guest_name,
            role,
            rsvp_status,
            preferred_communication,
            sms_opt_out
        ) VALUES (
            new_event_id,
            current_user_id,
            'Host Profile',
            COALESCE(host_profile_name, 'Host'),
            'host',
            'attending',
            'email',
            true
        );
        
        -- Return success
        RETURN QUERY SELECT true, new_event_id, event_record.created_at, NULL::text;
        
    EXCEPTION WHEN OTHERS THEN
        -- Return error details
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, SQLERRM;
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_event_with_host_atomic(jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_event_with_host_atomic(jsonb) IS 
'Atomically creates an event with host guest entry in a single transaction. 
Ensures data consistency and proper rollback on any failure.
Used by EventCreationService for optimal performance and reliability.';