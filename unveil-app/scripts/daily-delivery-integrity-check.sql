-- Daily Message Delivery Integrity Check
-- Purpose: Monitor for new inconsistent user_id values in message_deliveries
-- Usage: Run daily via cron or monitoring system
-- Alert: If inconsistency_percentage > 1.0%, investigate immediately

-- =====================================================
-- MAIN INTEGRITY CHECK
-- =====================================================

SELECT 
  'DAILY_INTEGRITY_CHECK' as check_name,
  CURRENT_DATE as check_date,
  CURRENT_TIMESTAMP as check_timestamp,
  COUNT(*) as total_deliveries,
  COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) as inconsistent_deliveries,
  COUNT(CASE WHEN d.user_id IS NOT NULL AND g.user_id IS NOT NULL AND d.user_id = g.user_id THEN 1 END) as consistent_deliveries,
  COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NULL THEN 1 END) as both_null_deliveries,
  ROUND(
    100.0 * COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 
    2
  ) as inconsistency_percentage,
  CASE 
    WHEN COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) = 0 THEN '✅ HEALTHY'
    WHEN COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) <= 2 THEN '⚠️ MINOR_ISSUES'
    ELSE '🚨 NEEDS_ATTENTION'
  END as health_status
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id;

-- =====================================================
-- RECENT INCONSISTENCIES (Last 24 hours)
-- =====================================================

SELECT 
  'RECENT_INCONSISTENCIES' as report_type,
  d.id as delivery_id,
  g.guest_name,
  g.user_id as guest_user_id,
  d.user_id as delivery_user_id,
  g.event_id,
  e.title as event_title,
  d.created_at as delivery_created,
  g.updated_at as guest_updated,
  CASE 
    WHEN d.created_at > g.updated_at THEN '❌ DELIVERY_AFTER_GUEST_UPDATE'
    WHEN d.created_at < g.updated_at THEN '⚠️ GUEST_UPDATED_AFTER_DELIVERY'
    ELSE '❓ SAME_TIME'
  END as timing_analysis
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
JOIN events e ON e.id = g.event_id
WHERE d.created_at >= NOW() - INTERVAL '24 hours'
  AND g.user_id IS NOT NULL 
  AND d.user_id IS NULL
ORDER BY d.created_at DESC;

-- =====================================================
-- TRIGGER EFFECTIVENESS CHECK
-- =====================================================

-- Check if auto-link triggers are working
SELECT 
  'TRIGGER_EFFECTIVENESS' as check_type,
  COUNT(CASE WHEN outcome = 'linked' THEN 1 END) as successful_links,
  COUNT(CASE WHEN outcome = 'no_match' THEN 1 END) as no_matches,
  COUNT(CASE WHEN outcome = 'ambiguous' THEN 1 END) as ambiguous_cases,
  COUNT(CASE WHEN outcome = 'skipped' THEN 1 END) as skipped_cases,
  COUNT(*) as total_attempts,
  ROUND(100.0 * COUNT(CASE WHEN outcome = 'linked' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate_percentage
FROM user_link_audit 
WHERE table_name IN ('message_deliveries', 'message_deliveries_backfill')
  AND created_at >= NOW() - INTERVAL '24 hours';

-- =====================================================
-- BACKFILL ACTIVITY (Last 24 hours)
-- =====================================================

SELECT 
  'BACKFILL_ACTIVITY' as report_type,
  COUNT(*) as backfill_operations,
  COUNT(DISTINCT matched_guest_id) as unique_guests_backfilled,
  MIN(created_at) as earliest_backfill,
  MAX(created_at) as latest_backfill
FROM user_link_audit 
WHERE table_name = 'message_deliveries_backfill'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- =====================================================
-- ALERT CONDITIONS
-- =====================================================

-- Generate alert if inconsistency rate is too high
DO $$
DECLARE
  inconsistency_rate NUMERIC;
  inconsistent_count INTEGER;
BEGIN
  SELECT 
    ROUND(100.0 * COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2),
    COUNT(CASE WHEN d.user_id IS NULL AND g.user_id IS NOT NULL THEN 1 END)
  INTO inconsistency_rate, inconsistent_count
  FROM message_deliveries d
  JOIN event_guests g ON g.id = d.guest_id;
  
  IF inconsistency_rate > 1.0 THEN
    RAISE WARNING '🚨 HIGH DELIVERY INCONSISTENCY RATE: %.2f%% (%s deliveries) - INVESTIGATE IMMEDIATELY', 
      inconsistency_rate, inconsistent_count;
  ELSIF inconsistent_count > 0 THEN
    RAISE NOTICE '⚠️  Minor delivery inconsistencies detected: %s deliveries (%.2f%%) - Monitor closely', 
      inconsistent_count, inconsistency_rate;
  ELSE
    RAISE NOTICE '✅ All delivery records have consistent user_id values';
  END IF;
END $$;
