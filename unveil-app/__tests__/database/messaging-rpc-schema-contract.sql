-- Messaging RPC Schema Contract Tests
-- These tests validate the exact schema and prevent regressions

-- Test 1: Validate canonical function exists with expected signature
DO $$
DECLARE
    func_exists boolean;
    expected_args text;
    actual_args text;
BEGIN
    -- Check function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'get_guest_event_messages'
    ) INTO func_exists;
    
    IF NOT func_exists THEN
        RAISE EXCEPTION 'CRITICAL: Canonical function get_guest_event_messages does not exist';
    END IF;
    
    -- Check expected signature
    expected_args := 'p_event_id uuid, p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid';
    
    SELECT pg_get_function_arguments(p.oid) INTO actual_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages';
    
    IF actual_args != expected_args THEN
        RAISE EXCEPTION 'CRITICAL: Function signature mismatch. Expected: %, Got: %', expected_args, actual_args;
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: Canonical function signature validated';
END;
$$;

-- Test 2: Validate return type structure and column types
DO $$
DECLARE
    return_type text;
    expected_return text;
BEGIN
    expected_return := 'TABLE(message_id uuid, content text, created_at timestamp with time zone, delivery_status text, sender_name text, sender_avatar_url text, message_type text, is_own_message boolean, source text, is_catchup boolean, channel_tags text[])';
    
    SELECT pg_get_function_result(p.oid) INTO return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages';
    
    IF return_type != expected_return THEN
        RAISE EXCEPTION 'CRITICAL: Return type mismatch. Expected: %, Got: %', expected_return, return_type;
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: Return type structure validated';
END;
$$;

-- Test 3: Validate v2 and canonical functions have identical signatures
DO $$
DECLARE
    v2_signature text;
    canonical_signature text;
BEGIN
    SELECT pg_get_function_arguments(p.oid) INTO v2_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages_v2';
    
    SELECT pg_get_function_arguments(p.oid) INTO canonical_signature
    FROM pg_proc p  
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages';
    
    IF v2_signature != canonical_signature THEN
        RAISE EXCEPTION 'CRITICAL: v2 and canonical signatures must match for delegation. v2: %, canonical: %', v2_signature, canonical_signature;
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: v2 delegation signature compatibility validated';
END;
$$;

-- Test 4: Validate all functions are SECURITY DEFINER for proper RLS
DO $$
DECLARE
    v2_is_definer boolean;
    v3_is_definer boolean;
    canonical_is_definer boolean;
BEGIN
    SELECT p.prosecdef INTO v2_is_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages_v2';
    
    SELECT p.prosecdef INTO v3_is_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages_v3';
    
    SELECT p.prosecdef INTO canonical_is_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages';
    
    IF NOT v2_is_definer OR NOT v3_is_definer OR NOT canonical_is_definer THEN
        RAISE EXCEPTION 'CRITICAL: All messaging RPC functions must be SECURITY DEFINER. v2: %, v3: %, canonical: %', v2_is_definer, v3_is_definer, canonical_is_definer;
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: SECURITY DEFINER validated for all functions';
END;
$$;

-- Test 5: Critical Type Safety - delivery_status must be TEXT, not VARCHAR
DO $$
DECLARE
    delivery_status_mentions int;
BEGIN
    -- Count mentions of delivery_status casting to ensure no varchar leakage
    SELECT COUNT(*) INTO delivery_status_mentions
    FROM (
        SELECT pg_get_functiondef(p.oid) as def
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages_v3'
    ) f
    WHERE f.def LIKE '%::text as delivery_status%';
    
    IF delivery_status_mentions < 3 THEN
        RAISE EXCEPTION 'CRITICAL: v3 function must cast delivery_status to text in all UNION branches to prevent 42804 errors. Found % casts, expected >= 3', delivery_status_mentions;
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: delivery_status type casting validated (% explicit casts found)', delivery_status_mentions;
END;
$$;

-- Test 6: Direct Message Gating Contract
DO $$
DECLARE
    direct_only_via_deliveries boolean := false;
    own_messages_exclude_direct boolean := false;
    func_def text;
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO func_def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_guest_event_messages_v3';
    
    -- Check that direct messages only come via deliveries path
    IF func_def LIKE '%md.guest_id = guest_record.id%' THEN
        direct_only_via_deliveries := true;
    END IF;
    
    -- Check that own messages exclude direct type 
    IF func_def LIKE '%m.message_type != ''direct''%' THEN
        own_messages_exclude_direct := true;
    END IF;
    
    IF NOT direct_only_via_deliveries THEN
        RAISE EXCEPTION 'CRITICAL: Direct messages must only appear via deliveries path (md.guest_id = guest_record.id)';
    END IF;
    
    IF NOT own_messages_exclude_direct THEN
        RAISE EXCEPTION 'CRITICAL: Own messages branch must exclude direct type to preserve delivery gating';
    END IF;
    
    RAISE NOTICE 'CONTRACT PASS: Direct message delivery gating validated';
END;
$$;

-- Final validation message
DO $$
BEGIN
    RAISE NOTICE '=== MESSAGING RPC CONTRACT TESTS COMPLETE ===';
    RAISE NOTICE 'All critical contracts validated:';
    RAISE NOTICE '  ✓ Function signatures stable';
    RAISE NOTICE '  ✓ Return types consistent'; 
    RAISE NOTICE '  ✓ Type casting prevents 42804 errors';
    RAISE NOTICE '  ✓ Direct message gating preserved';
    RAISE NOTICE '  ✓ SECURITY DEFINER enforced';
    RAISE NOTICE 'Database schema is contract-compliant.';
END;
$$;
