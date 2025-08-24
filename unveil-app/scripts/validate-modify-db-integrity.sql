-- Database Integrity Validation for Scheduled Message Modify Feature
-- Run this after implementing the modify feature to ensure proper behavior

-- Test 1: Verify the new columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'scheduled_messages' 
  AND column_name IN ('version', 'modified_at', 'modification_count')
ORDER BY column_name;

-- Test 2: Verify the RPC function exists and is accessible
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_name = 'update_scheduled_message';

-- Test 3: Check existing scheduled messages have default values
SELECT 
  id,
  status,
  version,
  modification_count,
  modified_at IS NULL as modified_at_is_null,
  created_at
FROM scheduled_messages 
WHERE status = 'scheduled'
LIMIT 5;

-- Test 4: Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'scheduled_message_version_trigger';

-- Expected Results:
-- Test 1: Should show 3 rows with version (integer), modified_at (timestamptz), modification_count (integer)
-- Test 2: Should show 1 row with routine_name = 'update_scheduled_message', security_type = 'DEFINER'
-- Test 3: Should show existing messages with version=1, modification_count=0, modified_at_is_null=true
-- Test 4: Should show 1 row with trigger_name = 'scheduled_message_version_trigger', action_timing = 'BEFORE'

-- Test Query for Manual Validation (replace with actual scheduled_id):
-- SELECT id, status, send_at, version, modified_at, modification_count
-- FROM scheduled_messages
-- WHERE id = 'your-scheduled-message-id-here';

-- After a Modify operation, the same query should show:
-- - Same id (no new row created)
-- - status = 'scheduled' (unchanged)
-- - send_at = new time (if changed)
-- - version = 2 (incremented)
-- - modified_at = recent timestamp
-- - modification_count = 1 (incremented)

-- Verify no new messages/deliveries created by Modify:
-- SELECT count(*) FROM messages WHERE scheduled_id = 'your-scheduled-message-id-here';          -- expect 0 until send time
-- SELECT count(*) FROM message_deliveries md
-- JOIN messages m on m.id = md.message_id
-- WHERE m.scheduled_id = 'your-scheduled-message-id-here';                                      -- expect 0
