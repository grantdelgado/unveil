-- phase3: Fix search_path vulnerabilities in all functions
-- Addresses critical security issue identified in Supabase security audit
-- Impact: Prevents schema-based SQL injection attacks

BEGIN;

-- ============================================================================
-- SECURITY FIX: SET SECURE search_path FOR ALL FUNCTIONS
-- This prevents schema-based attacks by restricting function search paths
-- ============================================================================

-- Fix recently optimized helper functions from Phase 2
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Cache auth.uid() call for better performance
    current_user_id := (SELECT auth.uid());
    
    -- Early return if no authenticated user
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Primary host check - uses idx_events_host_lookup index
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Secondary check for guest with host role
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.user_id = current_user_id
        AND eg.role = 'host'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
    current_phone text;
BEGIN
    -- Cache auth values for better performance
    current_user_id := (SELECT auth.uid());
    current_phone := (auth.jwt() ->> 'phone');
    
    -- Early return if no authentication context
    IF current_user_id IS NULL AND current_phone IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check guest access
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND (
            (current_user_id IS NOT NULL AND eg.user_id = current_user_id)
            OR 
            (current_phone IS NOT NULL AND eg.phone = current_phone)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
    current_phone text;
BEGIN
    -- Cache auth values for better performance
    current_user_id := (SELECT auth.uid());
    current_phone := (auth.jwt() ->> 'phone');
    
    -- Early return if no authentication context
    IF current_user_id IS NULL AND current_phone IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if public event (fastest check first)
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.is_public = true
    ) THEN
        RETURN true;
    END IF;
    
    -- Host access check
    IF current_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Guest access check
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND (
            (current_user_id IS NOT NULL AND eg.user_id = current_user_id)
            OR 
            (current_phone IS NOT NULL AND eg.phone = current_phone)
        )
    );
END;
$$;

-- Fix Phase 2 new helper functions
CREATE OR REPLACE FUNCTION public.guest_exists_for_phone(p_event_id uuid, p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.phone = p_phone
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    message_event_id uuid;
BEGIN
    -- Get event_id for the message
    SELECT m.event_id INTO message_event_id
    FROM public.messages m
    WHERE m.id = p_message_id
    LIMIT 1;
    
    -- Return access check for the event
    IF message_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN public.can_access_event(message_event_id);
END;
$$;

-- Fix legacy helper functions
CREATE OR REPLACE FUNCTION public.get_user_events(user_id_param uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, title text, event_date date, location text, role text, rsvp_status text, is_host boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = COALESCE(user_id_param, auth.uid()) THEN 'host'::TEXT
      ELSE COALESCE(eg.role, 'guest'::TEXT)
    END,
    eg.rsvp_status,
    (e.host_user_id = COALESCE(user_id_param, auth.uid()))
  FROM public.events e
  LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = COALESCE(user_id_param, auth.uid())
  WHERE e.host_user_id = COALESCE(user_id_param, auth.uid()) OR eg.user_id = COALESCE(user_id_param, auth.uid())
  ORDER BY e.event_date DESC;
END;
$$;

-- Fix tag-related functions
CREATE OR REPLACE FUNCTION public.guest_has_any_tags(guest_id uuid, target_tags text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  guest_tags TEXT[];
BEGIN
  -- Get the guest's tags
  SELECT event_guests.guest_tags INTO guest_tags
  FROM public.event_guests
  WHERE event_guests.id = guest_id;
  
  -- If no tags specified or guest has no tags, return false
  IF target_tags IS NULL OR array_length(target_tags, 1) IS NULL 
     OR guest_tags IS NULL OR array_length(guest_tags, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if guest has any of the target tags
  RETURN guest_tags && target_tags;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_has_all_tags(guest_id uuid, target_tags text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  guest_tags TEXT[];
BEGIN
  -- Get the guest's tags
  SELECT event_guests.guest_tags INTO guest_tags
  FROM public.event_guests
  WHERE event_guests.id = guest_id;
  
  -- If no tags specified, return true (vacuous truth)
  IF target_tags IS NULL OR array_length(target_tags, 1) IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- If guest has no tags but tags are required, return false
  IF guest_tags IS NULL OR array_length(guest_tags, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if guest has all target tags
  RETURN target_tags <@ guest_tags;
END;
$$;

-- Fix message recipient resolution function
CREATE OR REPLACE FUNCTION public.resolve_message_recipients(msg_event_id uuid, target_guest_ids uuid[] DEFAULT NULL::uuid[], target_tags text[] DEFAULT NULL::text[], require_all_tags boolean DEFAULT false, target_rsvp_statuses text[] DEFAULT NULL::text[])
RETURNS TABLE(guest_id uuid, guest_phone text, guest_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id as guest_id,
    eg.phone as guest_phone,
    eg.guest_name as guest_name
  FROM public.event_guests eg
  WHERE eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND (
      -- If explicit guest IDs are provided, use those
      (target_guest_ids IS NOT NULL AND eg.id = ANY(target_guest_ids))
      OR
      -- Otherwise, apply tag and RSVP filters
      (
        target_guest_ids IS NULL
        AND
        -- Tag filtering
        (
          target_tags IS NULL 
          OR array_length(target_tags, 1) IS NULL
          OR (
            require_all_tags = FALSE 
            AND public.guest_has_any_tags(eg.id, target_tags)
          )
          OR (
            require_all_tags = TRUE 
            AND public.guest_has_all_tags(eg.id, target_tags)
          )
        )
        AND
        -- RSVP status filtering
        (
          target_rsvp_statuses IS NULL 
          OR array_length(target_rsvp_statuses, 1) IS NULL
          OR eg.rsvp_status = ANY(target_rsvp_statuses)
        )
      )
    );
END;
$$;

-- Fix trigger functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tag_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  tag TEXT;
BEGIN
  -- Check each tag in the array
  IF NEW.guest_tags IS NOT NULL THEN
    FOREACH tag IN ARRAY NEW.guest_tags
    LOOP
      -- Check tag length (max 20 characters)
      IF length(tag) > 20 THEN
        RAISE EXCEPTION 'Tag "%" exceeds maximum length of 20 characters', tag;
      END IF;
      
      -- Check tag format (alphanumeric, spaces, hyphens, underscores only)
      IF NOT tag ~ '^[a-zA-Z0-9\s\-_]+$' THEN
        RAISE EXCEPTION 'Tag "%" contains invalid characters. Only letters, numbers, spaces, hyphens, and underscores are allowed.', tag;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    phone, 
    full_name, 
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'guest',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- UPDATE FUNCTION COMMENTS TO REFLECT SECURITY HARDENING
-- ============================================================================

COMMENT ON FUNCTION public.is_event_host(uuid) IS 
'Secure host access check with fixed search_path. Uses optimized indexes. Target: <1ms execution.';

COMMENT ON FUNCTION public.is_event_guest(uuid) IS 
'Secure guest access check with fixed search_path. Optimized for user_id and phone auth.';

COMMENT ON FUNCTION public.can_access_event(uuid) IS 
'Secure event access validation with fixed search_path. Prevents schema-based attacks.';

COMMIT;

-- ============================================================================
-- SECURITY HARDENING SUMMARY:
-- ============================================================================
-- 1. Fixed search_path vulnerabilities in 12 functions by setting search_path = ''
-- 2. All functions now explicitly reference public schema to prevent attacks
-- 3. Maintained all performance optimizations from Phase 2
-- 4. Added security comments for monitoring and documentation
-- 5. Target: Zero search_path security vulnerabilities
-- ============================================================================ 