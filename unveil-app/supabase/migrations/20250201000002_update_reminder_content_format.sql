-- Migration: Update Reminder Content Format
-- Updates the reminder content builder to use concise format and migrates existing scheduled reminders

BEGIN;

-- =====================================================
-- 1. UPDATE CONTENT BUILDER FUNCTION
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
  v_location TEXT;
  v_content TEXT;
BEGIN
  -- Format time in event timezone with abbreviation (time only, no date)
  -- Format: "7:30 PM MDT"
  v_formatted_time := to_char(
    p_start_at_utc AT TIME ZONE p_event_timezone,
    'HH12:MI AM TZ'
  );

  -- Get location from the schedule item if available
  SELECT location INTO v_location
  FROM public.event_schedule_items esi
  WHERE esi.event_id = p_event_id
    AND esi.start_at = p_start_at_utc
    AND esi.title = p_sub_event_title
  LIMIT 1;

  -- Build concise reminder message
  -- Format: [Reminder] {Title} at {Time}{ at {Location}}
  v_content := format('[Reminder] %s at %s', p_sub_event_title, v_formatted_time);
  
  -- Add location if present (avoid double spaces)
  IF v_location IS NOT NULL AND trim(v_location) != '' THEN
    v_content := v_content || format(' at %s', trim(v_location));
  END IF;

  -- Server adds STOP text (preserved from original)
  v_content := v_content || E'\nReply STOP to opt out.';

  RETURN v_content;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.build_event_reminder_content IS 
'Builds concise SMS content for event reminders: [Reminder] Title at Time{ at Location}';

-- =====================================================
-- 2. MIGRATE EXISTING SCHEDULED REMINDERS
-- =====================================================

-- Update content for existing scheduled reminders to use new format
-- Only update scheduled reminders (not sent/cancelled ones)
DO $$
DECLARE
  reminder_record RECORD;
  new_content TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through existing scheduled reminders
  FOR reminder_record IN 
    SELECT 
      sm.id,
      sm.event_id,
      sm.trigger_ref_id,
      esi.title as sub_event_title,
      esi.start_at,
      e.time_zone
    FROM public.scheduled_messages sm
    JOIN public.event_schedule_items esi ON esi.id = sm.trigger_ref_id
    JOIN public.events e ON e.id = sm.event_id
    WHERE sm.trigger_source = 'event_reminder'
      AND sm.status = 'scheduled'
  LOOP
    -- Generate new content using updated function
    SELECT public.build_event_reminder_content(
      reminder_record.sub_event_title,
      reminder_record.start_at,
      reminder_record.time_zone,
      reminder_record.event_id
    ) INTO new_content;

    -- Update the scheduled message with new content
    UPDATE public.scheduled_messages
    SET 
      content = new_content,
      updated_at = NOW(),
      modification_count = COALESCE(modification_count, 0) + 1,
      modified_at = NOW()
    WHERE id = reminder_record.id;

    updated_count := updated_count + 1;
  END LOOP;

  -- Log the migration result
  RAISE NOTICE 'Updated % scheduled reminder(s) to new content format', updated_count;
END;
$$;

COMMIT;
