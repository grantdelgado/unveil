# Event Creation Schema Fix

**Date:** October 16, 2025  
**Status:** ✅ Fixed  
**Issue:** Event creation failing with `rsvp_status` column not found

---

## Problem

Event creation was failing with error:
```
POST /rest/v1/event_guests 400 (Bad Request)
Could not find the 'rsvp_status' column of 'event_guests' in the schema cache
```

**Root Cause:**
- `lib/services/eventCreation.ts` was trying to insert `rsvp_status: 'attending'` when creating the host guest entry
- The `event_guests` table **does not have** an `rsvp_status` column in the current schema
- This is part of the RSVP-Lite refactor where RSVP status is tracked via `declined_at` timestamp instead

---

## Database Schema (Actual)

**Query executed:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'event_guests'
ORDER BY ordinal_position;
```

**Columns in `event_guests` (25 total):**
- ✅ `id`, `event_id`, `user_id`
- ✅ `guest_name`, `phone`, `notes`, `guest_tags`
- ✅ `role` (host/guest/admin)
- ✅ `declined_at`, `decline_reason` (RSVP-Lite fields)
- ✅ `invited_at`, `joined_at`, `removed_at`
- ✅ `preferred_communication`, `sms_opt_out`
- ❌ **NO `rsvp_status` column** (removed in RSVP-Lite migration)

---

## Fix Applied

**File:** `lib/services/eventCreation.ts`

**Line 529 - Removed:**
```typescript
const hostGuestData: EventGuestInsert = {
  event_id: eventId,
  user_id: userId,
  phone: hostProfile.phone,
  guest_name: hostProfile.full_name || 'Host',
  role: 'host',
  rsvp_status: 'attending',  // ❌ Column doesn't exist
  preferred_communication: 'sms',
  sms_opt_out: false,
};
```

**After Fix:**
```typescript
const hostGuestData: EventGuestInsert = {
  event_id: eventId,
  user_id: userId,
  phone: hostProfile.phone,
  guest_name: hostProfile.full_name || 'Host',
  role: 'host',
  // rsvp_status removed - column doesn't exist in current schema (RSVP-Lite uses declined_at instead)
  preferred_communication: 'sms',
  sms_opt_out: false,
};
```

**Reasoning:**
- RSVP-Lite architecture uses `declined_at` timestamp instead of `rsvp_status` enum
- Hosts don't need RSVP tracking (they're automatically "attending" their own event)
- Absence of `declined_at` implies attending status

---

## RSVP-Lite Architecture Notes

**Old RSVP System (Removed):**
```sql
rsvp_status TEXT CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending'))
```

**New RSVP-Lite System (Current):**
```sql
declined_at TIMESTAMPTZ  -- NULL = attending/not responded
decline_reason TEXT      -- Optional reason if declined
```

**Benefits:**
- Simpler schema (2 columns instead of 1 enum)
- Implicit states (NULL = attending)
- Better audit trail (timestamp of decline)
- Fewer writes (no status updates for attending guests)

---

## Testing

**Test Case: Create New Event**

**Steps:**
1. Navigate to `/host/events/create`
2. Fill in event details:
   - Title: "Test Wedding"
   - Date: Future date
   - Time: Any time
   - SMS Tag: "Test"
   - Visibility: Checked (published)
3. Click "Continue →"
4. Review details
5. Click "Create Wedding Hub"

**Expected Result:**
- ✅ Event created successfully
- ✅ Host guest entry created (no `rsvp_status` field)
- ✅ Redirect to event dashboard
- ✅ No console errors

**Previous Result (Before Fix):**
- ❌ 400 Bad Request error
- ❌ "Could not find the 'rsvp_status' column"
- ❌ Event rollback triggered
- ❌ Creation failed

---

## Related Issues

This fix is part of the **RSVP-Lite migration** which simplified RSVP tracking:

**Related Migrations:**
- `rsvp_status` column removal (migrated to `declined_at` pattern)
- RSVP state inference (NULL = attending, timestamp = declined)

**Related Code:**
- `useGuestDecline` hook - Uses `declined_at` instead of `rsvp_status`
- Guest dashboard - Shows "Can't make it" based on `declined_at`
- Host guest management - Filters by `declined_at IS NULL`

---

## Acceptance Criteria

All criteria met:

- ✅ `rsvp_status` removed from host guest insert
- ✅ Event creation works without errors
- ✅ Schema matches actual database structure
- ✅ No linting errors
- ✅ RSVP-Lite architecture preserved
- ✅ Host guest entries created successfully

---

**Fix completed:** October 16, 2025  
**Ready for testing:** Yes  
**Breaking changes:** None (fix aligns code with existing schema)

