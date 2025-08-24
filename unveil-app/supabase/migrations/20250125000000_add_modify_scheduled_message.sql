-- Add versioning columns to scheduled_messages table
ALTER TABLE scheduled_messages 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS modification_count INTEGER DEFAULT 0;

-- Create function to update scheduled messages with proper validation
CREATE OR REPLACE FUNCTION update_scheduled_message(
  p_message_id UUID,
  p_content TEXT,
  p_send_at TIMESTAMPTZ,
  p_message_type message_type_enum,
  p_target_all_guests BOOLEAN DEFAULT NULL,
  p_target_guest_ids UUID[] DEFAULT NULL,
  p_target_guest_tags TEXT[] DEFAULT NULL,
  p_send_via_sms BOOLEAN DEFAULT NULL,
  p_send_via_push BOOLEAN DEFAULT NULL
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
  v_current_status TEXT;
  v_current_send_at TIMESTAMPTZ;
  v_sender_user_id UUID;
  v_min_lead_seconds INTEGER := 180; -- 3 minutes minimum lead time
  v_freeze_window_seconds INTEGER := 60; -- 1 minute freeze window
BEGIN
  -- Get current message details with row lock
  SELECT event_id, status, send_at, sender_user_id
  INTO v_event_id, v_current_status, v_current_send_at, v_sender_user_id
  FROM scheduled_messages 
  WHERE id = p_message_id
  FOR UPDATE;
  
  -- Check if message exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found');
  END IF;
  
  -- Validate user is the sender or event host
  IF v_sender_user_id != auth.uid() AND NOT is_event_host(v_event_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You can only modify your own messages');
  END IF;
  
  -- Validate message status
  IF v_current_status != 'scheduled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message cannot be modified: Status is ' || v_current_status);
  END IF;
  
  -- Validate timing constraints
  IF p_send_at <= NOW() + INTERVAL '1 second' * (v_min_lead_seconds + v_freeze_window_seconds) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Send time is too soon. Messages must be scheduled at least ' || (v_min_lead_seconds + v_freeze_window_seconds) || ' seconds in advance.'
    );
  END IF;
  
  -- Validate content length
  IF LENGTH(TRIM(p_content)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message content cannot be empty');
  END IF;
  
  IF LENGTH(p_content) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message content must be less than 1000 characters');
  END IF;
  
  -- Update the message
  UPDATE scheduled_messages 
  SET 
    content = p_content,
    send_at = p_send_at,
    message_type = p_message_type,
    target_all_guests = COALESCE(p_target_all_guests, target_all_guests),
    target_guest_ids = COALESCE(p_target_guest_ids, target_guest_ids),
    target_guest_tags = COALESCE(p_target_guest_tags, target_guest_tags),
    send_via_sms = COALESCE(p_send_via_sms, send_via_sms),
    send_via_push = COALESCE(p_send_via_push, send_via_push),
    updated_at = NOW(),
    version = version + 1,
    modified_at = NOW(),
    modification_count = modification_count + 1
  WHERE id = p_message_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Scheduled message updated successfully');
END;
$$;

-- Create trigger to update version info on any update
CREATE OR REPLACE FUNCTION update_scheduled_message_version()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS scheduled_message_version_trigger ON scheduled_messages;
CREATE TRIGGER scheduled_message_version_trigger
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION update_scheduled_message_version();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_scheduled_message TO authenticated;
