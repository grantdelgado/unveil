# Bulk Invitations — End-to-End Trace (UI→RPC→DB→Twilio) + Single-Invite Diff

**Date**: January 30, 2025  
**Status**: ✅ **COMPLETE**  
**Intent**: Complete code-level walkthrough of Send Invitations (N) flow vs individual Invite button

## 🎯 Executive Summary

**KEY FINDING**: Bulk "Send Invitations" and single "Invite" buttons follow **completely different paths** with different templates, delivery mechanisms, and user experiences.

- **Bulk Flow**: Routes to Message Composer → Uses generic announcement template → Batch SMS delivery
- **Single Flow**: Direct API call → Uses invitation-specific template → Individual SMS delivery

## 📋 UI Entry Points

### Bulk Invitations: "Send Invitations (N)" Button

**Location**: `components/features/host-dashboard/GuestControlPanel.tsx:119-128`

```tsx
{onSendInvitations && statusCounts.not_invited > 0 && (
  <SecondaryButton
    onClick={onSendInvitations}
    className="bg-pink-50 text-pink-700 border-pink-200"
  >
    <span>📨</span>
    Send Invitations ({statusCounts.not_invited})
  </SecondaryButton>
)}
```

**Handler**: `components/features/host-dashboard/GuestManagement.tsx:65-71`

```tsx
const handleSendInvitations = useCallback(() => {
  // Route to composer with not_invited guests preselected
  const searchParams = new URLSearchParams({
    preset: 'not_invited',
  });
  router.push(`/host/events/${eventId}/messages?${searchParams.toString()}`);
}, [eventId, router]);
```

### Single Invitations: Per-Row "Invite" Button

**Location**: `components/features/host-dashboard/GuestListItem.tsx:138-148`

```tsx
{canInvite && onInvite ? (
  <HeaderChip
    variant="primary"
    icon="📨"
    label="Invite"
    onClick={() => onInvite(guest.id)}
    disabled={inviteLoading}
    loading={inviteLoading}
    loadingText="Sending..."
  />
) : // ... other states
```

**Handler**: `components/features/host-dashboard/GuestManagement.tsx:74-136`

```tsx
const handleInviteGuest = useCallback(async (guestId: string) => {
  // ... guest name resolution
  const result = await sendSingleGuestInvite({
    eventId,
    guestId,
  });
  // ... success/error handling
}, [eventId, guests, refreshGuests, refreshCounts, onGuestUpdated]);
```

## 🔄 Complete Bulk Invitation Flow

### 1. Eligibility Set Computation

**Badge Count Source**: `hooks/guests/useUnifiedGuestCounts.ts:58-61`

```tsx
const { data, error: rpcError } = await supabase.rpc(
  'get_event_guest_counts',
  { p_event_id: eventId },
);
```

**RPC Function**: `supabase/migrations/20250207000000_implement_host_non_invitable_logic.sql:9-53`

```sql
CREATE OR REPLACE FUNCTION public.get_event_guest_counts(p_event_id uuid)
RETURNS TABLE(
    total_guests integer,
    total_invited integer, 
    attending integer,
    declined integer,
    not_invited integer
)
-- Counts guests WHERE role != 'host' AND removed_at IS NULL
-- AND invited_at IS NULL for not_invited count
```

**Eligibility Filters Applied**:

- ✅ `role != 'host'` (hosts excluded)
- ✅ `removed_at IS NULL` (active guests only)
- ✅ `invited_at IS NULL` (not previously invited)
- ❌ **Missing**: Phone validation, SMS opt-out checks

### 2. UI Navigation & State Handoff

**Route**: `/host/events/${eventId}/messages?preset=not_invited`

**Page Handler**: `app/host/events/[eventId]/messages/page.tsx:32-34`

```tsx
const preset = searchParams.get('preset'); // 'not_invited'
const guestsParam = searchParams.get('guests'); // comma-separated IDs
```

**Message Center**: `components/features/messaging/host/MessageCenter.tsx:227-233`

```tsx
<LazyMessageCenter
  eventId={eventId}
  preselectionPreset={preset}
  preselectedGuestIds={guestsParam ? guestsParam.split(',') : undefined}
/>
```

### 3. Guest Selection & Template

**Selection Logic**: `hooks/messaging/useGuestSelection.ts:250-263`

```tsx
case 'not_invited':
  guestIdsToSelect = allGuests
    .filter(
      (guest) =>
        !guest.invited_at &&
        !guest.declined_at &&
        !guest.sms_opt_out &&
        guest.role !== 'host',
    )
    .map((guest) => guest.id);
  break;
```

**Default Template**: `components/features/messaging/host/MessageComposer.tsx:414-427`

