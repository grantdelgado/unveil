-- Migration: Remove Email Columns and References
-- Date: 2025-01-23
-- Purpose: Convert Unveil to phone-only MVP by removing all email functionality
-- 
-- This migration removes:
-- 1. Email columns from all tables
-- 2. Email-related constraints and checks
-- 3. Email parameters from database functions
-- 4. Email references in function return types
--
-- IMPORTANT: This is a destructive migration. Email data will be permanently lost.
-- Ensure proper backups are taken before applying.

BEGIN;

-- ============================================================================
-- PHASE 1: Drop and Recreate Database Functions to Remove Email References
-- ============================================================================

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS public.lookup_user_by_phone(text);
DROP FUNCTION IF EXISTS public.get_event_guests_with_display_names(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.upsert_message_delivery(uuid, uuid, varchar, uuid, varchar, varchar, varchar, varchar, varchar, varchar);
DROP FUNCTION IF EXISTS public.get_messaging_recipients(uuid, boolean);

-- 1. Update add_or_restore_guest function - remove p_email parameter
CREATE OR REPLACE FUNCTION public.add_or_restore_guest(
  p_event_id uuid,
  p_phone text,
  p_name text DEFAULT NULL,
  p_role text DEFAULT 'guest'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone text;
  v_existing_guest_id uuid;
  v_existing_record record;
  v_current_user_id uuid;
  v_result json;
  v_operation text;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user is event host
  IF NOT EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id 
    AND host_user_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Only event hosts can add guests';
  END IF;

  -- Normalize phone number using existing normalize_phone function if it exists
  BEGIN
    v_normalized_phone := public.normalize_phone(p_phone);
  EXCEPTION WHEN undefined_function THEN
    -- Fallback normalization if normalize_phone doesn't exist
    v_normalized_phone := regexp_replace(p_phone, '[^\+0-9]', '', 'g');
    IF NOT v_normalized_phone ~ '^\+[1-9]\d{1,14}$' THEN
      IF length(regexp_replace(v_normalized_phone, '[^0-9]', '', 'g')) = 10 THEN
        v_normalized_phone := '+1' || regexp_replace(v_normalized_phone, '[^0-9]', '', 'g');
      ELSIF length(regexp_replace(v_normalized_phone, '[^0-9]', '', 'g')) = 11 AND v_normalized_phone ~ '^1' THEN
        v_normalized_phone := '+' || regexp_replace(v_normalized_phone, '[^0-9]', '', 'g');
      ELSE
        RAISE EXCEPTION 'Invalid phone number format';
      END IF;
    END IF;
  END;

  IF v_normalized_phone IS NULL THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;

  -- Prevent adding hosts as guests
  IF p_role = 'host' THEN
    RAISE EXCEPTION 'Cannot add hosts through this function';
  END IF;

  -- Look for existing record (active or removed) for this (event_id, phone)
  SELECT * INTO v_existing_record
  FROM public.event_guests 
  WHERE event_id = p_event_id 
    AND phone = v_normalized_phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_record.id IS NOT NULL THEN
    -- Record exists
    v_existing_guest_id := v_existing_record.id;
    
    IF v_existing_record.removed_at IS NOT NULL THEN
      -- Restore removed guest - PRESERVE SMS OPT-OUT STATUS
      UPDATE public.event_guests 
      SET 
        removed_at = NULL,
        guest_name = COALESCE(p_name, v_existing_record.guest_name),
        role = p_role,
        declined_at = NULL,  -- Clear any previous decline
        decline_reason = NULL,
        -- sms_opt_out = PRESERVED (don't reset to false)
        a2p_notice_sent_at = NULL,  -- Reset A2P notice - ensures compliance message on first SMS
        updated_at = NOW()
      WHERE id = v_existing_guest_id;
      
      v_operation := 'restored';
    ELSE
      -- Already active - update details but don't reset SMS opt-out or A2P notice
      UPDATE public.event_guests 
      SET 
        guest_name = COALESCE(p_name, v_existing_record.guest_name),
        role = p_role,
        updated_at = NOW()
      WHERE id = v_existing_guest_id;
      
      v_operation := 'updated';
    END IF;
  ELSE
    -- No existing record - create new guest (default sms_opt_out = false)
    INSERT INTO public.event_guests (
      event_id,
      phone,
      guest_name,
      role,
      rsvp_status,
      sms_opt_out,
      user_id,
      created_at,
      updated_at
    ) VALUES (
      p_event_id,
      v_normalized_phone,
      p_name,
      p_role,
      'pending',
      false,  -- New guests default to SMS enabled
      NULL,  -- Explicitly set user_id to NULL for new guests
      NOW(),
      NOW()
    ) RETURNING id INTO v_existing_guest_id;
    
    v_operation := 'inserted';
  END IF;

  -- Return result with operation details (no email field)
  SELECT json_build_object(
    'success', true,
    'operation', v_operation,
    'guest_id', v_existing_guest_id,
    'event_id', p_event_id,
    'phone', v_normalized_phone,
    'name', p_name,
    'role', p_role
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Update lookup_user_by_phone function - remove email from return
CREATE OR REPLACE FUNCTION public.lookup_user_by_phone(user_phone text)
RETURNS TABLE(
  id uuid,
  phone text,
  full_name text,
  created_at timestamptz,
  onboarding_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.phone, u.full_name, u.created_at, u.onboarding_completed
  FROM public.users u
  WHERE u.phone = user_phone;
END;
$$;

-- 3. Update get_event_guests_with_display_names function - remove email columns
CREATE OR REPLACE FUNCTION public.get_event_guests_with_display_names(
  p_event_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  user_id uuid,
  guest_name text,
  phone text,
  rsvp_status text,
  notes text,
  guest_tags text[],
  role text,
  invited_at timestamptz,
  last_invited_at timestamptz,
  first_invited_at timestamptz,
  last_messaged_at timestamptz,
  invite_attempts integer,
  joined_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  removed_at timestamptz,
  phone_number_verified boolean,
  sms_opt_out boolean,
  preferred_communication text,
  created_at timestamptz,
  updated_at timestamptz,
  guest_display_name text,
  user_full_name text,
  user_phone text,
  user_avatar_url text,
  user_created_at timestamptz,
  user_updated_at timestamptz,
  user_intended_redirect text,
  user_onboarding_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id,
    eg.event_id,
    eg.user_id,
    eg.guest_name::text,
    eg.phone::text,
    eg.rsvp_status::text,
    eg.notes::text,
    eg.guest_tags,
    eg.role::text,
    eg.invited_at,
    eg.last_invited_at,
    eg.first_invited_at,
    eg.last_messaged_at,
    eg.invite_attempts,
    eg.joined_at,
    eg.declined_at,
    eg.decline_reason::text,
    eg.removed_at,
    eg.phone_number_verified,
    eg.sms_opt_out,
    eg.preferred_communication::text,
    eg.created_at,
    eg.updated_at,
    COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest')::text AS guest_display_name,
    u.full_name::text AS user_full_name,
    u.phone::text AS user_phone,
    u.avatar_url::text AS user_avatar_url,
    u.created_at AS user_created_at,
    u.updated_at AS user_updated_at,
    u.intended_redirect::text AS user_intended_redirect,
    u.onboarding_completed AS user_onboarding_completed
  FROM 
    public.event_guests eg
    LEFT JOIN public.users u ON u.id = eg.user_id
  WHERE 
    eg.event_id = p_event_id
    AND eg.removed_at IS NULL  -- Exclude soft-deleted guests
  ORDER BY eg.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. Update upsert_message_delivery function - remove email parameters
CREATE OR REPLACE FUNCTION public.upsert_message_delivery(
  p_message_id uuid,
  p_guest_id uuid,
  p_phone_number varchar DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_sms_status varchar DEFAULT 'pending',
  p_push_status varchar DEFAULT 'pending',
  p_sms_provider_id varchar DEFAULT NULL,
  p_push_provider_id varchar DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delivery_id uuid;
BEGIN
  -- Validate required parameters
  IF p_message_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'message_id and guest_id are required';
  END IF;
  
  -- Upsert delivery record (insert or update if exists) - no email fields
  INSERT INTO public.message_deliveries (
    message_id, 
    guest_id, 
    phone_number, 
    user_id, 
    sms_status, 
    push_status,
    sms_provider_id,
    push_provider_id,
    created_at,
    updated_at
  )
  VALUES (
    p_message_id, 
    p_guest_id, 
    p_phone_number, 
    p_user_id,
    p_sms_status, 
    p_push_status,
    p_sms_provider_id,
    p_push_provider_id,
    now(),
    now()
  )
  ON CONFLICT (message_id, guest_id)
  DO UPDATE SET
    sms_status = CASE 
      WHEN EXCLUDED.sms_status != 'pending' THEN EXCLUDED.sms_status 
      ELSE message_deliveries.sms_status 
    END,
    push_status = CASE 
      WHEN EXCLUDED.push_status != 'pending' THEN EXCLUDED.push_status 
      ELSE message_deliveries.push_status 
    END,
    sms_provider_id = COALESCE(EXCLUDED.sms_provider_id, message_deliveries.sms_provider_id),
    push_provider_id = COALESCE(EXCLUDED.push_provider_id, message_deliveries.push_provider_id),
    phone_number = COALESCE(EXCLUDED.phone_number, message_deliveries.phone_number),
    user_id = COALESCE(EXCLUDED.user_id, message_deliveries.user_id),
    updated_at = now()
  RETURNING id INTO delivery_id;
  
  RETURN delivery_id;
END;
$$;

-- 5. Update get_messaging_recipients function - remove email columns
CREATE OR REPLACE FUNCTION public.get_messaging_recipients(
  p_event_id uuid,
  p_include_hosts boolean DEFAULT false
)
RETURNS TABLE(
  event_guest_id uuid,
  guest_name text,
  phone text,
  role text,
  guest_tags text[],
  invited_at timestamptz,
  declined_at timestamptz,
  sms_opt_out boolean,
  guest_display_name text,
  user_full_name text,
  user_phone text,
  has_valid_phone boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user can access this event
    IF NOT public.can_access_event(p_event_id) THEN
        RAISE EXCEPTION 'Access denied to event %', p_event_id;
    END IF;

    RETURN QUERY
    SELECT 
        eg.id as event_guest_id,
        eg.guest_name,
        eg.phone,
        eg.role,
        eg.guest_tags,
        eg.invited_at,
        eg.declined_at,
        eg.sms_opt_out,
        -- Updated display name logic: display_name -> full_name -> guest_name -> 'Guest'
        COALESCE(
            NULLIF(eg.display_name, ''),  -- Use event_guests.display_name first
            NULLIF(u.full_name, ''),      -- Then users.full_name
            NULLIF(eg.guest_name, ''),    -- Then event_guests.guest_name
            'Guest'                       -- Finally fallback to 'Guest'
        ) as guest_display_name,
        u.full_name as user_full_name,
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
        CASE WHEN eg.role = 'host' THEN 0 ELSE 1 END,  -- Hosts first
        eg.created_at ASC;
END;
$$;

-- ============================================================================
-- PHASE 2: Update Data and Check Constraints
-- ============================================================================

-- Update any existing 'email' preferred_communication to 'sms' before removing constraint
UPDATE public.event_guests 
SET preferred_communication = 'sms' 
WHERE preferred_communication = 'email';

-- Remove email from preferred_communication check constraint
ALTER TABLE public.event_guests DROP CONSTRAINT IF EXISTS event_guests_preferred_communication_check;
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_preferred_communication_check 
  CHECK (preferred_communication::text = ANY (ARRAY['sms'::character varying::text, 'push'::character varying::text, 'none'::character varying::text]));

-- Remove email_status check constraint (will be dropped with column)
ALTER TABLE public.message_deliveries DROP CONSTRAINT IF EXISTS message_deliveries_email_status_check;

-- ============================================================================
-- PHASE 3: Drop Email Columns
-- ============================================================================

-- Drop email column from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS email;

-- Drop guest_email column from event_guests table  
ALTER TABLE public.event_guests DROP COLUMN IF EXISTS guest_email;

-- Drop email-related columns from message_deliveries table
ALTER TABLE public.message_deliveries DROP COLUMN IF EXISTS email;
ALTER TABLE public.message_deliveries DROP COLUMN IF EXISTS email_status;
ALTER TABLE public.message_deliveries DROP COLUMN IF EXISTS email_provider_id;

-- Drop send_via_email column from scheduled_messages table
ALTER TABLE public.scheduled_messages DROP COLUMN IF EXISTS send_via_email;

-- ============================================================================
-- PHASE 4: Verification
-- ============================================================================

-- Verify no email columns remain
DO $$
DECLARE
  email_column_count integer;
BEGIN
  SELECT COUNT(*) INTO email_column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND column_name ILIKE '%email%';
  
  IF email_column_count > 0 THEN
    RAISE EXCEPTION 'Email columns still exist after migration. Count: %', email_column_count;
  END IF;
  
  RAISE NOTICE 'Migration completed successfully. All email columns removed.';
END $$;

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- 
-- REMOVED:
-- - users.email column
-- - event_guests.guest_email column  
-- - message_deliveries.email column
-- - message_deliveries.email_status column
-- - message_deliveries.email_provider_id column
-- - scheduled_messages.send_via_email column
-- - Email references from 5 database functions
-- - Email option from preferred_communication constraint
-- - email_status check constraint
--
-- PRESERVED:
-- - All phone-based functionality
-- - SMS messaging system
-- - Push notification infrastructure
-- - All existing data except email fields
--
-- IMPACT:
-- - Guest import/export will be phone-only
-- - Messaging system will be SMS + push only
-- - User profiles will be phone-only
-- - All authentication remains phone-based (no change)
--
-- ============================================================================
