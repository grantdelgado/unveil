# Unified Messaging Recipients Implementation

## Discovery Summary

### Where Old Recipient Queries Came From

**Messaging Components:**
- `useGuestSelection`: Direct `event_guests` query (line 68-93) - **MISSING `removed_at IS NULL`**
- `useRecipientPreview`: Direct `event_guests` query with `users(*)` join (line 47-55) - **MISSING `removed_at IS NULL`**
- Send API validation: Direct `event_guests` query (line 79-83) - **MISSING `removed_at IS NULL`**

**Guest Management (Canonical):**
- Uses `get_event_guests_with_display_names` RPC 
- Includes: `WHERE eg.event_id = p_event_id AND eg.removed_at IS NULL`

### The Problem

Messaging components could show and target **removed guests** because they didn't exclude `removed_at IS NULL`, creating inconsistency with Guest Management and potential data integrity issues.

### Selection Key & Duplicates

**Selection Key:** `event_guests.id` ✅ (consistent across all components)

**Potential Duplicates:** The `users(*)` join in `useRecipientPreview` could create duplicates, but this is now avoided by using the RPC which uses `LEFT JOIN` properly.

## Implementation

### 1. Created Unified Messaging Recipients RPC

```sql
get_messaging_recipients(p_event_id UUID)
```

**Canonical Scope:** `event_guests WHERE event_id = $id AND removed_at IS NULL`

**Returns:** One row per `event_guests.id` with no duplicates:
- `event_guest_id`, `guest_name`, `phone`, `sms_opt_out`, `declined_at`, `role`
- `invited_at`, `guest_tags`, `guest_display_name`
- `user_full_name`, `user_phone`, `user_email`, `has_valid_phone`

### 2. Created Shared Hook

`useMessagingRecipients(eventId)` - wraps the RPC with loading states and error handling.

### 3. Updated Messaging Components

**`useGuestSelection`:**
- Now uses `useMessagingRecipients` instead of direct query
- Transforms data to `GuestWithDisplayName` format for compatibility
- Maintains existing selection logic and eligibility rules

**`useRecipientPreview`:**
- Now uses `useMessagingRecipients` instead of direct query with joins
- Eliminates potential duplicate issues from `users(*)` join
- Maintains existing filtering and preview logic

### 4. Enhanced Server-Side Validation

**Send API (`/api/messages/send`):**
- Added `removed_at IS NULL` check to all recipient validation queries
- Added specific error message for removed/stale guest IDs
- Enhanced validation for explicit selection, individual selection, and "all" filter

**Scheduled Message Processing:**
- Added `removed_at IS NULL` check to all recipient resolution queries
- Ensures scheduled messages cannot target removed guests

## Eligibility Rules (Unchanged from MVP)

✅ **Visible rows** = canonical scope (same as Guest Management "All")
✅ **Default selected** = rows where `declined_at IS NULL`  
✅ **Disabled** = `sms_opt_out = TRUE` (visible but cannot be selected)
✅ **Selection keyed by** `event_guests.id` only

## Server-Side Guardrails

✅ **Explicit Selection Validation**: Rejects any `recipientEventGuestIds` that don't exist in canonical scope
✅ **Legacy Filter Validation**: All filter types now include `removed_at IS NULL` check
✅ **Stale ID Detection**: Specific error message when attempting to target removed guests
✅ **Scheduled Message Protection**: Scheduled messages also use canonical scope

## Verification

✅ Messaging recipient count === Guest Management "All" count (both return 5 for test event)
✅ Soft-deleted guests excluded from messaging recipient list
✅ No duplicate recipients (one row per `event_guests.id`)
✅ Server-side validation rejects removed/stale guest IDs
✅ Default selection excludes declined guests
✅ Opted-out guests visible but not selectable

## Files Changed

- `supabase/migrations/[timestamp]_unified_messaging_recipients_rpc.sql` - RPC function
- `hooks/messaging/useMessagingRecipients.ts` - Shared hook
- `hooks/messaging/index.ts` - Export new hook
- `hooks/messaging/useGuestSelection.ts` - Use unified recipients
- `hooks/messaging/useRecipientPreview.ts` - Use unified recipients
- `app/api/messages/send/route.ts` - Enhanced server-side validation
- `app/api/messages/process-scheduled/route.ts` - Enhanced scheduled message validation
- `__tests__/integration/messaging-recipient-consistency.test.ts` - Test coverage

## Before/After Summary

**Before:**
- Messaging could show removed guests
- Different queries used by messaging vs Guest Management
- Potential for duplicate recipients from joins
- Server validation didn't check canonical scope

**After:**
- Messaging uses same canonical scope as Guest Management
- Single source of truth via shared RPC
- No duplicates (one row per event_guests.id)
- Server-side guardrails reject removed/stale IDs
- Consistent counts across all surfaces
