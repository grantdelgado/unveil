-- Fix return type mismatch in get_scheduled_messages_for_processing function
-- The function was missing the new columns added for the modify flow feature

DROP FUNCTION IF EXISTS get_scheduled_messages_for_processing(INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_scheduled_messages_for_processing(
  p_limit INTEGER DEFAULT 100,
  p_current_time TIMESTAMPTZ DEFAULT NOW()
) 
RETURNS TABLE(
  id UUID,
  event_id UUID,
  sender_user_id UUID,
  subject VARCHAR,
  content TEXT,
  message_type message_type_enum,
  send_at TIMESTAMPTZ,
  target_all_guests BOOLEAN,
  target_sub_event_ids UUID[],
  target_guest_tags TEXT[],
  target_guest_ids UUID[],
  send_via_sms BOOLEAN,
  send_via_push BOOLEAN,
  status VARCHAR,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER,
  success_count INTEGER,
  failure_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  scheduled_tz TEXT,
  scheduled_local TEXT,
  idempotency_key TEXT,
  recipient_snapshot JSONB,
  version INTEGER,           -- Added missing column from modify flow
  modified_at TIMESTAMPTZ,   -- Added missing column from modify flow
  modification_count INTEGER, -- Added missing column from modify flow
  event_sms_tag TEXT,
  event_title TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    sm.id,
    sm.event_id,
    sm.sender_user_id,
    sm.subject,
    sm.content,
    sm.message_type,
    sm.send_at,
    sm.target_all_guests,
    sm.target_sub_event_ids,
    sm.target_guest_tags,
    sm.target_guest_ids,
    sm.send_via_sms,
    sm.send_via_push,
    sm.status,
    sm.sent_at,
    sm.recipient_count,
    sm.success_count,
    sm.failure_count,
    sm.created_at,
    sm.updated_at,
    sm.scheduled_tz,
    sm.scheduled_local,
    sm.idempotency_key,
    sm.recipient_snapshot,
    sm.version,
    sm.modified_at,
    sm.modification_count,
    e.sms_tag as event_sms_tag,
    e.title as event_title
  FROM scheduled_messages sm
  INNER JOIN events e ON e.id = sm.event_id
  WHERE sm.status = 'scheduled'
    AND sm.send_at <= p_current_time
  ORDER BY sm.send_at ASC
  LIMIT p_limit
  FOR UPDATE OF sm SKIP LOCKED;
$$;
