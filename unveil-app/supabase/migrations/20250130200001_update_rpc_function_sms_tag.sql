-- ============================================================================
-- UPDATE RPC FUNCTION TO ACCEPT SMS_TAG PARAMETER
-- ============================================================================
-- 
-- INTENT: Update create_event_with_host_atomic to accept and insert sms_tag
-- SAFETY: Backward compatible - existing calls without sms_tag will work
-- DEPENDENCY: Requires 20250130200000_standardize_sms_tag_constraints.sql
--
-- ROLLBACK: Restore previous version without sms_tag parameter
-- ============================================================================

BEGIN;

-- Replace the existing function to support sms_tag
CREATE OR REPLACE FUNCTION create_event_with_host_atomic(event_data jsonb)
RETURNS TABLE(
    success boolean,
    event_id uuid,
    created_at timestamptz,
    error_message text,
    operation text  -- 'created' or 'returned_existing'
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
    creation_key_param uuid;
    existing_event public.events;
BEGIN
    -- Get current user
    current_user_id := (SELECT auth.uid());
    
    -- Validate authentication
    IF current_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, 'Authentication required', 'error';
        RETURN;
    END IF;
    
    -- Validate that the host_user_id matches current user
    IF (event_data->>'host_user_id')::uuid != current_user_id THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, 'User validation failed', 'error';
        RETURN;
    END IF;
    
    -- Extract creation_key if provided
    creation_key_param := (event_data->>'creation_key')::uuid;
    
    BEGIN
        -- Check for existing event with same creation_key (idempotency)
        IF creation_key_param IS NOT NULL THEN
            SELECT * INTO existing_event 
            FROM public.events 
            WHERE creation_key = creation_key_param 
            AND host_user_id = current_user_id;
            
            -- If event already exists with this creation_key, return it
            IF existing_event.id IS NOT NULL THEN
                RETURN QUERY SELECT 
                    true, 
                    existing_event.id, 
                    existing_event.created_at, 
                    NULL::text,
                    'returned_existing';
                RETURN;
            END IF;
        END IF;
        
        -- Insert new event record (including sms_tag)
        INSERT INTO public.events (
            title,
            event_date,
            location,
            description,
            header_image_url,
            host_user_id,
            is_public,
            creation_key,
            sms_tag
        ) VALUES (
            event_data->>'title',
            (event_data->>'event_date')::date,
            NULLIF(event_data->>'location', ''),
            NULLIF(event_data->>'description', ''),
            NULLIF(event_data->>'header_image_url', ''),
            (event_data->>'host_user_id')::uuid,
            COALESCE((event_data->>'is_public')::boolean, false),
            creation_key_param,
            NULLIF(event_data->>'sms_tag', '')
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
            'sms',
            false
        );
        
        -- Return success
        RETURN QUERY SELECT true, new_event_id, event_record.created_at, NULL::text, 'created';
        
    EXCEPTION WHEN OTHERS THEN
        -- Return error details
        RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, SQLERRM, 'error';
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_event_with_host_atomic(jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_event_with_host_atomic(jsonb) IS 
'Atomically creates an event with host guest entry in a single transaction. 
Now supports sms_tag parameter for SMS header identification.
Ensures data consistency and proper rollback on any failure.';

COMMIT;
