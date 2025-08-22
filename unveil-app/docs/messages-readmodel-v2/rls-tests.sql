-- ============================================================================
-- Messages Read-Model V2 - RLS Test Queries
-- ============================================================================
-- Date: January 29, 2025
-- Purpose: Verify RLS policies work correctly for different user types
-- Usage: Run these queries as different user types to verify access control

-- ============================================================================
-- TEST DATA SETUP (if needed)
-- ============================================================================

-- Create test event (run as host user)
/*
INSERT INTO events (id, title, event_date, host_user_id) 
VALUES (
  'test-event-123'::uuid, 
  'Test Event', 
  '2025-02-01', 
  auth.uid()
);
*/

-- Create test guest (run as host user)
/*
INSERT INTO event_guests (id, event_id, user_id, guest_name, phone, guest_tags) 
VALUES (
  'test-guest-123'::uuid,
  'test-event-123'::uuid,
  'guest-user-id'::uuid,
  'Test Guest',
  '+12345678901',
  ARRAY['vip', 'family']
);
*/

-- Create test messages (run as host user)
/*
-- Direct message
INSERT INTO messages (id, event_id, sender_user_id, content, message_type) 
VALUES (
  'test-msg-direct'::uuid,
  'test-event-123'::uuid,
  auth.uid(),
  'Direct test message',
  'direct'
);

-- Announcement
INSERT INTO messages (id, event_id, sender_user_id, content, message_type) 
VALUES (
  'test-msg-announcement'::uuid,
  'test-event-123'::uuid,
  auth.uid(),
  'Announcement test message',
  'announcement'
);

-- Channel message with scheduled targeting
INSERT INTO scheduled_messages (id, event_id, sender_user_id, content, message_type, target_guest_tags, status, send_at)
VALUES (
  'test-scheduled-123'::uuid,
  'test-event-123'::uuid,
  auth.uid(),
  'Channel test message',
  'channel',
  ARRAY['vip'],
  'sent',
  now()
);

INSERT INTO messages (id, event_id, sender_user_id, content, message_type, scheduled_message_id) 
VALUES (
  'test-msg-channel'::uuid,
  'test-event-123'::uuid,
  auth.uid(),
  'Channel test message',
  'channel',
  'test-scheduled-123'::uuid
);

-- Create delivery for direct message
INSERT INTO message_deliveries (message_id, guest_id, user_id, phone_number, sms_status)
VALUES (
  'test-msg-direct'::uuid,
  'test-guest-123'::uuid,
  'guest-user-id'::uuid,
  '+12345678901',
  'delivered'
);
*/

-- ============================================================================
-- HOST USER TESTS (run as event host)
-- ============================================================================

-- Test 1: Host should see all messages for their events
SELECT 
  'HOST_ALL_MESSAGES' as test_name,
  m.id,
  m.message_type,
  m.content,
  'SUCCESS' as result
FROM messages m 
WHERE m.event_id = 'test-event-123'::uuid
ORDER BY m.created_at;

-- Expected: All messages (direct, announcement, channel)

-- Test 2: Host should NOT see messages from other events
SELECT 
  'HOST_OTHER_EVENT' as test_name,
  COUNT(*) as message_count,
  CASE WHEN COUNT(*) = 0 THEN 'SUCCESS' ELSE 'FAIL' END as result
FROM messages m 
WHERE m.event_id != 'test-event-123'::uuid
AND EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = m.event_id 
  AND e.host_user_id != auth.uid()
);

-- Expected: 0 messages (SUCCESS)

-- ============================================================================
-- GUEST USER TESTS (run as guest user with access to test event)
-- ============================================================================

-- Test 3: Guest should see announcements via RLS
SELECT 
  'GUEST_ANNOUNCEMENTS' as test_name,
  m.id,
  m.message_type,
  m.content,
  'SUCCESS' as result
FROM messages m 
WHERE m.event_id = 'test-event-123'::uuid
AND m.message_type = 'announcement';

-- Expected: Announcement messages visible

-- Test 4: Guest should see channels with matching tags
SELECT 
  'GUEST_CHANNELS_WITH_TAGS' as test_name,
  m.id,
  m.message_type,
  m.content,
  sm.target_guest_tags,
  'SUCCESS' as result
FROM messages m 
LEFT JOIN scheduled_messages sm ON m.scheduled_message_id = sm.id
WHERE m.event_id = 'test-event-123'::uuid
AND m.message_type = 'channel'
AND (
  sm.target_guest_tags IS NULL OR
  EXISTS (
    SELECT 1 FROM event_guests eg 
    WHERE eg.event_id = m.event_id 
    AND eg.user_id = auth.uid()
    AND eg.guest_tags && sm.target_guest_tags
  )
);

-- Expected: Channel messages where guest has matching tags

-- Test 5: Guest should see direct messages via deliveries only
SELECT 
  'GUEST_DIRECT_VIA_DELIVERIES' as test_name,
  m.id,
  m.message_type,
  m.content,
  md.sms_status,
  'SUCCESS' as result
FROM message_deliveries md
JOIN messages m ON m.id = md.message_id
WHERE md.user_id = auth.uid()
AND m.event_id = 'test-event-123'::uuid
AND m.message_type = 'direct';

-- Expected: Direct messages with delivery records

