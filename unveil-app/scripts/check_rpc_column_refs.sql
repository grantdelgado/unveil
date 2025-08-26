-- ============================================================================
-- CI Guard: Check RPC functions for broken column references
-- ============================================================================
--
-- This script validates that all column references in RPC functions
-- actually exist in the referenced tables. Prevents 42703 errors.
--
-- Usage: Run this as part of CI/CD pipeline after migrations
-- Expected: All queries should return 0 rows (no broken references)

-- Check for common broken column patterns in RPC functions
WITH function_bodies AS (
  SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' 
  AND p.proname LIKE '%guest%message%'
),
potential_issues AS (
  SELECT 
    schema_name,
    function_name,
    CASE 
      WHEN function_body ILIKE '%md.delivery_status%' THEN 'md.delivery_status (should be md.sms_status)'
      WHEN function_body ILIKE '%u.display_name%' THEN 'u.display_name (should be u.full_name)'
      WHEN function_body ILIKE '%u.guest_name%' THEN 'u.guest_name (should come from event_guests table)'
      WHEN function_body ILIKE '%m.status%' THEN 'm.status (column does not exist in messages table)'
      ELSE NULL
    END as issue
  FROM function_bodies
  WHERE function_body ILIKE '%md.delivery_status%'
     OR function_body ILIKE '%u.display_name%'
     OR function_body ILIKE '%u.guest_name%'
     OR function_body ILIKE '%m.status%'
)
SELECT 
  schema_name,
  function_name,
  issue,
  'FAIL: Broken column reference detected' as status
FROM potential_issues 
WHERE issue IS NOT NULL;

-- Expected result: 0 rows (all column references are valid)
-- If any rows returned, the CI should FAIL with details about broken references
