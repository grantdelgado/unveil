# RSVP Semantics Audit — "Invited by default" + Opt-Out Model

**📅 Date**: September 30, 2025  
**🎯 Goal**: Verify current RSVP semantics align with intended "invited by default" + opt-out model  
**📊 Status**: ✅ **AUDIT COMPLETE** - Current system **MATCHES** target model with minor gaps  

---

## 🔍 **Executive Summary**

The Unveil app **already implements** the "invited by default" + opt-out model effectively. The current system uses `declined_at` as the primary RSVP indicator, with SMS opt-out (`sms_opt_out`) providing notification suppression. Event visibility is preserved for declined guests, and messaging audience filtering correctly excludes opted-out users.

**✅ Go/No-Go Decision: GO** - No major changes needed. Minor UI consistency improvements recommended.

---

## 📊 **Current Database Model**

### Event Guests Table Structure
```sql
-- Primary RSVP fields
declined_at              timestamptz  -- NULL = attending, NOT NULL = declined
decline_reason           text         -- Optional reason for declining
sms_opt_out             boolean      -- Notification suppression (default: false)

-- Legacy/transitional fields  
rsvp_status             text         -- Default: 'pending', being phased out
invited_at              timestamptz  -- Invitation timestamp
last_invited_at         timestamptz  -- Last invitation sent
```

### Key Findings
- **✅ Correct Model**: `declined_at IS NULL` = attending, `declined_at IS NOT NULL` = declined
- **✅ Opt-out Mechanism**: `sms_opt_out` boolean for notification suppression
- **✅ Atomic Operations**: `guest_decline_event()` RPC sets both `declined_at` and `sms_opt_out = TRUE`
- **⚠️ Legacy Field**: `rsvp_status` still exists but being phased out

---

## 🔐 **RLS Security Posture**

### Policies Analysis
```sql
-- ✅ SECURE: Proper access control
event_guests_select_v2: (is_event_host(event_id) OR (user_id = auth.uid()))
event_guests_update_v2: (is_event_host(event_id) OR (user_id = auth.uid()))
event_guests_insert_v2: (is_event_host(event_id) OR (user_id = auth.uid()))
```

### Security Definer Functions
- **✅ SECURE**: `guest_decline_event()` has `SET search_path = 'public', 'pg_temp'`
- **✅ SECURE**: `resolve_message_recipients()` has proper search path
- **✅ SECURE**: All audience functions enforce host/guest access controls

---

## 🎯 **Guest UI Semantics**

### Current Behavior
- **✅ Opt-out UX**: "Can't make it?" button shows single-action decline
- **✅ Event Visibility**: Declined guests still see event in `/select-event`
- **✅ Decline Banner**: Shows after declining with rejoin option
- **✅ State Management**: Uses `declined_at` field correctly

### CTA Resolution Logic
```typescript
// From GuestEventHomePage - Line 117
const resolveGuestCTA = useMemo(() => {
  if (!event) return null;
  
  // Uses declined_at to determine state
  const hasDeclined = !!(guestInfo as { declined_at?: string | null })?.declined_at;
  
  // Shows "Can't make it?" if not declined
  // Shows rejoin option if declined
});
```

**✅ MATCHES TARGET**: Single opt-out action, event remains visible

---

## 🏠 **Host UI Semantics**

### Guest Status Summary (GuestStatusSummary.tsx)
```typescript
// ✅ RSVP-Lite configuration - Lines 92-120
const statusConfig = [
  { key: 'all', label: 'All' },
  { key: 'attending', label: 'Attending' }, // declined_at IS NULL
  { key: 'declined', label: 'Declined' },   // declined_at IS NOT NULL
];
```

### Unified Guest Counts (useUnifiedGuestCounts.ts)
```typescript
// ✅ Uses get_event_guest_counts RPC
attending: result.attending || 0,    // declined_at IS NULL
declined: result.declined || 0,      // declined_at IS NOT NULL
```

**✅ MATCHES TARGET**: Host UI shows attending/declined based on `declined_at`

---

## 📨 **Messaging Audience Filtering**

### Announcement/Channel Audience Logic
```sql
-- From current_announcement_audience_count() RPC - Lines 40-50
SELECT DISTINCT eg.phone
FROM event_guests eg
WHERE eg.event_id = v_event_id
  AND eg.removed_at IS NULL           -- ✅ Exclude removed guests
  AND eg.invited_at IS NOT NULL       -- ✅ Only invited guests
  AND COALESCE(eg.sms_opt_out, false) = false  -- ✅ Exclude opted-out
  AND eg.phone IS NOT NULL
  AND eg.phone != ''
```

