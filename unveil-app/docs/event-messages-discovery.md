# Event Messages — End-to-End Discovery

**Date:** January 29, 2025  
**Purpose:** Single-source-of-truth explanation of Event Messages module flow, visibility, and troubleshooting  
**Status:** ✅ DISCOVERY COMPLETE

## Executive Summary

The Event Messages module uses a **three-table architecture** with **dual read paths** for host and guest access:

1. **Messages** are created in `messages` table (immediate send) or `scheduled_messages` table (future send)
2. **Message deliveries** are tracked in `message_deliveries` table with recipient-specific records
3. **Guests read via RPC** (`get_guest_event_messages`) that enforces strict user-based access
4. **Hosts read directly** from `messages` table via RLS policies that check event ownership

---

## Data Flow Diagram

```mermaid
HOST COMPOSE/SEND FLOW:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ MessageComposer │ -> │ /api/messages/   │ -> │ messages        │
│ (Host UI)       │    │ send/route.ts    │    │ table           │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                |                        |
                                v                        v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ SMS/Push        │ <- │ sendBulkSMS()    │ <- │ message_        │
│ Delivery        │    │ (Twilio)         │    │ deliveries      │
└─────────────────┘    └──────────────────┘    └─────────────────┘

SCHEDULED MESSAGE FLOW:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ MessageComposer │ -> │ createScheduled  │ -> │ scheduled_      │
│ (Schedule Mode) │    │ Message()        │    │ messages        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                |                        |
                                v                        v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Vercel Cron     │ -> │ /api/messages/   │ -> │ messages +      │
│ (every minute)  │    │ process-scheduled│    │ deliveries      │
└─────────────────┘    └──────────────────┘    └─────────────────┘

GUEST READ FLOW:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ GuestMessaging  │ -> │ get_guest_event_ │ -> │ message_        │
│ UI Component    │    │ messages() RPC   │    │ deliveries      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        |
                                                        v
                                                ┌─────────────────┐
                                                │ JOIN messages   │
                                                │ + users         │
                                                └─────────────────┘

HOST READ FLOW:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ RecentMessages  │ -> │ useMessages()    │ -> │ messages        │
│ Host Component  │    │ hook             │    │ table (RLS)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## Exact Read Queries

### Guest Message Feed (Primary Path)

**Hook:** `useGuestMessagesRPC`  
**Method:** RPC Function Call

```typescript
// Initial Load Query
const { data, error } = await supabase.rpc('get_guest_event_messages', {
  p_event_id: eventId,
  p_limit: 20,
  p_before: null,
});
```

**Equivalent SQL (executed by RPC):**

```sql
-- RPC: get_guest_event_messages()
-- Security: SECURITY DEFINER with user verification
WITH user_messages AS (
  -- Messages delivered to this user
  SELECT DISTINCT
    m.id as message_id,
    m.content,
    m.created_at,
    md.sms_status as delivery_status,
    COALESCE(u.full_name, 'Host') as sender_name,
    COALESCE(u.avatar_url, NULL) as sender_avatar_url,
    m.message_type::text,
    false as is_own_message
  FROM public.message_deliveries md
  JOIN public.messages m ON m.id = md.message_id
  LEFT JOIN public.users u ON u.id = m.sender_user_id
  WHERE md.user_id = current_user_id
    AND m.event_id = p_event_id
    AND (p_before IS NULL OR m.created_at < p_before)

  UNION ALL

  -- User's own messages (replies)
  SELECT DISTINCT
    m.id as message_id,
    m.content,
    m.created_at,
    'sent'::text as delivery_status,
    COALESCE(u.full_name, guest_record.guest_name, 'You') as sender_name,
    COALESCE(u.avatar_url, NULL) as sender_avatar_url,
    m.message_type::text,
    true as is_own_message
  FROM public.messages m
  LEFT JOIN public.users u ON u.id = m.sender_user_id
  WHERE m.sender_user_id = current_user_id
    AND m.event_id = p_event_id
    AND (p_before IS NULL OR m.created_at < p_before)
)
SELECT * FROM user_messages
ORDER BY created_at DESC
LIMIT p_limit;
```

### Host Message Feed (Secondary Path)

**Hook:** `useMessages`  
**Method:** Direct table query with RLS

```typescript
// Host Messages Query
const { data: messagesData, error } = await supabase
  .from('messages')
  .select('*')
  .eq('event_id', eventId)
  .order('created_at', { ascending: true });
