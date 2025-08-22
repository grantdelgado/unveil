# Messages Read-Model V2 — Implementation Plan

**Date:** January 29, 2025  
**Status:** ✅ DISCOVERY COMPLETE - Ready for Implementation  
**Approach:** Single-path atomic RPC swap with shadow verification

## Executive Summary

Migrate guest message feed to read **Announcements** and **Channels** directly from `messages` table while keeping **Direct** messages delivery-gated via `message_deliveries`. **Zero changes** to Twilio/SMS pipeline - notifications continue to be driven by delivery records at send time.

## Discovery Results ✅

### 1. Send Pipeline Analysis

**Twilio Integration Points (UNCHANGED):**

- **Core SMS Function:** `lib/sms.ts` → `sendSMS()` → Twilio API
- **Bulk SMS Function:** `lib/sms.ts` → `sendBulkSMS()` → `sendSMS()` → Twilio API
- **API Routes:** `/api/messages/send`, `/api/messages/process-scheduled`, `/api/sms/send-*`

**Complete Send Flow:**

```mermaid
graph TD
    A[Host Composer] --> B[/api/messages/send]
    B --> C[Create messages record]
    B --> D[resolveMessageRecipients]
    D --> E[Create message_deliveries]
    E --> F[sendBulkSMS]
    F --> G[sendSMS per recipient]
    G --> H[Twilio API]
    H --> I[SMS sent + webhook updates]

    J[Scheduled Messages] --> K[/api/messages/process-scheduled]
    K --> L[processDueScheduledMessages]
    L --> C

    style H fill:#f96,stroke:#333,stroke-width:2px
    style F fill:#f96,stroke:#333,stroke-width:2px
    style G fill:#f96,stroke:#333,stroke-width:2px
```

**Critical Finding:** SMS generation is **completely isolated** from read operations. All message types (direct, announcement, channel) create delivery records for notification tracking. **No changes needed to SMS pipeline.**

### 2. Message Type Enum ✅

**Confirmed `message_type_enum` values:**

- `direct` - Person-to-person messages (delivery-gated)
- `announcement` - Event-wide messages (will read from messages table)
- `channel` - Tag-based messages (will read from messages table)

### 3. Tag Data Structure ✅

**Current Implementation:**

- **Guest Tags:** `event_guests.guest_tags` (text[] array)
- **Message Targeting:** `scheduled_messages.target_guest_tags` (text[] array)
- **Helper Functions:** `guest_has_any_tags()`, `guest_has_all_tags()` (already implemented)

**Missing:** No separate `message_channel_tags` table needed - current system uses `messages.scheduled_message_id` → `scheduled_messages.target_guest_tags` relationship.

### 4. Current RLS Policies ✅

**messages table (SELECT):**

- Policy: `messages_select_optimized`
- Logic: `can_access_event(event_id)` (allows both hosts and guests)
- **Guest Access:** ✅ Already enabled for all message types

**message_deliveries table (SELECT):**

- Policy: `message_deliveries_select_optimized`
- Logic: `user_id = auth.uid()` OR host via event access
- **Delivery-gated:** ✅ Only intended recipients see deliveries

### 5. Current Guest Read Path ✅

**RPC:** `get_guest_event_messages(p_event_id, p_limit, p_before)`

- **Source:** `message_deliveries` JOIN `messages`
- **Security:** SECURITY DEFINER with event membership check
- **Behavior:** Only shows messages with delivery records

## Implementation Strategy

### Phase 1: DB & RLS (Minimal Changes)

**No new tables needed** - existing schema supports the read model:

- ✅ `messages.scheduled_message_id` → `scheduled_messages.target_guest_tags`
- ✅ Helper functions `guest_has_any_tags()`, `guest_has_all_tags()` exist
- ✅ Guest RLS access to `messages` already enabled

**RLS Adjustments (Precise):**

- **messages (SELECT):** Keep existing policy - guests can already read all message types
- **Direct Message Protection:** Will be handled in RPC logic (only include direct via deliveries)

**Indexes to Verify/Add:**