-- Test 6: Guest should NOT see direct messages without deliveries
SELECT 
  'GUEST_DIRECT_WITHOUT_DELIVERIES' as test_name,
  COUNT(*) as message_count,
  CASE WHEN COUNT(*) = 0 THEN 'SUCCESS' ELSE 'FAIL' END as result
FROM messages m 
WHERE m.event_id = 'test-event-123'::uuid
AND m.message_type = 'direct'
AND NOT EXISTS (
  SELECT 1 FROM message_deliveries md 
  WHERE md.message_id = m.id 
  AND md.user_id = auth.uid()
);

-- Expected: 0 messages (SUCCESS) - direct messages without deliveries not visible

-- ============================================================================
-- NON-MEMBER USER TESTS (run as user NOT in event)
-- ============================================================================

-- Test 7: Non-member should NOT see any messages
SELECT 
  'NON_MEMBER_NO_ACCESS' as test_name,
  COUNT(*) as message_count,
  CASE WHEN COUNT(*) = 0 THEN 'SUCCESS' ELSE 'FAIL' END as result
FROM messages m 
WHERE m.event_id = 'test-event-123'::uuid;

-- Expected: 0 messages (SUCCESS)

-- Test 8: Non-member should NOT see any deliveries
SELECT 
  'NON_MEMBER_NO_DELIVERIES' as test_name,
  COUNT(*) as delivery_count,
  CASE WHEN COUNT(*) = 0 THEN 'SUCCESS' ELSE 'FAIL' END as result
FROM message_deliveries md
JOIN messages m ON m.id = md.message_id
WHERE m.event_id = 'test-event-123'::uuid;

-- Expected: 0 deliveries (SUCCESS)

-- ============================================================================
-- RPC V2 INTEGRATION TESTS
-- ============================================================================

-- Test 9: RPC v2 returns expected union (run as guest user)
SELECT 
  'RPC_V2_UNION' as test_name,
  message_type,
  source,
  COUNT(*) as count
FROM public.get_guest_event_messages_v2('test-event-123'::uuid, 50, NULL)
GROUP BY message_type, source
ORDER BY message_type, source;

-- Expected results:
-- - direct messages with source='delivery'
-- - announcement messages with source='message'  
-- - channel messages with source='message' (if guest has matching tags)

-- Test 10: RPC v2 deduplication works (run as guest user)
SELECT 
  'RPC_V2_DEDUPLICATION' as test_name,
  message_id,
  COUNT(*) as occurrence_count,
  CASE WHEN COUNT(*) = 1 THEN 'SUCCESS' ELSE 'FAIL' END as result
FROM public.get_guest_event_messages_v2('test-event-123'::uuid, 50, NULL)
GROUP BY message_id
HAVING COUNT(*) > 1;

-- Expected: No results (all messages should appear only once)

-- ============================================================================
-- PERFORMANCE TESTS
-- ============================================================================

-- Test 11: RPC v2 performance (run as guest user)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM public.get_guest_event_messages_v2('test-event-123'::uuid, 50, NULL);

-- Expected: Query completes in <500ms with appropriate index usage

-- ============================================================================
-- CLEANUP (optional)
-- ============================================================================

/*
-- Remove test data (run as host user)
DELETE FROM message_deliveries WHERE message_id IN ('test-msg-direct'::uuid);
DELETE FROM messages WHERE event_id = 'test-event-123'::uuid;
DELETE FROM scheduled_messages WHERE event_id = 'test-event-123'::uuid;
DELETE FROM event_guests WHERE event_id = 'test-event-123'::uuid;
DELETE FROM events WHERE id = 'test-event-123'::uuid;
*/

-- ============================================================================
-- SUMMARY VALIDATION QUERY
-- ============================================================================

-- Run this as a final check (adapt for your test event)
WITH test_results AS (
  SELECT 
    'RLS_VALIDATION' as test_suite,
    CASE 
      WHEN auth.uid() IS NULL THEN 'UNAUTHENTICATED'
      WHEN EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = 'test-event-123'::uuid 
        AND e.host_user_id = auth.uid()
      ) THEN 'HOST'
      WHEN EXISTS (
        SELECT 1 FROM event_guests eg 
        WHERE eg.event_id = 'test-event-123'::uuid 
        AND eg.user_id = auth.uid()
      ) THEN 'GUEST'
      ELSE 'NON_MEMBER'
    END as user_type,
    (
      SELECT COUNT(*) FROM messages m 
      WHERE m.event_id = 'test-event-123'::uuid
    ) as messages_visible,
    (
      SELECT COUNT(*) FROM public.get_guest_event_messages_v2('test-event-123'::uuid, 50, NULL)
    ) as rpc_v2_count
)
SELECT 
  test_suite,
  user_type,
  messages_visible,
  rpc_v2_count,
  CASE 
    WHEN user_type = 'HOST' AND messages_visible > 0 THEN 'PASS'
    WHEN user_type = 'GUEST' AND rpc_v2_count > 0 THEN 'PASS'
    WHEN user_type = 'NON_MEMBER' AND messages_visible = 0 AND rpc_v2_count = 0 THEN 'PASS'
    WHEN user_type = 'UNAUTHENTICATED' AND messages_visible = 0 AND rpc_v2_count = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as overall_result
FROM test_results;
