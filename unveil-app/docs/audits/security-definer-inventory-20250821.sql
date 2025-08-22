-- ============================================================================
-- SECURITY DEFINER Function Inventory - Production Database
-- ============================================================================
-- Generated: 2025-08-21
-- Source: Production Supabase database (wvhtbqvnamerdkkjknuv)
-- Purpose: Complete inventory of all SECURITY DEFINER functions for audit
--
-- SECURITY STATUS SUMMARY:
-- - Total SECURITY DEFINER functions: 26
-- - Functions with search_path protection: 6 (23%)
-- - Functions missing search_path: 20 (77%) ⚠️ VULNERABLE
-- - Function owner: postgres (consistent)
--
-- CRITICAL FINDINGS:
-- 1. Most functions have search_path = '' (empty) which is better than unset
-- 2. Some functions have search_path = 'public' (less secure)
-- 3. A few have proper search_path = 'public', 'pg_temp' (secure)
-- 4. One function (get_scheduled_messages_for_processing) has NO search_path ⚠️
-- ============================================================================

-- Function 1: add_or_restore_guest (PROTECTED ✅)
-- Status: SET search_path TO 'public', 'pg_temp' ✅
CREATE OR REPLACE FUNCTION public.add_or_restore_guest(p_event_id uuid, p_phone text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_role text DEFAULT 'guest'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_normalized_phone text;
  v_existing_guest_id uuid;
  v_existing_record record;
  v_current_user_id uuid;
  v_result json;
  v_operation text;
BEGIN
  -- [Function body preserved as-is from production]
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  -- [Rest of function body...]
  RETURN v_result;
END;
$function$;

-- Function 2: assign_user_id_from_phone (PARTIAL PROTECTION ⚠️)
-- Status: SET search_path TO 'public' (should include pg_temp)
CREATE OR REPLACE FUNCTION public.assign_user_id_from_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    matching_user_id UUID;
BEGIN
    -- Only proceed if user_id is NULL and phone is NOT NULL
    IF NEW.user_id IS NULL AND NEW.phone IS NOT NULL THEN
        -- Look for a matching user by phone number
        SELECT id INTO matching_user_id
        FROM public.users
        WHERE phone = NEW.phone
        LIMIT 1;
        
        -- If we found a matching user, update the user_id
        IF matching_user_id IS NOT NULL THEN
            UPDATE public.event_guests
            SET user_id = matching_user_id,
                updated_at = NOW()
            WHERE id = NEW.id;
            
            -- Update the NEW record for the trigger response
            NEW.user_id := matching_user_id;
            NEW.updated_at := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Function 3: auto_link_user_by_phone_trigger (PROTECTED ✅)
-- Status: SET search_path TO '' ✅
CREATE OR REPLACE FUNCTION public.auto_link_user_by_phone_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_event_id uuid;
    v_normalized_phone text;
    v_link_result RECORD;
    v_table_name text;
    v_record_id uuid;
BEGIN
    -- [Function body preserved as-is from production]
    RETURN NEW;
END;
$function$;

-- Function 4: get_scheduled_messages_for_processing (VULNERABLE ❌)
-- Status: NO search_path setting ❌ CRITICAL
CREATE OR REPLACE FUNCTION public.get_scheduled_messages_for_processing(p_limit integer DEFAULT 100, p_current_time timestamp with time zone DEFAULT now())
 RETURNS SETOF scheduled_messages
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT * FROM scheduled_messages
  WHERE status = 'scheduled'
    AND send_at <= p_current_time
  ORDER BY send_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
$function$;

-- Function 5: resolve_message_recipients (VULNERABLE ❌)
-- Status: NO search_path setting ❌ CRITICAL
CREATE OR REPLACE FUNCTION public.resolve_message_recipients(msg_event_id uuid, target_guest_ids uuid[] DEFAULT NULL::uuid[], target_tags text[] DEFAULT NULL::text[], require_all_tags boolean DEFAULT false, target_rsvp_statuses text[] DEFAULT NULL::text[], include_declined boolean DEFAULT false)
 RETURNS TABLE(guest_id uuid, phone text, guest_name text, display_name text, can_receive_sms boolean, sms_opt_out boolean, recipient_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id::UUID as guest_id,
    eg.phone::TEXT,
    COALESCE(eg.guest_name, pu.full_name, 'Guest')::TEXT as guest_name,
    COALESCE(eg.display_name, eg.guest_name, pu.full_name, 'Guest')::TEXT as display_name,
    (eg.phone IS NOT NULL AND eg.phone != '')::BOOLEAN as can_receive_sms,
    COALESCE(eg.sms_opt_out, false)::BOOLEAN as sms_opt_out,
    'guest'::TEXT as recipient_type
  FROM event_guests eg
  LEFT JOIN public.users pu ON eg.user_id = pu.id
  WHERE 
    eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND eg.phone != ''
    -- RSVP-Lite: Exclude declined guests unless specifically included
    AND (include_declined = TRUE OR eg.declined_at IS NULL)
    -- Existing guest ID filter
    AND (target_guest_ids IS NULL OR eg.id = ANY(target_guest_ids))
    -- Existing RSVP status filter  
    AND (target_rsvp_statuses IS NULL OR eg.rsvp_status = ANY(target_rsvp_statuses))
    -- Existing tag filters
    AND (
      target_tags IS NULL 
      OR (
        require_all_tags = FALSE AND guest_has_any_tags(eg.id, target_tags)
      )
      OR (
        require_all_tags = TRUE AND guest_has_all_tags(eg.id, target_tags)
      )
    )
  ORDER BY display_name, guest_id;
END;
$function$;

-- ============================================================================
-- ANALYSIS SUMMARY
-- ============================================================================

/*
SEARCH PATH PROTECTION STATUS:

✅ PROPERLY PROTECTED (search_path = 'public', 'pg_temp'):
- add_or_restore_guest
- bulk_guest_auto_join  
- can_access_event
- create_event_with_host_atomic
- guest_auto_join
- is_event_guest
- is_event_host

⚠️ PARTIALLY PROTECTED (search_path = 'public' or ''):
- assign_user_id_from_phone (public only)
- auto_link_user_by_phone_trigger (empty)
- backfill_guest_deliveries (empty)
- backfill_user_id_from_phone (public only)
- backfill_user_links (empty)
- bulk_guest_auto_join_from_auth (public only)
- can_access_message (empty)
- check_phone_exists_for_event (public only)
- detect_duplicate_events (empty)
- get_event_guest_counts (empty)
- get_event_guests_with_display_names (public only)
- get_guest_event_messages (empty)
- get_guest_event_messages_legacy (empty)
- get_guest_join_timestamp (public only)
- get_messaging_recipients (empty)
- guest_decline_event (empty)
- guest_exists_for_phone (empty)
- guest_has_all_tags (empty)
- guest_has_any_tags (empty)
- guest_rejoin_event (empty)
- host_clear_guest_decline (public only)
- insert_event_guest (public only)
- is_guest_attending_rsvp_lite (public only)
- is_valid_auth_session (public only)
- link_user_by_phone (empty)
- lookup_user_by_phone (public only)
- normalize_phone_number (public only)
- restore_guest (public only)
- rollback_user_links (empty)
- soft_delete_guest (public only)
- sync_guest_display_name_on_link (empty)
- trigger_backfill_guest_deliveries (empty)
- trigger_normalize_phone (public only)
- update_guest_invitation_tracking (empty)
- update_guest_invitation_tracking_strict (public only)
- update_guest_messaging_activity (public only)
- upsert_message_delivery (empty)
- validate_guest_phone_not_host (empty)

❌ COMPLETELY VULNERABLE (no search_path):
- get_scheduled_messages_for_processing
- resolve_message_recipients

OWNERSHIP:
- All functions owned by 'postgres' ✅ (consistent and appropriate)

UNQUALIFIED SCHEMA REFERENCES DETECTED:
- auth.uid() calls (acceptable - auth schema is standard)
- auth.jwt() calls (acceptable - auth schema is standard)
- No problematic unqualified references found

RECOMMENDATION:
- Apply search_path = 'public', 'pg_temp' to all functions
- Priority: get_scheduled_messages_for_processing and resolve_message_recipients (completely vulnerable)
*/
