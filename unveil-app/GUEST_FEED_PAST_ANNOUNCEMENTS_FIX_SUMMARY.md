# Guest Feed — Past Announcements Missing Fix Summary

**Date:** January 30, 2025  
**Issue:** Guest `f89034d6…` in event `24caa3a8…` only sees newest announcement, not earlier ones  
**Root Cause:** RPC v2 deduplication logic bug  
**Status:** ✅ **FIXED**

## Root Cause Analysis

### The Problem
- **Expected:** Guest should see all 4 announcements in descending order
- **Actual:** Guest only saw the newest announcement (the one with a delivery record)
- **Impact:** 3 older announcements were missing from guest feed

### The Bug
The deduplication logic in `get_guest_event_messages_v2` branches B and C was using incorrect field for comparison:

```sql
-- ❌ WRONG (before fix)
AND NOT EXISTS (
    SELECT 1 FROM public.message_deliveries md2 
    WHERE md2.message_id = m.id 
    AND md2.user_id = current_user_id  -- Wrong field!
)

-- ✅ CORRECT (after fix)
AND NOT EXISTS (
    SELECT 1 FROM public.message_deliveries md2 
    WHERE md2.message_id = m.id 
    AND md2.guest_id = guest_record.id  -- Correct field!
)
```

### Why This Caused the Issue
1. **Latest announcement:** Had a delivery record with matching `user_id`, so was correctly excluded from branch B and included via branch A (deliveries)
2. **Older announcements:** Had no delivery records, so should appear via branch B (messages), but the wrong deduplication logic was checking `user_id` instead of `guest_id`
3. Since the guest's `user_id` existed in the system, the deduplication was incorrectly excluding messages that had no deliveries for this specific guest

## Diagnostic Results

### Before Fix
```sql
-- Query 1: Ground truth (4 announcements exist)
[4 announcements from 2025-08-25 to 2025-08-20]

-- Query 2: Deliveries (only 1 delivery exists)
[1 delivery for latest announcement only]

-- Query 3: Expected RPC result (should show all 4)
[Only 1 announcement visible - BUG CONFIRMED]
```

### After Fix
```sql
-- Query 3: Fixed RPC result (now shows all 4)
[
  {latest announcement from delivery branch},
  {3 older announcements from message branch}
]
```

## Fix Implementation

### Migration Applied
- **File:** `supabase/migrations/20250130000001_fix_guest_messages_v2_deduplication.sql`
- **Change:** Updated deduplication logic in branches B and C to use `guest_id` instead of `user_id`
- **Impact:** No breaking changes, pure bug fix

### Code Changes
1. **Branch B (Announcements):** Fixed deduplication to use `md2.guest_id = guest_record.id`
2. **Branch C (Channels):** Fixed deduplication to use `md3.guest_id = guest_record.id`
3. **Branches A & D:** No changes (were already correct)

## Verification

### ✅ Positive Tests
- Guest now sees all 4 announcements in correct order (newest first)
- Latest announcement comes from delivery branch (source: 'delivery')
- 3 older announcements come from message branch (source: 'message')
- Catchup logic works correctly (`is_catchup: false` since `joined_at` is null)

### ✅ Negative Tests
- No leakage: Other events' announcements remain invisible
- RLS policies: Event scoping still enforced
- Deduplication: No duplicate messages in feed

### ✅ Behavior Preserved
- SMS/Twilio: No changes to delivery system
- Backfill: No automatic delivery creation
- RLS: All security policies intact
- Client: No UI changes required

## Acceptance Criteria Met

- [x] Guest sees all announcements from event in descending order
- [x] Correct catch-up badges (based on `joined_at` vs `created_at`)
- [x] No leakage of other events' announcements
- [x] No deliveries backfilled
- [x] Twilio/SMS system untouched
- [x] RLS policies verified and intact

## Impact Assessment

- **Scope:** Affects only guest message feeds using RPC v2
- **Risk:** Low - pure bug fix with no behavioral changes
- **Rollback:** Can revert migration if needed
- **Performance:** No impact - same query structure
- **Security:** No changes to access controls

## Next Steps

1. **Monitor:** Watch for any client-side issues after deployment
2. **Verify:** Test with other guests/events to ensure fix is universal
3. **Document:** Update RPC v2 documentation with correct deduplication logic
4. **Clean up:** Remove temporary migration file after verification period

---

**Summary:** The guest feed issue was caused by incorrect deduplication logic in the RPC v2 function. The fix ensures all announcements are visible while maintaining proper security boundaries and avoiding duplicate deliveries.
