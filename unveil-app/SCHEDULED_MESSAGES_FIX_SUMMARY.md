# Scheduled Messages — Recipient Count Fix & Reliability Improvements

## Overview

This PR fixes critical issues in the scheduled messaging system, ensuring accurate recipient counts, safe execution, and proper UI display. The changes are backwards-compatible and include comprehensive testing.

## Problems Fixed

### 1. ❌ Incorrect Recipient Counts (Critical Bug)

- **Issue**: `explicit_selection` filter type was not handled in `resolveMessageRecipients()`
- **Impact**: Scheduled messages showed 6 recipients when only 3 were selected
- **Root Cause**: Function fell through to RPC call with undefined parameters, returning all event recipients

### 2. ⚠️ Missing Server-Side Validation

- **Issue**: No validation of UTC timezone conversions during scheduling
- **Impact**: Potential for invalid scheduled times, especially during DST transitions

### 3. 📱 Poor UI Messaging

- **Issue**: UI showed "6 recipients" instead of "3 people"
- **Impact**: Confusing user experience, unclear what the count represented

## Changes Made

### A) Core Logic Fixes

#### 1. Fixed `resolveMessageRecipients()` in `lib/services/messaging-client.ts`

```typescript
// NEW: Handle explicit guest selection properly
if (filter.type === 'explicit_selection' && filter.selectedGuestIds) {
  if (filter.selectedGuestIds.length === 0) {
    throw new Error(
      'No recipients selected. Please select at least one guest to send the message to.',
    );
  }

  return {
    guestIds: filter.selectedGuestIds,
    recipientCount: filter.selectedGuestIds.length,
  };
}
```

#### 2. Added Server-Side UTC Validation

```typescript
// Verify UTC conversion is correct (within 60 second tolerance)
const timeDifference = Math.abs(expectedUTCTime - storedUTCTime);
if (timeDifference > 60000) {
  throw new Error(
    'Invalid scheduled time. Please check the date and time, especially during daylight saving transitions.',
  );
}
```

### B) Data Integrity

#### 3. Backfill Script for Existing Data

- **File**: `scripts/backfill-scheduled-message-recipient-counts.ts`
- **Action**: Fixed 1 scheduled message (recipient_count: 6 → 3)
- **Safety**: Idempotent, only updates `recipient_count` field
- **Result**: ✅ All scheduled messages now have correct counts

### C) UI Improvements

#### 4. Better Count Display

- **Before**: "6 recipients"
- **After**: "3 people" (singular: "1 person")
- **Files Updated**:
  - `components/features/messaging/host/RecentMessages.tsx`
  - `components/features/messaging/host/MessageComposer.tsx`

### D) Future-Proofing

#### 5. Optional Recipient Snapshot (Feature Flag)

- **Column**: `scheduled_messages.recipient_snapshot` (JSONB, nullable)
- **Purpose**: Store resolved recipients at schedule time for audit trail
- **Activation**: Set `NEXT_PUBLIC_ENABLE_RECIPIENT_SNAPSHOT=true`
- **Format**:
  ```json
  [
    {
      "guest_id": "uuid",
      "user_id": "uuid?",
      "phone": "+1234567890",
      "name": "Guest Name",
      "channel": "sms"
    }
  ]
  ```

### E) Comprehensive Testing

#### 6. Test Coverage Added

- **Unit Tests**: `__tests__/lib/recipient-count-fix.test.ts` (13 tests ✅)
- **Integration Tests**: Scheduled message creation flow
- **Backfill Tests**: Script validation and edge cases

## Verification Steps

### 1. Database State ✅

```sql
SELECT id, recipient_count, cardinality(target_guest_ids) as actual_count
FROM scheduled_messages
WHERE target_guest_ids IS NOT NULL;
-- Result: All counts now match (3 = 3)
```

### 2. Manual Testing ✅

- [x] Schedule message with 3 selected guests → shows "3 people"
- [x] Schedule message with 1 selected guest → shows "1 person"
- [x] Try to schedule with 0 selected → proper error message
- [x] Invalid timezone → proper error message
- [x] UI displays correct counts in Recent Messages

### 3. Automated Testing ✅

```bash
npm test -- __tests__/lib/recipient-count-fix.test.ts
# ✓ 13 tests passed
```

### 4. Linting ✅

```bash
npm run lint
# ✔ No ESLint warnings or errors
```

## Pipeline Flow (Confirmed Working)

```
MessageComposer (3 guests selected)
    ↓
resolveMessageRecipients()
    ↓ [FIXED: Now handles explicit_selection]
recipient_count = 3 ✅
    ↓
scheduled_messages table (recipient_count: 3)
    ↓
Worker: process-scheduled/route.ts
    ↓ [Uses target_guest_ids directly - already worked]
3 message_deliveries created
    ↓
SMS sent to 3 recipients ✅
```

## Rollback Plan

### Safe Rollback Options:

1. **Code Changes**: Standard git revert (backwards compatible)
2. **Database Column**: `recipient_snapshot` is nullable, can be ignored
3. **Backfill**: Idempotent script can be re-run if needed

### Emergency Rollback:

```sql
-- If needed, revert recipient counts (NOT RECOMMENDED)
UPDATE scheduled_messages
SET recipient_count = cardinality(target_guest_ids)
WHERE target_guest_ids IS NOT NULL
AND status IN ('scheduled', 'sending');
```

## Performance Impact

- **✅ Minimal**: Added logic only runs during scheduling (low frequency)
- **✅ Indexed**: New `recipient_snapshot` column has GIN index
- **✅ Optional**: Snapshot feature behind feature flag
- **✅ Efficient**: No changes to high-frequency worker processing

## Security Considerations

- **✅ RLS Preserved**: No changes to Row Level Security policies
- **✅ Validation Added**: Server-side timezone validation prevents invalid schedules
- **✅ Data Integrity**: Backfill only fixes counts, doesn't change audiences
- **✅ Audit Trail**: Optional snapshot provides better audit capabilities

## Monitoring

### Key Metrics to Watch:

1. **Scheduled Message Creation Success Rate** (should remain 100%)
2. **Worker Processing Success Rate** (should remain high)
3. **Recipient Count Accuracy** (manual spot checks)
4. **UTC Conversion Errors** (should be rare, logged when they occur)

### Alerts to Add:

- UTC validation failures (indicates timezone/DST issues)
- Scheduled messages with 0 recipients (should be blocked now)

## Acceptance Criteria ✅

- [x] Scheduling with explicit selection of N guests stores `recipient_count === N`
- [x] UI shows "N people" instead of "N recipients"
- [x] Backfill updated all mismatched pending rows (1 message fixed)
- [x] Worker sends to exactly the selected set
- [x] Server rejects invalid schedules (0 recipients, invalid times)
- [x] All tests pass, no lint/build errors
- [x] Changes are backwards-compatible and safe to deploy

## Next Steps

1. **Deploy**: Changes are ready for production
2. **Monitor**: Watch for any UTC validation errors in logs
3. **Feature Flag**: Optionally enable `NEXT_PUBLIC_ENABLE_RECIPIENT_SNAPSHOT=true` for audit trail
4. **Documentation**: Update any internal docs about recipient counting

---

**Summary**: This fix resolves a critical user-facing bug where scheduled message counts were incorrect, adds proper validation to prevent future issues, and improves the overall reliability of the scheduled messaging system. All changes are backwards-compatible and thoroughly tested.
