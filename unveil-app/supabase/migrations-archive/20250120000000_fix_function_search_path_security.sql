-- Fix Function Search Path Security
-- 
-- This migration addresses the security vulnerability where RPC functions
-- have mutable search_path, allowing potential SQL injection attacks.
-- 
-- All SECURITY DEFINER functions should have a fixed search_path to prevent
-- search path manipulation attacks.

-- Functions missing search_path configuration (identified as security risks):

-- 1. assign_user_id_from_phone
ALTER FUNCTION public.assign_user_id_from_phone() 
  SET search_path = 'public';

-- 2. backfill_user_id_from_phone  
ALTER FUNCTION public.backfill_user_id_from_phone() 
  SET search_path = 'public';

-- 3. check_phone_exists_for_event
ALTER FUNCTION public.check_phone_exists_for_event(uuid, text) 
  SET search_path = 'public';

-- 4. get_event_guests_with_display_names
ALTER FUNCTION public.get_event_guests_with_display_names(uuid, integer, integer) 
  SET search_path = 'public';

-- 5. get_feature_flag (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.get_feature_flag(text) 
  SET search_path = 'public';

-- 6. get_guest_display_name (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.get_guest_display_name(text, text) 
  SET search_path = 'public';

-- 7. get_guest_invitation_status (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.get_guest_invitation_status(timestamp with time zone, timestamp with time zone, timestamp with time zone) 
  SET search_path = 'public';

-- 8. host_clear_guest_decline
ALTER FUNCTION public.host_clear_guest_decline(uuid, uuid) 
  SET search_path = 'public';

-- 9. insert_event_guest
ALTER FUNCTION public.insert_event_guest(uuid, text, text, text) 
  SET search_path = 'public';

-- 10. is_guest_attending_rsvp_lite
ALTER FUNCTION public.is_guest_attending_rsvp_lite(uuid, uuid) 
  SET search_path = 'public';

-- 11. is_valid_auth_session
ALTER FUNCTION public.is_valid_auth_session(uuid) 
  SET search_path = 'public';

-- 12. is_valid_phone_for_messaging (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.is_valid_phone_for_messaging(text) 
  SET search_path = 'public';

-- 13. lookup_user_by_phone
ALTER FUNCTION public.lookup_user_by_phone(text) 
  SET search_path = 'public';

-- 14. normalize_phone (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.normalize_phone(text) 
  SET search_path = 'public';

-- 15. normalize_phone_number
ALTER FUNCTION public.normalize_phone_number(text) 
  SET search_path = 'public';

-- 16. resolve_message_recipients (correct signature)
ALTER FUNCTION public.resolve_message_recipients(uuid, uuid[], text[], boolean, text[], boolean) 
  SET search_path = 'public';

-- 17. restore_guest
ALTER FUNCTION public.restore_guest(uuid) 
  SET search_path = 'public';

-- 18. soft_delete_guest
ALTER FUNCTION public.soft_delete_guest(uuid) 
  SET search_path = 'public';

-- 19. sync_guest_display_names (not SECURITY DEFINER, but should be consistent)
ALTER FUNCTION public.sync_guest_display_names() 
  SET search_path = 'public';

-- 20. trigger_normalize_phone
ALTER FUNCTION public.trigger_normalize_phone() 
  SET search_path = 'public';

-- 21. update_guest_invitation_tracking_strict
ALTER FUNCTION public.update_guest_invitation_tracking_strict(uuid, uuid[]) 
  SET search_path = 'public';

-- 22. update_guest_messaging_activity
ALTER FUNCTION public.update_guest_messaging_activity(uuid, uuid[]) 
  SET search_path = 'public';

-- Create a comment to document this security fix
COMMENT ON SCHEMA public IS 'Schema secured: All RPC functions now have fixed search_path to prevent injection attacks';

-- Verify the fix by checking function configurations
-- This will be useful for testing the migration
DO $$
DECLARE
    func_record RECORD;
    insecure_count INTEGER := 0;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            p.proconfig as config_settings
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'))
    LOOP
        insecure_count := insecure_count + 1;
        RAISE WARNING 'Function % still has insecure search_path', func_record.function_name;
    END LOOP;
    
    IF insecure_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All functions now have secure search_path configuration';
    ELSE
        RAISE WARNING 'WARNING: % functions still need search_path configuration', insecure_count;
    END IF;
END $$;