```

**Equivalent SQL:**

```sql
SELECT * FROM messages
WHERE event_id = $1
  AND (
    -- RLS Policy: messages_select_optimized
    public.can_access_event(event_id) = true
  )
ORDER BY created_at ASC;
```

---

## RLS Summary

### Core Security Functions

1. **`is_event_host(event_id)`** - Returns true if `auth.uid()` matches `events.host_user_id`
2. **`is_event_guest(event_id)`** - Returns true if `auth.uid()` exists in `event_guests.user_id` for event
3. **`can_access_event(event_id)`** - Returns `is_event_host() OR is_event_guest()`

### Active RLS Policies

| Table                  | Policy Name                              | Access Type   | Logic                                    |
| ---------------------- | ---------------------------------------- | ------------- | ---------------------------------------- |
| **messages**           | `messages_select_optimized`              | SELECT        | `can_access_event(event_id)`             |
| **messages**           | `messages_insert_update_host_only`       | INSERT/UPDATE | `is_event_host(event_id)`                |
| **message_deliveries** | `message_deliveries_select_optimized`    | SELECT        | `user_id = auth.uid()` OR host via event |
| **message_deliveries** | `message_deliveries_modify_host_only`    | ALL           | Host only via event ownership            |
| **scheduled_messages** | `scheduled_messages_host_only_optimized` | ALL           | `is_event_host(event_id)`                |

### Phone-Based Fallback Access

**Legacy Policy (Deprecated):**

```sql
-- In message_deliveries RLS
EXISTS (
  SELECT 1 FROM public.event_guests eg
  WHERE eg.id = message_deliveries.guest_id
    AND eg.phone = (auth.jwt() ->> 'phone')
    AND (auth.jwt() ->> 'phone') IS NOT NULL
)
```

**Note:** Phone fallback is present but **not actively used** by guest UI, which relies on `user_id`-based access only.

---

## Visibility Matrix

| User Type                      | Can See Messages?          | Access Method                 | Reason                                         |
| ------------------------------ | -------------------------- | ----------------------------- | ---------------------------------------------- |
| **Event Host**                 | ✅ All messages            | Direct `messages` table query | `is_event_host()` returns true                 |
| **Linked Guest**               | ✅ Delivered messages only | RPC + `message_deliveries`    | `user_id` match in deliveries                  |
| **Unlinked Guest**             | ❌ No access               | N/A                           | No `user_id` in `event_guests` table           |
| **Guest with phone-only auth** | ❌ No access               | N/A                           | RPC requires `user_id` match in `event_guests` |
| **Removed Guest**              | ❌ No access               | N/A                           | RPC checks `removed_at IS NOT NULL`            |
| **Non-member**                 | ❌ No access               | N/A                           | Not in `event_guests` table                    |

---

## Edge Cases & Detection

### Top 10 Visibility Issues

| #   | Edge Case                                  | Detection Query                                                                                                                              | 1-Line Fix Check                                |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | **Guest has `user_id` but no deliveries**  | `SELECT * FROM event_guests eg WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM message_deliveries md WHERE md.user_id = eg.user_id)` | Check if messages were sent before guest linked |
| 2   | **Deliveries exist but `user_id` is NULL** | `SELECT * FROM message_deliveries WHERE user_id IS NULL AND guest_id IS NOT NULL`                                                            | Guest not linked when message sent              |
| 3   | **Phone mismatch**                         | `SELECT * FROM event_guests eg JOIN users u ON u.id = eg.user_id WHERE eg.phone != u.phone`                                                  | User changed phone after guest creation         |
| 4   | **Guest removed from event**               | `SELECT * FROM event_guests WHERE removed_at IS NOT NULL`                                                                                    | RPC blocks access with specific error           |
| 5   | **JWT phone is NULL**                      | Check `auth.jwt() ->> 'phone'` in logs                                                                                                       | Phone-first auth not working                    |
| 6   | **Message without deliveries**             | `SELECT * FROM messages m WHERE NOT EXISTS (SELECT 1 FROM message_deliveries md WHERE md.message_id = m.id)`                                 | Send process failed after message creation      |
| 7   | **Future scheduled message visible**       | `SELECT * FROM scheduled_messages WHERE send_at > NOW()`                                                                                     | Client incorrectly showing scheduled            |
| 8   | **Wrong event ID in query**                | Check `eventId` parameter in client logs                                                                                                     | Client routing issue                            |
| 9   | **RLS function returns false**             | `SELECT can_access_event('event-id')` with user context                                                                                      | Permission boundary issue                       |
| 10  | **Realtime subscription stale**            | Check subscription status in client                                                                                                          | WebSocket connection dropped                    |

### Client-Side Filters That Can Hide Messages

1. **Event ID mismatch** - `eventDeliveries.filter(d => d.message?.event_id === eventId)`
2. **Message type filtering** - Transform logic excludes certain types
3. **Pagination limits** - `INITIAL_WINDOW_SIZE` (20) and `OLDER_MESSAGES_BATCH_SIZE` (15)
4. **Date cursor filtering** - `p_before` parameter excludes newer messages
5. **Status filtering** - Only `sms_status` shown, other delivery statuses ignored

---

## Production Snapshot (David Banner's Wedding)

**Event ID:** `41191573-7726-4b98-a7c9-a27d139af93a`  
**Analysis Date:** January 29, 2025

### Message Counts

| Metric                 | Count | Notes                         |
| ---------------------- | ----- | ----------------------------- |
| **Total Messages**     | 9     | All from host (David Banner)  |
| **Total Deliveries**   | 19    | 2-3 deliveries per message    |
| **Scheduled Messages** | 1     | 1 pending/completed scheduled |
| **Unique Recipients**  | 6     | Mix of linked/unlinked guests |

### Delivery Distribution

| Guest              | User Status | Deliveries Received | RSVP Status |
| ------------------ | ----------- | ------------------- | ----------- |
| David Banner       | ✅ Linked   | 6                   | attending   |
| Lori Delgado       | ✅ Linked   | 8                   | pending     |
| Providence I       | ✅ Linked   | 3                   | pending     |
| Garrett Delgado    | ✅ Linked   | 1                   | pending     |
| Kendra Delgado     | ❌ Unlinked | 1                   | pending     |
| Lori Delgado (2nd) | ✅ Linked   | 0                   | pending     |

### Edge Cases Found

- **1 delivery with NULL user_id** - Kendra Delgado (unlinked guest)
- **0 phone mismatches** - All linked users have consistent phone numbers
- **0 orphaned messages** - All messages have corresponding deliveries
- **1 duplicate guest name** - Two "Lori Delgado" entries with different phones

---

## Validation Queries

**Test Host Access:**

```sql
-- Should return messages if user is host
SELECT COUNT(*) FROM messages
WHERE event_id = '41191573-7726-4b98-a7c9-a27d139af93a';
```

**Test Guest Access (RPC):**

```sql
-- Should return delivered messages for authenticated guest
SELECT * FROM get_guest_event_messages(
  '41191573-7726-4b98-a7c9-a27d139af93a'::uuid,
  50,
  NULL
);
```

**Test Access Denial:**

```sql
-- Should return empty for non-member
SELECT can_access_event('41191573-7726-4b98-a7c9-a27d139af93a'::uuid);
```

---

## Troubleshooting Checklist

When a user reports "I can't see messages":

1. **Verify event membership** - Check `event_guests` table for user
2. **Check user linking** - Ensure `event_guests.user_id` is populated
3. **Validate deliveries** - Look for `message_deliveries` with their `user_id`
4. **Test RPC access** - Call `get_guest_event_messages()` directly
5. **Check removal status** - Verify `removed_at IS NULL`
6. **Inspect JWT claims** - Ensure `auth.uid()` matches expected user
7. **Review client filters** - Check event ID and pagination parameters
8. **Test RLS functions** - Call `can_access_event()` and `is_event_guest()`

---

## Key Insights

1. **Dual Architecture** - Guests use RPC (secure), hosts use direct queries (RLS)
2. **User ID Dependency** - Guest access **requires** linked user account
3. **Delivery-Centric** - Guest visibility based on `message_deliveries`, not `messages`
4. **Phone Fallback Unused** - Despite RLS support, client doesn't use phone-based access
5. **Host Privilege** - Hosts see all messages via event ownership, bypass delivery tracking

This document serves as the definitive reference for understanding message visibility in the Unveil Event Messages system.
