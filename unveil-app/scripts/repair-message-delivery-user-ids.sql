-- Message Delivery User ID Repair Script
-- Purpose: Fix inconsistent user_id values in message_deliveries table
-- Usage: Run when integrity check identifies inconsistencies

-- =====================================================
-- SAFETY CHECK: Preview changes before applying
-- =====================================================

-- Preview what would be updated
SELECT 
  'REPAIR_PREVIEW' as action_type,
  d.id as delivery_id,
  d.user_id as current_delivery_user_id,
  g.user_id as target_user_id,
  g.guest_name,
  g.event_id,
  e.title as event_title,
  d.created_at as delivery_created
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
JOIN events e ON e.id = g.event_id
WHERE d.user_id IS NULL 
  AND g.user_id IS NOT NULL
ORDER BY d.created_at DESC;

-- =====================================================
-- REPAIR OPERATION (Uncomment to execute)
-- =====================================================

-- SAFETY: This update is reversible by setting user_id back to NULL
-- UPDATE message_deliveries 
-- SET user_id = g.user_id,
--     updated_at = NOW()
-- FROM event_guests g 
-- WHERE message_deliveries.guest_id = g.id 
--   AND message_deliveries.user_id IS NULL 
--   AND g.user_id IS NOT NULL;

-- =====================================================
-- VERIFICATION: Check repair results
-- =====================================================

-- Run this after repair to verify success
-- SELECT 
--   'REPAIR_VERIFICATION' as check_type,
--   COUNT(*) as total_deliveries,
--   COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) as remaining_inconsistencies,
--   COUNT(CASE WHEN d.user_id IS NOT NULL AND g.user_id IS NOT NULL AND d.user_id = g.user_id THEN 1 END) as consistent_deliveries
-- FROM message_deliveries d
-- JOIN event_guests g ON g.id = d.guest_id;
