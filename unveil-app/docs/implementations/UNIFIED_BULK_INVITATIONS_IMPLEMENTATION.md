# Unified Bulk Invitations Implementation

**Date**: January 30, 2025  
**Status**: ✅ **COMPLETE**  
**Intent**: Replace bulk "Send Invitations (N)" composer routing with direct bulk-invite action using single-invite pipeline

## 🎯 Implementation Summary

Successfully unified bulk and single invitation flows to use identical templates, validation, delivery paths, and tracking mechanisms. The bulk flow now opens a confirmation modal instead of routing to the message composer.

## 📋 Changes Made

### A. UI: Confirmation Modal Replaces Composer Routing

**File**: `components/features/host-dashboard/GuestManagement.tsx`

**Before**:
```tsx
const handleSendInvitations = useCallback(() => {
  // Route to composer with not_invited guests preselected
  const searchParams = new URLSearchParams({
    preset: 'not_invited',
  });
  router.push(`/host/events/${eventId}/messages?${searchParams.toString()}`);
}, [eventId, router]);
```

**After**:
```tsx
const handleSendInvitations = useCallback(() => {
  setShowBulkInviteModal(true);
}, []);
```

**New Component**: `components/features/host-dashboard/ConfirmBulkInviteModal.tsx`

- **Title**: "Send Invitations"
- **Body**: "You're about to invite {eligibleCount} guests by SMS."
- **Footnote**: "Guests without a valid phone or who opted out are skipped."
- **Buttons**: Cancel / Send Invitations
- **Results Display**: Shows sent/skipped/errors with expandable error details

### B. Eligibility & Count (Server-True)

**File**: `supabase/migrations/20250130000100_bulk_invite_eligibility.sql`

**New RPC**: `get_invitable_guest_ids(p_event_id uuid)`

```sql
SELECT eg.id
FROM event_guests eg
WHERE eg.event_id = p_event_id
  AND eg.removed_at IS NULL
  AND eg.role <> 'host'
  AND eg.invited_at IS NULL
  AND COALESCE(eg.sms_opt_out, false) = false
  AND eg.phone IS NOT NULL
  AND eg.phone ~ '^\+[1-9]\d{1,14}$';
```

**Updated RPC**: `get_event_guest_counts(p_event_id uuid)`

- Now uses identical validation criteria as single invite
- Badge count N matches actual sendable guests
- Excludes hosts, invalid phones, opted-out guests

### C. Shared Core Logic

**File**: `lib/services/inviteCore.ts`

**Function**: `sendGuestInviteCore({ eventId, guestId })`

- **Validation**: Same eligibility checks as single invite
- **Template**: Uses `createInvitationMessage()` with identical parameters
- **SMS Delivery**: Uses same `sendSMS()` function with `messageType: 'welcome'`
- **Tracking**: Always calls `update_guest_invitation_tracking_strict`
- **Error Handling**: Consistent error messages and logging

### D. Bulk API Endpoint

**File**: `app/api/guests/invite-bulk/route.ts`

**Endpoint**: `POST /api/guests/invite-bulk`

**Input**:
```typescript
{
  eventId: string;
  guestIds?: string[]; // Optional - if omitted, fetches all eligible
}
```

**Behavior**:
- **Auth**: Must be event host (`is_event_host(eventId)`)
- **Eligibility**: Uses `get_invitable_guest_ids()` if no IDs provided
- **Concurrency**: Pool of 8 with Promise queue and 100ms delays
- **Deduplication**: Removes duplicate guest IDs
- **Results**: Aggregates sent/skipped/errors with first 20 error details

**Output**:
```typescript
{
  success: boolean;
  data: {
    sent: number;
    skipped: number;
    errors: Array<{ guestId: string; reason: string }>;
  };
}
```

### E. Single Invite Refactor

**File**: `app/api/guests/invite-single/route.ts`

**Before**: 120+ lines of duplicate logic
**After**: Uses shared `sendGuestInviteCore()` function

- **Validation**: Host authorization via `is_event_host()` RPC
- **Processing**: Delegates to shared core logic
- **Results**: Same response format, identical behavior

### F. Client Service

**File**: `lib/services/bulkInvite.ts`

**Functions**:
- `sendBulkInvitations(request)`: Client-side bulk invite service
- `getEligibleGuestCount(eventId)`: Fetches count using RPC

## 🔄 Flow Comparison

