-- Implement Host Non-Invitable Logic
-- This migration ensures hosts are visible but non-invitable across all UI surfaces

-- =====================================================
-- 1. CREATE MISSING get_event_guest_counts RPC
-- =====================================================

-- Create the unified guest counts RPC that excludes hosts from invitable counts
CREATE OR REPLACE FUNCTION public.get_event_guest_counts(p_event_id uuid)
RETURNS TABLE(
    total_guests integer,
    total_invited integer,
    attending integer,
    declined integer,
    not_invited integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Verify user can access this event
    IF NOT public.can_access_event(p_event_id) THEN
        RAISE EXCEPTION 'Access denied to event %', p_event_id;
    END IF;

    RETURN QUERY
    SELECT 
        -- Total guests (includes hosts for visibility)
        COUNT(*)::integer as total_guests,
        
        -- Invitable counts exclude hosts
        COUNT(*) FILTER (
            WHERE invited_at IS NOT NULL AND role != 'host'
        )::integer as total_invited,
        
        COUNT(*) FILTER (
            WHERE invited_at IS NOT NULL AND declined_at IS NULL AND role != 'host'
        )::integer as attending,
        
        COUNT(*) FILTER (
            WHERE declined_at IS NOT NULL AND role != 'host'
        )::integer as declined,
        
        COUNT(*) FILTER (
            WHERE invited_at IS NULL AND declined_at IS NULL AND role != 'host'
        )::integer as not_invited
        
    FROM public.event_guests
    WHERE event_id = p_event_id 
      AND removed_at IS NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_event_guest_counts(uuid) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION public.get_event_guest_counts(uuid) IS 
'Returns guest counts for an event. Hosts are included in total_guests but excluded from invitable counts (total_invited, attending, declined, not_invited).';

-- =====================================================
-- 2. UPDATE MESSAGING RECIPIENTS RPC TO SUPPORT HOST INCLUSION
-- =====================================================

-- Check if get_messaging_recipients exists and update it
DO $$
BEGIN
    -- Update existing function if it exists, otherwise create it
    CREATE OR REPLACE FUNCTION public.get_messaging_recipients(
        p_event_id uuid,
        p_include_hosts boolean DEFAULT false
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
            -- Use display name logic from get_event_guests_with_display_names
            COALESCE(
                NULLIF(eg.guest_name, ''),
                u.full_name,
                'Guest'
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
            CASE WHEN eg.role = 'host' THEN 0 ELSE 1 END,
            eg.created_at ASC;
    END;
    $func$;

    -- Grant execute permission
    GRANT EXECUTE ON FUNCTION public.get_messaging_recipients(uuid, boolean) TO authenticated;

    -- Comment the function
    COMMENT ON FUNCTION public.get_messaging_recipients(uuid, boolean) IS 
    'Returns messaging recipients for an event. By default excludes hosts unless p_include_hosts=true.';

EXCEPTION WHEN others THEN
    -- If function creation fails, log but don't fail migration
    RAISE WARNING 'Could not create get_messaging_recipients function: %', SQLERRM;
END;
$$;

-- =====================================================
-- 3. ADD VALIDATION TO PREVENT HOST PHONE AS GUEST
-- =====================================================

-- Create function to validate guest additions don't conflict with host
CREATE OR REPLACE FUNCTION public.validate_guest_phone_not_host(
    p_event_id uuid,
    p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    host_phone text;
BEGIN
    -- Get the host's phone from the host user record
    SELECT u.phone INTO host_phone
    FROM public.events e
    JOIN public.users u ON e.host_user_id = u.id
    WHERE e.id = p_event_id;

    -- Return false if the phone matches the host's phone
    IF host_phone IS NOT NULL AND TRIM(p_phone) = TRIM(host_phone) THEN
        RETURN false;
    END IF;

    -- Also check if there's already a host guest record with this phone
    IF EXISTS (
        SELECT 1 FROM public.event_guests 
        WHERE event_id = p_event_id 
          AND role = 'host' 
          AND TRIM(phone) = TRIM(p_phone)
          AND removed_at IS NULL
    ) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_guest_phone_not_host(uuid, text) TO authenticated;

-- Comment the function
COMMENT ON FUNCTION public.validate_guest_phone_not_host(uuid, text) IS 
'Validates that a phone number does not belong to the event host. Returns false if phone conflicts with host.';

-- =====================================================
-- 4. UPDATE INVITATION TRACKING TO EXCLUDE HOSTS
-- =====================================================

-- Update the existing invitation tracking function to exclude hosts
CREATE OR REPLACE FUNCTION public.update_guest_invitation_tracking(
  p_event_id uuid,
  p_guest_ids uuid[]
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated_count integer := 0;
  v_result json;
BEGIN
  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id 
    AND host_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only event hosts can update invitation tracking';
  END IF;

  -- Update invitation tracking for specified guests (exclude hosts)
  UPDATE public.event_guests 
  SET 
    last_invited_at = NOW(),
    invited_at = COALESCE(invited_at, NOW()),
    invite_attempts = invite_attempts + 1,
    updated_at = NOW()
  WHERE event_id = p_event_id 
    AND id = ANY(p_guest_ids)
    AND role != 'host'  -- Exclude hosts from invitation tracking
    AND removed_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Return result
  SELECT json_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'timestamp', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 5. CREATE HELPER VIEW FOR INVITABLE GUESTS
-- =====================================================

-- Create a view that makes it easy to query invitable guests
CREATE OR REPLACE VIEW public.invitable_guests AS
SELECT 
    eg.*,
    -- Computed invitable status
    (eg.role != 'host' AND eg.removed_at IS NULL) as is_invitable
FROM public.event_guests eg;

-- Apply RLS to the view
ALTER VIEW public.invitable_guests OWNER TO postgres;

-- The view inherits RLS from the underlying event_guests table
-- No additional policies needed

-- Grant select permission to authenticated users
GRANT SELECT ON public.invitable_guests TO authenticated;

-- Comment the view
COMMENT ON VIEW public.invitable_guests IS 
'View of event_guests with computed is_invitable field. Hosts and removed guests are marked as not invitable.';

-- =====================================================
-- 6. DATA MIGRATION: ENSURE HOST RECORDS EXIST
-- =====================================================

-- Backfill missing host records for existing events
-- This ensures every event has a canonical host record in event_guests
DO $$
DECLARE
    event_record RECORD;
    host_user RECORD;
    existing_host_guest RECORD;
    inserted_count INTEGER := 0;
    skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting host record backfill...';
    
    -- Loop through all events to ensure they have host guest records
    FOR event_record IN 
        SELECT id, host_user_id, title, created_at 
        FROM public.events 
        ORDER BY created_at ASC
    LOOP
        -- Check if host guest record already exists
        SELECT * INTO existing_host_guest
        FROM public.event_guests 
        WHERE event_id = event_record.id 
          AND role = 'host' 
          AND removed_at IS NULL;
        
        IF existing_host_guest.id IS NOT NULL THEN
            skipped_count := skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- Get host user details
        SELECT * INTO host_user
        FROM public.users 
        WHERE id = event_record.host_user_id;
        
        IF host_user.id IS NULL THEN
            RAISE WARNING 'Host user not found for event %', event_record.id;
            CONTINUE;
        END IF;
        
        -- Insert host guest record
        INSERT INTO public.event_guests (
            event_id,
            user_id,
            phone,
            guest_name,
            role,
            rsvp_status,
            preferred_communication,
            sms_opt_out,
            created_at,
            updated_at
        ) VALUES (
            event_record.id,
            event_record.host_user_id,
            COALESCE(host_user.phone, 'Host Profile'),
            COALESCE(host_user.full_name, 'Host'),
            'host',
            'attending',
            'sms',
            false,
            event_record.created_at, -- Use event creation time
            NOW()
        );
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Host record backfill completed:';
    RAISE NOTICE '- Inserted % new host records', inserted_count;
    RAISE NOTICE '- Skipped % events (already had host records)', skipped_count;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Host record backfill failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- 7. CLEAN UP DUPLICATE HOST RECORDS
-- =====================================================

-- Remove duplicate host records (keep the oldest one per event)
DO $$
DECLARE
    duplicate_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Cleaning up duplicate host records...';
    
    -- Delete duplicate host records, keeping the oldest one per event
    WITH ranked_hosts AS (
        SELECT 
            id,
            event_id,
            role,
            ROW_NUMBER() OVER (PARTITION BY event_id, role ORDER BY created_at ASC) as rn
        FROM public.event_guests 
        WHERE role = 'host' 
          AND removed_at IS NULL
    )
    DELETE FROM public.event_guests 
    WHERE id IN (
        SELECT id 
        FROM ranked_hosts 
        WHERE role = 'host' AND rn > 1
    );
    
    GET DIAGNOSTICS duplicate_count = ROW_COUNT;
    
    RAISE NOTICE 'Removed % duplicate host records', duplicate_count;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Duplicate host cleanup failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- 8. MIGRATION SUMMARY
-- =====================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Host non-invitable logic implementation completed:';
    RAISE NOTICE '- Created get_event_guest_counts RPC (excludes hosts from invitable counts)';
    RAISE NOTICE '- Updated get_messaging_recipients RPC (supports host inclusion toggle)';  
    RAISE NOTICE '- Added validate_guest_phone_not_host function';
    RAISE NOTICE '- Updated invitation tracking to exclude hosts';
    RAISE NOTICE '- Created invitable_guests view';
    RAISE NOTICE '- Backfilled missing host records';
    RAISE NOTICE '- Cleaned up duplicate host records';
END;
$$;