```sql
-- For efficient message type filtering
CREATE INDEX IF NOT EXISTS idx_messages_event_type_created
ON messages(event_id, message_type, created_at DESC);

-- For scheduled message lookups (channel targeting)
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_message_id
ON messages(scheduled_message_id) WHERE scheduled_message_id IS NOT NULL;

-- For tag-based filtering (already exists)
-- idx_event_guests_tags_gin ON event_guests USING gin(guest_tags)
```

### Phase 2: RPC V2 (Union Read Path)

**New RPC:** `get_guest_event_messages_v2(event_id, limit, before)`

**Union Logic:**

```sql
-- A) Direct messages from deliveries (UNCHANGED)
SELECT ... FROM message_deliveries md
JOIN messages m ON m.id = md.message_id
WHERE md.user_id = current_user_id
AND m.message_type = 'direct'

UNION ALL

-- B) Announcements from messages (NEW)
SELECT ... FROM messages m
WHERE m.event_id = p_event_id
AND m.message_type = 'announcement'

UNION ALL

-- C) Channels from messages with tag filtering (NEW)
SELECT ... FROM messages m
LEFT JOIN scheduled_messages sm ON m.scheduled_message_id = sm.id
WHERE m.event_id = p_event_id
AND m.message_type = 'channel'
AND (
  sm.target_guest_tags IS NULL OR  -- No targeting (all guests)
  guest_has_any_tags(guest_record.id, sm.target_guest_tags)  -- Tag match
)

UNION ALL

-- D) User's own messages (UNCHANGED)
SELECT ... FROM messages m
WHERE m.sender_user_id = current_user_id
```

**Payload Enhancements:**

- `source: 'delivery' | 'message'`
- `is_catchup: boolean` (true if message.created_at < guest.joined_at)
- `message_type`, `channel_tags`

### Phase 3: Shadow Verification

**Verification Script:** `docs/messages-readmodel-v2/shadow-verification.ts`

- Compare v1 vs v2 results for sample events
- Verify no missing direct messages
- Confirm additional announcements/channels appear
- Validate SMS behavior unchanged

### Phase 4: Atomic Swap

**Database Transaction:**

```sql
BEGIN;
-- Rename current RPC to legacy
ALTER FUNCTION get_guest_event_messages RENAME TO get_guest_event_messages_legacy;
-- Rename v2 to canonical name
ALTER FUNCTION get_guest_event_messages_v2 RENAME TO get_guest_event_messages;
COMMIT;
```

**UI Changes:** None required - guest UI already calls canonical RPC name

### Phase 5: Host Composer Updates

**Message Type Selector:**

- `Announcement` → "Audience: Everyone in the event" + "Notified now (SMS): {count}"
- `Channel` → Tag selector + "Notified now (SMS): {count}"
- `Direct` → Person checklist (unchanged)

**Key Insight:** Separate **audience** (who sees in app) from **notifications** (who gets SMS now)

## Rollback Strategy

**Atomic Rollback:**

```sql
BEGIN;
ALTER FUNCTION get_guest_event_messages RENAME TO get_guest_event_messages_v2;
ALTER FUNCTION get_guest_event_messages_legacy RENAME TO get_guest_event_messages;
COMMIT;
```

**Zero UI changes required** - guest UI continues calling same RPC name

## Success Metrics

- **Functional:** Guests see announcements (full history) + channels (current tags) + direct (delivery-gated)
- **SMS Parity:** Identical Twilio call volume and delivery creation
- **Performance:** RPC v2 query time < 500ms for 50 messages
- **Security:** RLS boundaries enforced (host ✓, guest types ✓, non-member ✗)

## Next Steps

1. **DB Changes:** Add indexes and verify RLS
2. **RPC V2:** Implement union query with tag filtering
3. **Shadow Test:** Parallel verification script
4. **Atomic Swap:** Single transaction RPC rename
5. **Host UI:** Message type selector and audience logic

**Status:** ✅ **READY TO IMPLEMENT** - All discovery complete, zero schema changes needed, SMS pipeline confirmed isolated.
