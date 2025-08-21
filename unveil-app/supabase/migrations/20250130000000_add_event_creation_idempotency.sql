-- Add idempotency support to prevent duplicate event creation
-- This migration adds a creation_key column with unique constraint to ensure
-- that duplicate submissions with the same key only create one event

-- ============================================================================
-- PART 1: ADD IDEMPOTENCY COLUMN TO EVENTS TABLE
-- ============================================================================

-- Add creation_key column for idempotency
ALTER TABLE public.events 
ADD COLUMN creation_key UUID NULL;

-- Add unique constraint to prevent duplicate creation keys
-- This is the core mechanism that prevents duplicate events
CREATE UNIQUE INDEX idx_events_creation_key_unique 
ON public.events(creation_key) 
WHERE creation_key IS NOT NULL;

-- Add index for efficient lookups by creation_key
CREATE INDEX idx_events_creation_key_lookup 
ON public.events(creation_key) 
WHERE creation_key IS NOT NULL;

-- ============================================================================
-- PART 2: UPDATE ATOMIC EVENT CREATION FUNCTION
-- ============================================================================

-- Replace the existing function to support idempotency
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
        
        -- Insert new event record
        INSERT INTO public.events (
            title,
            event_date,
            location,
            description,
            header_image_url,
            host_user_id,
            is_public,
            creation_key
        ) VALUES (
            event_data->>'title',
            (event_data->>'event_date')::date,
            NULLIF(event_data->>'location', ''),
            NULLIF(event_data->>'description', ''),
            NULLIF(event_data->>'header_image_url', ''),
            (event_data->>'host_user_id')::uuid,
            COALESCE((event_data->>'is_public')::boolean, false),
            creation_key_param
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
        
        -- Return success with created operation
        RETURN QUERY SELECT 
            true, 
            new_event_id, 
            event_record.created_at, 
            NULL::text,
            'created';
        
    EXCEPTION 
        -- Handle unique constraint violation on creation_key
        WHEN unique_violation THEN
            -- This should rarely happen due to the check above, but handles race conditions
            IF creation_key_param IS NOT NULL THEN
                -- Try to find the existing event created by the same user
                SELECT * INTO existing_event 
                FROM public.events 
                WHERE creation_key = creation_key_param 
                AND host_user_id = current_user_id;
                
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
            
            -- If we can't find the existing event, return error
            RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, 'Duplicate creation key conflict', 'error';
            
        WHEN OTHERS THEN
            -- Return other error details
            RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, SQLERRM, 'error';
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_event_with_host_atomic(jsonb) TO authenticated;

-- Update function comment
COMMENT ON FUNCTION create_event_with_host_atomic(jsonb) IS 
'Atomically creates an event with host guest entry in a single transaction with idempotency support.
Accepts a creation_key in the event_data JSON to prevent duplicate events from double submissions.
Returns operation type: "created" for new events, "returned_existing" for idempotent calls.
Ensures data consistency and proper rollback on any failure.';

-- ============================================================================
-- PART 3: ADD DIAGNOSTIC FUNCTIONS
-- ============================================================================

-- Function to detect potential duplicate events
CREATE OR REPLACE FUNCTION detect_duplicate_events()
RETURNS TABLE(
    host_user_id uuid,
    host_name text,
    title text,
    event_date date,
    duplicate_count bigint,
    event_ids uuid[],
    created_at_range text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.host_user_id,
        u.full_name as host_name,
        e.title,
        e.event_date,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(e.id ORDER BY e.created_at) as event_ids,
        MIN(e.created_at)::text || ' to ' || MAX(e.created_at)::text as created_at_range
    FROM public.events e
    LEFT JOIN public.users u ON e.host_user_id = u.id
    GROUP BY e.host_user_id, u.full_name, e.title, e.event_date
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, MAX(e.created_at) DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION detect_duplicate_events() TO authenticated;

COMMENT ON FUNCTION detect_duplicate_events() IS 
'Diagnostic function to detect potential duplicate events based on host, title, and date.
Returns events that have the same host, title, and date with timing information.';

-- ============================================================================
-- PART 4: MIGRATION NOTES AND VALIDATION
-- ============================================================================

-- Add migration metadata
INSERT INTO public._migration_notes (migration_name, description, rollback_notes) VALUES
('20250130000000_add_event_creation_idempotency', 
 'Added creation_key column and unique constraint to prevent duplicate event creation. Updated atomic creation function to support idempotency.',
 'To rollback: DROP INDEX idx_events_creation_key_unique; ALTER TABLE events DROP COLUMN creation_key; Restore original create_event_with_host_atomic function.')
ON CONFLICT (migration_name) DO NOTHING;

-- Validate the migration worked
DO $$
BEGIN
    -- Check that the column was added
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'creation_key'
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Migration failed: creation_key column not found';
    END IF;
    
    -- Check that the unique index was created
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'events' 
        AND indexname = 'idx_events_creation_key_unique'
        AND schemaname = 'public'
    ) THEN
        RAISE EXCEPTION 'Migration failed: unique index not created';
    END IF;
    
    RAISE NOTICE 'Event creation idempotency migration completed successfully';
END;
$$;