| Aspect | **Before (Composer)** | **After (Unified)** |
|--------|----------------------|-------------------|
| **UI Entry** | Button → Navigation to messages page | Button → Confirmation modal |
| **Template** | User-editable generic announcement | Fixed optimized invitation template |
| **Validation** | Inaccurate RPC count (missing phone/opt-out) | Exact same validation as single invite |
| **API Path** | `/api/messages/send` (batch processing) | `/api/guests/invite-bulk` (reuses single core) |
| **Tracking** | Unclear invitation tracking updates | Always updates invitation timestamps |
| **Idempotency** | None (creates duplicate messages) | Natural (invited_at IS NULL prevents re-sends) |
| **Error Handling** | Batch failure reporting | Per-guest error details with aggregation |
| **SMS Template** | Long multi-line with event details | Short single-segment optimized |
| **Concurrency** | Uncontrolled batch | Controlled pool of 8 with delays |

## 🛡️ Guardrails & Idempotency

### Natural Idempotency
- **Eligibility Requirement**: `invited_at IS NULL`
- **Re-click Protection**: Second click finds 0 eligible guests
- **No Duplicate Messages**: Unlike composer flow, no duplicate message records

### Rate Limiting
- **Concurrency Pool**: Maximum 8 simultaneous invites
- **Batch Delays**: 100ms between batches to avoid overwhelming system
- **Same SMS Limits**: Inherits all existing Twilio rate limits

### Error Boundaries
- **Individual Failures**: One guest failure doesn't stop others
- **Partial Success**: Returns counts for sent/skipped/errors
- **Detailed Errors**: First 20 errors with reasons (no PII)

## 📊 Telemetry (Counts Only)

**Server Logs**:
```typescript
{
  event: 'bulk_invite_completed',
  event_id: eventId,
  total_requested: number,
  sent: number,
  skipped: number,
  errors: number, // count only
}
```

**Client Logs**:
- Bulk invite start/completion
- Error aggregation (no PII)
- Performance metrics (timing, batch sizes)

## ✅ Acceptance Criteria Met

- ✅ **No Composer Routing**: Bulk invitations use confirmation modal
- ✅ **Identical Templates**: Both flows use `createInvitationMessage()`
- ✅ **Same SMS Pipeline**: Both use `sendSMS()` with `messageType: 'welcome'`
- ✅ **Accurate Counts**: Badge N matches actual eligible guests
- ✅ **Invitation Tracking**: Always updates `invited_at`, `last_invited_at`, `invite_attempts`
- ✅ **Idempotency**: Natural protection via eligibility requirements
- ✅ **Error Handling**: Clear per-guest error reporting
- ✅ **PII Safety**: Logs contain counts only, no phone numbers or names
- ✅ **Twilio Consistency**: No changes to delivery semantics

## 🧪 Testing

### Unit Tests
**File**: `__tests__/api/bulk-invite.test.ts`

- API parameter validation
- Eligibility criteria consistency
- Error aggregation logic
- Telemetry data structure
- Concurrency control

### Integration Tests (Recommended)
1. **Template Consistency**: Compare SMS content between single and bulk
2. **DB State Parity**: Verify identical tracking updates
3. **Error Scenarios**: Invalid phones, opted-out guests, hosts
4. **Concurrency**: Large guest lists (50+ guests)
5. **Idempotency**: Double-click protection

### E2E Test Scenarios
1. **7 Eligible Guests**: Tap → Confirm → All sent successfully
2. **Mixed Eligibility**: Some invalid phones/opted-out → Proper skips
3. **Double-Click**: Rapid clicks → Second shows 0 eligible
4. **Error Recovery**: Network failures → Partial success reporting

## 🚀 Deployment Notes

### Database Migration
- ✅ Applied: `20250130000100_bulk_invite_eligibility.sql`
- ✅ New RPC: `get_invitable_guest_ids()`
- ✅ Updated RPC: `get_event_guest_counts()` with accurate validation

### Backward Compatibility
- ✅ Single invite API unchanged (internal refactor only)
- ✅ Existing message composer still works for other use cases
- ✅ All existing RLS policies and permissions preserved

### Performance Impact
- ✅ **Improved**: No navigation overhead for bulk invites
- ✅ **Controlled**: Concurrency limits prevent system overload
- ✅ **Efficient**: Shared core logic reduces code duplication

## 📈 Expected Improvements

1. **User Experience**: Faster bulk invites with immediate feedback
2. **Consistency**: Identical templates and behavior across flows
3. **Accuracy**: Badge counts match actual sendable guests
4. **Reliability**: Better error handling and partial success reporting
5. **Maintainability**: Single source of truth for invitation logic

---

**Next Steps**: Monitor bulk invitation usage patterns and error rates to validate the unified approach effectiveness.
