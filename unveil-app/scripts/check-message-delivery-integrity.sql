-- Message Delivery Data Integrity Check
-- Purpose: Monitor for inconsistent user_id values in message_deliveries
-- Usage: Run daily to catch data consistency issues early

-- =====================================================
-- INTEGRITY CHECK: message_deliveries.user_id consistency
-- =====================================================

SELECT 
  'MESSAGE_DELIVERY_INTEGRITY_CHECK' as check_name,
  CURRENT_TIMESTAMP as check_timestamp,
  COUNT(*) as total_deliveries,
  COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) as inconsistent_deliveries,
  COUNT(CASE WHEN d.user_id IS NOT NULL AND g.user_id IS NOT NULL AND d.user_id = g.user_id THEN 1 END) as consistent_deliveries,
  COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NULL THEN 1 END) as both_null_deliveries,
  ROUND(
    100.0 * COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 
    2
  ) as inconsistency_percentage
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id;

-- =====================================================
-- DETAILED INCONSISTENCY REPORT
-- =====================================================

-- Show specific cases where user_id is inconsistent
SELECT 
  'INCONSISTENT_DELIVERIES_DETAIL' as report_type,
  g.guest_name,
  g.user_id as guest_user_id,
  g.event_id,
  e.title as event_title,
  COUNT(d.id) as total_deliveries,
  COUNT(CASE WHEN d.user_id IS NULL THEN 1 END) as null_user_id_deliveries,
  COUNT(CASE WHEN d.user_id = g.user_id THEN 1 END) as matching_deliveries,
  MAX(d.created_at) as latest_delivery_date
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
JOIN events e ON e.id = g.event_id
WHERE g.user_id IS NOT NULL  -- Guest has a user_id
GROUP BY g.guest_name, g.user_id, g.event_id, e.title
HAVING COUNT(CASE WHEN d.user_id IS NULL THEN 1 END) > 0  -- But has deliveries with NULL user_id
ORDER BY null_user_id_deliveries DESC, latest_delivery_date DESC;

-- =====================================================
-- RECENT INCONSISTENCIES (Last 24 hours)
-- =====================================================

SELECT 
  'RECENT_INCONSISTENCIES' as report_type,
  g.guest_name,
  g.user_id as guest_user_id,
  d.user_id as delivery_user_id,
  g.event_id,
  e.title as event_title,
  d.created_at as delivery_created,
  m.content as message_content
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
JOIN events e ON e.id = g.event_id
JOIN messages m ON m.id = d.message_id
WHERE d.created_at >= NOW() - INTERVAL '24 hours'
  AND g.user_id IS NOT NULL 
  AND d.user_id IS NULL
ORDER BY d.created_at DESC;

-- =====================================================
-- ALERT CONDITIONS
-- =====================================================

-- This query should be used to trigger alerts if inconsistency rate > 5%
DO $$
DECLARE
  inconsistency_rate NUMERIC;
BEGIN
  SELECT 
    ROUND(100.0 * COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2)
  INTO inconsistency_rate
  FROM message_deliveries d
  JOIN event_guests g ON g.id = d.guest_id;
  
  IF inconsistency_rate > 5.0 THEN
    RAISE WARNING 'HIGH INCONSISTENCY RATE: %.2f%% of message deliveries have inconsistent user_id values', inconsistency_rate;
  END IF;
END $$;
