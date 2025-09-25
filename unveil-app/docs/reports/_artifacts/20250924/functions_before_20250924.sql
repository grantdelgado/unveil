-- FUNCTION DEFINITIONS BEFORE SECURITY HARDENING
-- Generated: September 24, 2025
-- Functions flagged for search_path vulnerabilities

-- ==============================================================================
-- Function 1: sync_rsvp_status_with_declined_at (TRIGGER FUNCTION)
-- ==============================================================================
-- Usage: Trigger on event_guests table to sync rsvp_status with declined_at
-- Classification: Trigger function (SECURITY DEFINER, VOLATILE)
-- Current: No search_path protection

CREATE OR REPLACE FUNCTION public.sync_rsvp_status_with_declined_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Sync rsvp_status based on RSVP-Lite logic
  NEW.rsvp_status = CASE 
    WHEN NEW.declined_at IS NOT NULL THEN 'declined'
    WHEN NEW.invited_at IS NOT NULL THEN 'attending'  -- Invited = attending by default
    ELSE 'pending'  -- Not yet invited
  END;
  
  RETURN NEW;
END;
$function$;

-- ==============================================================================
-- Function 2: update_updated_at_column (TRIGGER FUNCTION)
-- ==============================================================================
-- Usage: Generic trigger function for updating updated_at columns
-- Classification: Trigger function (SECURITY DEFINER, VOLATILE)
-- Current: No search_path protection

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- ==============================================================================
-- Function 3: update_scheduled_message_version (TRIGGER FUNCTION)  
-- ==============================================================================
-- Usage: Trigger on scheduled_messages table to track content modifications
-- Classification: Trigger function (SECURITY DEFINER, VOLATILE)
-- Current: No search_path protection

CREATE OR REPLACE FUNCTION public.update_scheduled_message_version()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only increment version if actual content changed (not just status updates)
  IF (OLD.content != NEW.content OR 
      OLD.send_at != NEW.send_at OR 
      OLD.message_type != NEW.message_type OR
      OLD.target_all_guests != NEW.target_all_guests OR
      OLD.target_guest_ids IS DISTINCT FROM NEW.target_guest_ids OR
      OLD.target_guest_tags IS DISTINCT FROM NEW.target_guest_tags OR
      OLD.send_via_sms != NEW.send_via_sms OR
      OLD.send_via_push != NEW.send_via_push) THEN
    
    -- Only update if not already updated by the RPC function
    IF NEW.version = OLD.version THEN
      NEW.version = OLD.version + 1;
      NEW.modified_at = NOW();
      NEW.modification_count = OLD.modification_count + 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==============================================================================
-- CURRENT TRIGGER USAGE
-- ==============================================================================

-- sync_rsvp_status_with_declined_at used by:
-- - sync_rsvp_status_trigger ON event_guests (BEFORE UPDATE)

-- update_updated_at_column used by:  
-- - update_event_schedule_items_updated_at ON event_schedule_items (BEFORE UPDATE)

-- update_scheduled_message_version used by:
-- - scheduled_message_version_trigger ON scheduled_messages (BEFORE UPDATE)

-- ==============================================================================
-- SECURITY VULNERABILITIES
-- ==============================================================================

-- All 3 functions missing search_path hardening:
-- - No SET search_path = public, pg_temp configuration
-- - No SECURITY DEFINER specified (defaults to INVOKER)
-- - Potential for search path injection attacks
-- - Functions execute in caller's search_path context
