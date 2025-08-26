-- ============================================================================
-- OPTIONAL: Safe Announcement Delivery Backfill RPCs
-- ============================================================================
-- 
-- PURPOSE: Provides safe, idempotent backfill of missing message_deliveries
--          for historical announcements. NOT NEEDED for current visibility.
--
-- SAFETY: 
-- - Never triggers SMS sends (uses 'delivered' status)
-- - Idempotent (won't create duplicates)
-- - Batched with limits
-- - Dry-run capable
-- - No schema changes
--
-- USAGE: Only execute if future analytics require individual delivery records
--
-- ============================================================================

-- Preview function: Count missing deliveries (read-only)
CREATE OR REPLACE FUNCTION preview_missing_announcement_deliveries(
    p_event_id UUID DEFAULT NULL
)
RETURNS TABLE(
    event_id UUID,
    event_title TEXT,
    total_announcements BIGINT,
    total_linked_guests BIGINT,
    expected_deliveries BIGINT,
    actual_deliveries BIGINT,
    missing_deliveries BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH announcement_stats AS (
        SELECT 
            e.id as event_id,
            e.title as event_title,
            COUNT(DISTINCT m.id) as total_announcements,
            COUNT(DISTINCT eg.id) as total_linked_guests,
            COUNT(DISTINCT m.id) * COUNT(DISTINCT eg.id) as expected_deliveries,
            COUNT(md.id) as actual_deliveries
        FROM events e
        CROSS JOIN messages m
        CROSS JOIN event_guests eg
        LEFT JOIN message_deliveries md ON (
            md.message_id = m.id 
            AND md.user_id = eg.user_id
        )
        WHERE m.event_id = e.id
          AND eg.event_id = e.id
          AND m.message_type = 'announcement'
          AND eg.removed_at IS NULL
          AND eg.user_id IS NOT NULL
          AND (p_event_id IS NULL OR e.id = p_event_id)
        GROUP BY e.id, e.title
    )
    SELECT 
        s.event_id,
        s.event_title,
        s.total_announcements,
        s.total_linked_guests,
        s.expected_deliveries,
        s.actual_deliveries,
        s.expected_deliveries - s.actual_deliveries as missing_deliveries
    FROM announcement_stats s
    WHERE s.expected_deliveries > s.actual_deliveries
    ORDER BY missing_deliveries DESC;
END;
$$;

-- Backfill function: Create missing delivery records (write operation)
CREATE OR REPLACE FUNCTION backfill_announcement_deliveries(
    p_event_id UUID,
    p_limit INT DEFAULT 200,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    operation_type TEXT,
    message_id UUID,
    user_id UUID,
    guest_id UUID,
    phone_number TEXT,
    created_count INT,
    dry_run BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    missing_delivery RECORD;
    insert_count INT := 0;
    total_processed INT := 0;
BEGIN
    -- Validate event exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = p_event_id 
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
        RAISE EXCEPTION 'Access denied: User is not a host of event %', p_event_id;
    END IF;

    -- Find missing announcement deliveries
    FOR missing_delivery IN
        SELECT DISTINCT
            m.id as message_id,
            eg.user_id,
            eg.id as guest_id,
            eg.phone,
            m.created_at as message_created_at
        FROM messages m
        CROSS JOIN event_guests eg
        WHERE m.event_id = p_event_id
          AND eg.event_id = p_event_id
          AND m.message_type = 'announcement'
          AND eg.removed_at IS NULL
          AND eg.user_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM message_deliveries md
              WHERE md.message_id = m.id
                AND md.user_id = eg.user_id
          )
        ORDER BY m.created_at DESC, eg.user_id
        LIMIT p_limit
    LOOP
        total_processed := total_processed + 1;

        -- Return preview of what would be created
        RETURN QUERY SELECT
            'missing_delivery'::TEXT,
            missing_delivery.message_id,
            missing_delivery.user_id,
            missing_delivery.guest_id,
            missing_delivery.phone,
            0, -- Will be 1 if actually inserted
            p_dry_run;

        -- Only insert if not dry run
        IF NOT p_dry_run THEN
            INSERT INTO message_deliveries (
                message_id,
                guest_id,
                user_id,
                phone_number,
                sms_status,
                push_status,
                created_at,
                updated_at
            ) VALUES (
                missing_delivery.message_id,
                missing_delivery.guest_id,
                missing_delivery.user_id,
                missing_delivery.phone,
                'delivered', -- CRITICAL: Never 'pending' to avoid SMS sends
                'delivered',
                missing_delivery.message_created_at, -- Use original message time
                NOW()
            )
            ON CONFLICT (message_id, user_id) DO NOTHING; -- Idempotent
            
            -- Check if actually inserted (not a conflict)
            IF FOUND THEN
                insert_count := insert_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Return summary
    RETURN QUERY SELECT
        'summary'::TEXT,
        NULL::UUID,
        NULL::UUID,
        NULL::UUID,
        NULL::TEXT,
        insert_count,
        p_dry_run;
END;
$$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION preview_missing_announcement_deliveries IS 
'Read-only function to count missing announcement delivery records by event. Safe to run anytime.';

COMMENT ON FUNCTION backfill_announcement_deliveries IS 
'WRITE function to backfill missing announcement deliveries. 
- Uses delivered status to prevent SMS sends
- Idempotent (handles conflicts)  
- Requires host access to event
- Defaults to dry-run mode
- Batched with configurable limit';

-- ============================================================================
-- USAGE EXAMPLES (DO NOT EXECUTE - DOCUMENTATION ONLY)
-- ============================================================================

/*
-- 1. Preview missing deliveries across all events
SELECT * FROM preview_missing_announcement_deliveries();

-- 2. Preview missing deliveries for specific event  
SELECT * FROM preview_missing_announcement_deliveries('24caa3a8-020e-4a80-9899-35ff2797dcc0');

-- 3. Dry-run backfill for specific event (safe, no changes)
SELECT * FROM backfill_announcement_deliveries(
    '24caa3a8-020e-4a80-9899-35ff2797dcc0', 
    50,    -- limit
    TRUE   -- dry_run
);

-- 4. ACTUAL backfill (only if needed for future analytics)
-- SELECT * FROM backfill_announcement_deliveries(
--     '24caa3a8-020e-4a80-9899-35ff2797dcc0',
--     50,     -- limit  
--     FALSE   -- NOT dry_run
-- );
*/