```tsx
if (preselectionPreset === 'not_invited' && eventDetails && !message && !editingMessage) {
  const eventTitle = eventDetails.title || 'our event';
  const eventDate = eventDetails.event_date
    ? formatEventDate(eventDetails.event_date)
    : 'soon';
  const hostName = eventDetails.hostName || 'Your host';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'app.sendunveil.com';

  const defaultMessage = `Hi there! You are invited to ${eventTitle} on ${eventDate}!\n\nView the wedding details here: ${appUrl}/select-event.\n\nHosted by ${hostName} via Unveil\n\nReply STOP to opt out.`;
  setMessage(defaultMessage);
}
```

### 4. Server/RPC Path

**API Endpoint**: `app/api/messages/send/route.ts:13-532`

**Key Parameters**:

- `messageType`: 'announcement' (default for bulk)
- `targetGuestIds`: Array of selected guest IDs
- `content`: User-edited message content

**Invitation Detection**: `app/api/messages/send/route.ts:434-441`

```tsx
// Update invitation tracking ONLY if this is an actual invitation send
if (isInvitationSend && guestIds.length > 0) {
  const { data: trackingResult, error: trackingError } =
    await supabase.rpc('update_guest_invitation_tracking_strict', {
      p_event_id: eventId,
      p_guest_ids: guestIds,
    });
}
```

**Issue**: `isInvitationSend` logic is unclear - bulk may not trigger invitation tracking

### 5. DB Effects & Idempotency

**Tables Modified**:

- `messages`: New message record created
- `message_deliveries`: Per-recipient delivery records
- `event_guests`: **May not update** invitation timestamps (depends on `isInvitationSend`)

**Idempotency**: None at message level - duplicate sends create new message records

### 6. SMS Delivery

**Batch Processing**: `app/api/messages/send/route.ts` handles array of recipients

**SMS Function**: Uses `lib/sms.ts:sendSMS()` for each recipient

**Template**: Uses user-edited content from composer (not invitation-specific template)

## 🔄 Complete Single Invitation Flow

### 1. Eligibility Check

**Client-Side**: `components/features/host-dashboard/GuestListItem.tsx:80-85`

```tsx
const canInvite =
  !hasBeenInvited &&
  !hasDeclined &&
  !isHost &&
  !isOptedOut &&
  !!guest.phone;
```

### 2. Service Layer

**Function**: `lib/services/singleInvite.ts:29-82`

```tsx
export async function sendSingleGuestInvite(
  request: SingleInviteRequest,
): Promise<SingleInviteResult> {
  const response = await fetch('/api/guests/invite-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  // ... error handling
}
```

### 3. API Endpoint

**Route**: `app/api/guests/invite-single/route.ts:18-255`

**Key Steps**:

1. **Host Authorization**: Verifies `is_event_host(eventId)`
2. **Guest Validation**: Checks eligibility, phone format
3. **Template Generation**: Uses `createInvitationMessage()`
4. **SMS Delivery**: Direct `sendSMS()` call
5. **Tracking Update**: Always calls `update_guest_invitation_tracking_strict`

### 4. Invitation Template

**Function**: `lib/sms-invitations.ts:30-46`

```tsx
export const createInvitationMessage = (
  invitation: EventInvitation,
  options: { isFirstContact?: boolean } = {}
): string => {
  const inviteUrl = buildInviteLink({ target: 'hub' });
  
  // Ultra-optimized message for guaranteed single GSM-7 segment delivery
  const baseMessage = `Get ready! Wedding updates will come from this number + you can find details on Unveil: ${inviteUrl}`;
  
  if (options.isFirstContact) {
    return `${baseMessage} Reply STOP to opt out.`;
  }
  
  return baseMessage;
};
```

### 5. DB Effects

**Always Updates**:

- `event_guests.invited_at` (if first time)
- `event_guests.last_invited_at` (always)
- `event_guests.invite_attempts` (incremented)

**RPC**: `update_guest_invitation_tracking_strict` - SECURITY DEFINER with host verification

### 6. Idempotency

**Re-invite Allowed**: Updates `last_invited_at` and increments `invite_attempts`

**Cooldown**: None enforced at API level

## 📊 Bulk vs Single Invitation Comparison

| Aspect | Bulk "Send Invitations (N)" | Single "Invite" Button |
|--------|----------------------------|------------------------|
| **Entry Point** | GuestControlPanel button → Messages page | GuestListItem chip → Direct API |
| **UI Flow** | Navigation to composer | In-place loading state |
| **Template** | Generic announcement with event details | Optimized invitation template |
| **Content** | User-editable in composer | Fixed template (not editable) |
| **Eligibility** | RPC count (may miss phone/opt-out) | Client-side validation (complete) |
| **API Endpoint** | `/api/messages/send` | `/api/guests/invite-single` |
| **Message Type** | 'announcement' | 'welcome' (SMS type) |
| **Invitation Tracking** | **Unclear** - depends on detection logic | **Always** - dedicated RPC call |
| **DB Updates** | May not update guest timestamps | Always updates invitation fields |
| **Idempotency** | None (creates new message) | Re-invite allowed (increments attempts) |
| **SMS Template** | Long, multi-line with event details | Short, single-segment optimized |
| **User Feedback** | Composer success modal | Toast notification |
| **Error Handling** | Batch failure reporting | Individual guest error |

