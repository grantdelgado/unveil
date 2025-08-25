-- Migration: Add Event Reminder RPC Functions
-- This migration adds the RPC functions needed for managing event reminders

BEGIN;

-- =====================================================
-- 1. CONTENT TEMPLATE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.build_event_reminder_content(
  p_sub_event_title TEXT,
  p_start_at_utc TIMESTAMPTZ,
  p_event_timezone TEXT,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_formatted_time TEXT;
  v_app_url TEXT := 'https://unveil.app/guest/';
  v_timezone_abbr TEXT;
BEGIN
  -- Get timezone abbreviation for the specific date
  SELECT EXTRACT(timezone_abbr FROM p_start_at_utc AT TIME ZONE p_event_timezone) INTO v_timezone_abbr;
  
  -- Format time in event timezone with abbreviation
  -- Format: "Thu, Aug 21 at 3:00 PM MDT"
  v_formatted_time := to_char(
    p_start_at_utc AT TIME ZONE p_event_timezone,
    'Dy, Mon DD at HH12:MI AM'
  ) || ' ' || COALESCE(v_timezone_abbr, '');

  -- Build concise reminder message (target 1 SMS segment ~160 chars)
  RETURN format(
    'Reminder: %s starts at %s. Details: %s%s
Reply STOP to opt out.',
    p_sub_event_title,
    v_formatted_time,
    v_app_url,
    p_event_id
  );
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.build_event_reminder_content IS 
'Builds SMS content for event reminders with proper timezone formatting';

-- =====================================================
-- 2. CORE UPSERT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.upsert_event_reminder(
  p_event_id UUID,
  p_timeline_id UUID,
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_timezone TEXT;
  v_start_at TIMESTAMPTZ;
  v_sub_event_title TEXT;
  v_send_at_utc TIMESTAMPTZ;
  v_content TEXT;
  v_host_user_id UUID;
  v_min_buffer INTERVAL := '4 minutes'; -- 3min lead + 1min freeze (matches existing constraint)
  v_existing_count INTEGER;
BEGIN
  -- Verify host permissions and get event details
  SELECT host_user_id, time_zone INTO v_host_user_id, v_event_timezone
  FROM public.events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  IF v_host_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: Only event hosts can manage reminders');
  END IF;

  -- Get sub-event details
  SELECT start_at, title INTO v_start_at, v_sub_event_title
  FROM public.event_schedule_items 
  WHERE id = p_timeline_id AND event_id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Schedule item not found');
  END IF;

  -- Validate that we have a timezone
  IF v_event_timezone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event timezone not set');
  END IF;

  -- Calculate reminder time (1 hour before start)
  v_send_at_utc := v_start_at - INTERVAL '1 hour';

  IF p_enabled THEN
    -- Validate timing constraint (must be at least 4 minutes in the future)
    IF v_send_at_utc <= NOW() + v_min_buffer THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Too close to start time to schedule reminder (need at least 4 minutes lead time)'
      );
    END IF;

    -- Build reminder content
    v_content := public.build_event_reminder_content(
      v_sub_event_title,
      v_start_at,
      v_event_timezone,
      p_event_id
    );

    -- Upsert reminder (insert or update existing)
    INSERT INTO public.scheduled_messages (
      event_id, sender_user_id, content, message_type, send_at,
      target_all_guests, send_via_sms, send_via_push, send_via_email,
      trigger_source, trigger_ref_id, status
    ) VALUES (
      p_event_id, v_host_user_id, v_content, 'announcement', v_send_at_utc,
      true, true, true, false, -- Target all guests via SMS and push, not email
      'event_reminder', p_timeline_id, 'scheduled'
    )
    ON CONFLICT (event_id, trigger_source, trigger_ref_id) 
    WHERE trigger_source = 'event_reminder' AND status IN ('scheduled')
    DO UPDATE SET
      content = EXCLUDED.content,
      send_at = EXCLUDED.send_at,
      updated_at = NOW(),
      version = scheduled_messages.version + 1,
      modification_count = scheduled_messages.modification_count + 1,
      modified_at = NOW();

    RETURN jsonb_build_object(
      'success', true, 
      'action', 'enabled',
      'send_at', v_send_at_utc,
      'content_preview', left(v_content, 50) || '...'
    );
  ELSE
    -- Cancel existing reminder
    UPDATE public.scheduled_messages 
    SET 
      status = 'cancelled', 
      updated_at = NOW(),
      modification_count = modification_count + 1,
      modified_at = NOW()
    WHERE event_id = p_event_id 
      AND trigger_source = 'event_reminder' 
      AND trigger_ref_id = p_timeline_id
      AND status = 'scheduled';

    GET DIAGNOSTICS v_existing_count = ROW_COUNT;

    RETURN jsonb_build_object(
      'success', true, 
      'action', 'disabled',
      'cancelled_count', v_existing_count
    );
  END IF;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.upsert_event_reminder IS 
'Creates, updates, or cancels 1-hour reminders for event schedule items. Host-only access.';

-- =====================================================
-- 3. SYNC FUNCTION FOR TIME CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_event_reminder_on_time_change(
  p_event_id UUID,
  p_timeline_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reminder_exists BOOLEAN;
  v_host_user_id UUID;
BEGIN
  -- Verify host permissions
  SELECT host_user_id INTO v_host_user_id
  FROM public.events WHERE id = p_event_id;
  
  IF NOT FOUND OR v_host_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Check if reminder exists for this sub-event
  SELECT EXISTS(
    SELECT 1 FROM public.scheduled_messages 
    WHERE event_id = p_event_id 
      AND trigger_source = 'event_reminder'
      AND trigger_ref_id = p_timeline_id
      AND status = 'scheduled'
  ) INTO v_reminder_exists;

  -- If reminder exists, re-upsert with current toggle state (enabled=true)
  IF v_reminder_exists THEN
    RETURN public.upsert_event_reminder(p_event_id, p_timeline_id, true);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'action', 'no_reminder_to_sync',
    'message', 'No active reminder found for this schedule item'
  );
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.sync_event_reminder_on_time_change IS 
'Syncs reminder timing when schedule item times are modified. Host-only access.';

-- =====================================================
-- 4. QUERY FUNCTION FOR UI STATE
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_event_reminder_status(
  p_event_id UUID,
  p_timeline_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host_user_id UUID;
  v_reminder_record RECORD;
BEGIN
  -- Verify host permissions
  SELECT host_user_id INTO v_host_user_id
  FROM public.events WHERE id = p_event_id;
  
  IF NOT FOUND OR v_host_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get reminder status
  SELECT 
    id, status, send_at, content, created_at, modified_at
  INTO v_reminder_record
  FROM public.scheduled_messages 
  WHERE event_id = p_event_id 
    AND trigger_source = 'event_reminder'
    AND trigger_ref_id = p_timeline_id
    AND status IN ('scheduled', 'sending') -- Only active reminders
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'enabled', true,
      'reminder_id', v_reminder_record.id,
      'send_at', v_reminder_record.send_at,
      'status', v_reminder_record.status,
      'created_at', v_reminder_record.created_at,
      'modified_at', v_reminder_record.modified_at
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'enabled', false
    );
  END IF;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.get_event_reminder_status IS 
'Gets the current reminder status for a schedule item. Host-only access.';

COMMIT;