### Recipient Resolution (resolve_message_recipients)
```sql
-- From resolve_message_recipients() RPC - Lines 141-142
AND (include_declined = TRUE OR eg.declined_at IS NULL)  -- ✅ Exclude declined by default
AND COALESCE(eg.sms_opt_out, false) = false             -- ✅ Exclude opted-out
```

**✅ MATCHES TARGET**: Messaging excludes declined guests unless explicitly included

---

## 🧪 **Test Coverage Analysis**

### Existing Tests
- **✅ Messaging Client Tests**: Validate recipient filtering (`__tests__/lib/services/messaging-client.test.ts`)
- **✅ Unified Counts Tests**: Verify guest count calculations (`__tests__/integration/unified-guest-counts.test.ts`)
- **✅ RLS Security Tests**: Ensure proper access control (`__tests__/e2e/rls-security.spec.ts`)
- **✅ Guest Email Optional**: Confirm phone-only workflows (`__tests__/validation/guest-email-optional.test.ts`)

### Test Scenarios Covered
- Explicit guest selection for messaging
- RSVP status updates
- Guest isolation between events
- Audience count calculations
- SMS opt-out filtering

---

## 🔍 **Gap Analysis**

| Area | Current Behavior | Target Behavior | Gap | Risk | Status |
|------|------------------|-----------------|-----|------|--------|
| **Database Model** | Uses `declined_at` + `sms_opt_out` | ✅ Same | None | Low | ✅ **MATCHES** |
| **Guest UI** | "Can't make it?" opt-out button | ✅ Same | None | Low | ✅ **MATCHES** |
| **Host UI** | Attending/Declined filters | ✅ Same | None | Low | ✅ **MATCHES** |
| **Event Visibility** | Declined guests see event | ✅ Same | None | Low | ✅ **MATCHES** |
| **Messaging Audience** | Excludes declined + opted-out | ✅ Same | None | Low | ✅ **MATCHES** |
| **Legacy Fields** | `rsvp_status` still exists | Remove eventually | Minor | Low | ⚠️ **CLEANUP** |

---

## 📋 **Evidence Links**

### Database Schema
- **Table Structure**: `event_guests` table with `declined_at`, `sms_opt_out` fields
- **RPC Functions**: `guest_decline_event()`, `resolve_message_recipients()`, `current_announcement_audience_count()`
- **Indexes**: Optimized for `declined_at` and messaging queries

### UI Components
- **Guest UI**: `app/guest/events/[eventId]/home/page.tsx` (Lines 104-114)
- **Decline Modal**: `components/features/guest/DeclineEventModal.tsx`
- **Host Status**: `components/features/host-dashboard/GuestStatusSummary.tsx` (Lines 92-120)
- **Message Composer**: `components/features/messaging/host/MessageComposer.tsx`

### Service Layer
- **Messaging Client**: `lib/services/messaging-client.ts` (Lines 21-101)
- **API Route**: `app/api/messages/send/route.ts` (Lines 290-532)
- **Audience Hooks**: `hooks/guests/useUnifiedGuestCounts.ts`

---

## 🎯 **Recommendations**

### ✅ **No Major Changes Needed**
The current system already implements the target "invited by default" + opt-out model correctly.

### 🔧 **Minor Improvements (Optional)**
1. **Legacy Cleanup**: Eventually remove `rsvp_status` field after full RSVP-Lite adoption
2. **UI Consistency**: Ensure all host dashboard components use unified counts
3. **Documentation**: Update any remaining references to old RSVP model

### 📊 **Monitoring**
- Track `declined_at` vs `rsvp_status` usage to confirm transition completion
- Monitor messaging delivery rates to ensure opt-out filtering works correctly
- Validate guest count consistency across dashboard components

---

## 🏁 **Conclusion**

**✅ AUDIT RESULT: SYSTEM MATCHES TARGET MODEL**

The Unveil app successfully implements the "invited by default" + opt-out model:

1. **✅ Database**: Uses `declined_at` for RSVP state, `sms_opt_out` for notifications
2. **✅ Guest UX**: Single "Can't make it?" action, event remains visible
3. **✅ Host UX**: Attending/Declined filters based on `declined_at`
4. **✅ Messaging**: Correctly excludes declined and opted-out guests
5. **✅ Security**: Proper RLS policies and SECURITY DEFINER functions

**No code or database changes required.** The system is production-ready and aligned with the intended RSVP semantics.