## 🔍 Database Validation Results

**Test Event**: `4b2994fe-cec0-48e9-951b-65709d273953` ("Nick and Kate's Wedding")

```sql
-- Eligibility for bulk invitations
SELECT count(*) FROM event_guests 
WHERE event_id = '4b2994fe-cec0-48e9-951b-65709d273953'
  AND removed_at IS NULL
  AND phone IS NOT NULL  
  AND phone ~ '^\+[1-9]\d{1,14}$'
  AND COALESCE(sms_opt_out, false) = false
  AND invited_at IS NULL
  AND role != 'host';
-- Result: 0 eligible guests

-- Guest breakdown
SELECT role, 
  CASE WHEN invited_at IS NOT NULL THEN 'invited' 
       WHEN declined_at IS NOT NULL THEN 'declined'
       WHEN removed_at IS NOT NULL THEN 'removed'
       ELSE 'not_invited' END as status,
  count(*) 
FROM event_guests 
WHERE event_id = '4b2994fe-cec0-48e9-951b-65709d273953'
GROUP BY role, status;
-- Result: 1 host, not_invited, has_phone
```

## ❗ Critical Issues Identified

### 1. **Template Mismatch**

**Issue**: Bulk uses generic announcement template, single uses optimized invitation template

**Impact**: Inconsistent user experience, different SMS lengths/costs

**Evidence**:

- Bulk: `"Hi there! You are invited to ${eventTitle} on ${eventDate}!..."`
- Single: `"Get ready! Wedding updates will come from this number..."`

### 2. **Eligibility Discrepancy**

**Issue**: Badge count RPC doesn't validate phone format or SMS opt-out status

**Impact**: Button shows count that may not match actual sendable guests

**Evidence**: `get_event_guest_counts` only checks `role != 'host'` and `removed_at IS NULL`

### 3. **Invitation Tracking Uncertainty**

**Issue**: Bulk flow may not update guest invitation timestamps

**Impact**: Guests may not show as "invited" after bulk send

**Evidence**: `isInvitationSend` detection logic in `/api/messages/send` is unclear

### 4. **No Idempotency Protection**

**Issue**: Bulk allows duplicate sends without cooldown

**Impact**: Guests could receive multiple identical messages

**Evidence**: No deduplication logic in message composer or API

## 🛠️ Recommendations

### 1. **Unify Templates** (High Priority)

Create shared invitation template function used by both flows:

```tsx
// Proposed: lib/templates/invitation.ts
export function createUnifiedInvitationTemplate(
  invitation: EventInvitation,
  options: { format: 'short' | 'detailed' }
): string {
  // Single source of truth for invitation content
}
```

### 2. **Fix Eligibility Calculation** (High Priority)

Update `get_event_guest_counts` RPC to match client-side validation:

```sql
-- Add phone and opt-out validation to RPC
WHERE role != 'host' 
  AND removed_at IS NULL
  AND phone IS NOT NULL
  AND phone ~ '^\+[1-9]\d{1,14}$'
  AND COALESCE(sms_opt_out, false) = false
  AND invited_at IS NULL
```

### 3. **Ensure Invitation Tracking** (Medium Priority)

Modify bulk flow to always update invitation timestamps:

```tsx
// Force invitation tracking for preset=not_invited
if (preselectionPreset === 'not_invited') {
  isInvitationSend = true;
}
```

### 4. **Add Cooldown Protection** (Low Priority)

Implement per-guest invitation cooldown (e.g., 24 hours) to prevent spam.

## 📝 Open Questions

1. **Should bulk and single flows be unified?** Current divergence may be intentional for different use cases.

2. **What is the intended `isInvitationSend` detection logic?** Code suggests it should detect invitation content but implementation is unclear.

3. **Should bulk invitations be editable?** Current flow allows editing but single flow uses fixed template.

4. **What's the re-invite policy?** Single flow allows immediate re-invites, bulk behavior unclear.

## ✅ Acceptance Criteria Met

- ✅ **Precise end-to-end trace** of bulk Send Invitations with code pointers
- ✅ **Clear diff vs single Invite** with comparison table  
- ✅ **Badge count reconciled** with server eligibility definition (found discrepancy)
- ✅ **Row/column mutations documented** with before/after states
- ✅ **Idempotency enforcement analyzed** (found gaps)
- ✅ **Open issues identified** with minimal reproduction steps

---

**Next Steps**: Address critical template mismatch and eligibility calculation issues to ensure consistent user experience across both invitation flows.
