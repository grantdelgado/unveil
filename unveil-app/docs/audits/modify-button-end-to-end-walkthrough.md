# Modify Button — End-to-End Walkthrough (UI → RPC → DB → Realtime)

## Executive Summary

This document provides a comprehensive trace of the Modify button flow in the Unveil messaging system, from user interaction through database operations to realtime updates. The analysis confirms that the modify functionality is production-ready, always-on (no feature flags), and follows secure patterns with proper validation.

---

## 1. Tap → Result Timeline (Numbered Steps)

### Step 1: User Taps "Modify" on UpcomingMessageCard

- **Component**: `UpcomingMessageCard` in `components/features/messaging/host/RecentMessages.tsx:131-138`
- **Trigger**: `onClick={onModify}` button click
- **Key Props**: `message` (ScheduledMessage), `onModify` callback
- **State**: Button only visible when `canModifyMessage(message)` returns true
- **Validation**: Status must be 'scheduled' + send_at > now + 4 minutes (3min lead + 1min freeze)

### Step 2: RecentMessages Handles Modify Request

- **Component**: `RecentMessages.handleModifyScheduled()` (lines 616-635)
- **Action**: Logs telemetry and calls `onModifyMessage(message)`
- **Telemetry**: Emits 'Schedule modify requested' with PII-safe metrics
- **State Passed**: Full `ScheduledMessage` object with all targeting data

### Step 3: MessageCenter Receives Modify Request

- **Component**: `MessageCenter.handleModifyMessage()` (lines 80-83)
- **Actions**:
  1. Sets `editingMessage` state to the selected message
  2. Switches `activeView` to 'compose' tab
- **State Transition**: `editingMessage: null → ScheduledMessage`
- **UI Update**: Composer tab becomes active, history tab hidden

### Step 4: MessageComposer Enters Edit Mode

- **Component**: `MessageComposer` useEffect (lines 357-396)
- **Mode Detection**: `editingMessage` prop is non-null
- **State Prefilling**:
  - `message` ← `editingMessage.content`
  - `messageType` ← `editingMessage.message_type`
  - `sendMode` ← 'schedule'
  - `scheduledDate/Time` ← converted from `editingMessage.send_at`
  - Audience selection restored from targeting fields
- **UI State**: Form shows "Update Scheduled Message" button instead of "Schedule Message"

### Step 5: User Makes Changes and Submits

- **Component**: `MessageComposer.handleUpdateMessage()` (lines 686-769)
- **Validation**: Content length, timing constraints, audience selection
- **Data Preparation**: Convert local time to UTC, build update payload
- **API Call**: `updateScheduledMessage(editingMessage.id, updateData)`

### Step 6: Client Service Processes Update

- **Service**: `lib/services/messaging-client.ts:updateScheduledMessage()` (lines 498-555)
- **RPC Call**: `supabase.rpc('update_scheduled_message', parameters)`
- **Parameters**: message_id, content, send_at, message_type, targeting options
- **Response Handling**: Checks RPC result.success, throws on error

### Step 7: Database RPC Executes Update

- **Function**: `update_scheduled_message()` in `supabase/migrations/20250125000000_add_modify_scheduled_message.sql`
- **Security**: `SECURITY DEFINER` with host permission check
- **Validations**: Status='scheduled', timing constraints, content length
- **Update**: Single row update with version increment, modification tracking
- **Response**: `{success: true, message: "Scheduled message updated successfully"}`

### Step 8: Database Triggers Fire

- **Trigger**: `scheduled_message_version_trigger` calls `update_scheduled_message_version()`
- **Version Tracking**: Increments `version`, sets `modified_at`, increments `modification_count`
- **Change Detection**: Only triggers on actual content/timing changes

### Step 9: Realtime Subscription Receives Update

- **Subscription**: `useScheduledMessagesRealtime` with filter `event_id=eq.{eventId}`
- **Handler**: `handleRealtimeUpdate()` in cache hook
- **Cache Update**: React Query cache updated optimistically with new message data
- **Deduplication**: Processed message IDs tracked to prevent duplicates

### Step 10: UI Updates Reflect Changes

- **Query Invalidation**: Delayed invalidation (1 second) ensures consistency
- **Message History**: Updated message appears with new modification count badge
- **Success Modal**: SendFlowModal shows "Schedule Updated" message (driven by `isEditMode`)
- **Navigation**: User returns to Message History tab showing updated card

---

## 2. Sequence Diagram (ASCII)

```
User          UpcomingCard    MessageCenter    MessageComposer    SendFlowModal    MessagingClient    RPC/DB           Realtime         MessageHistory
 |                |               |                |                |                |                |                |                |
 |--[Tap Modify]->|               |                |                |                |                |                |                |
 |                |--[onModify]-->|                |                |                |                |                |                |
 |                |               |--[setEditing]->|                |                |                |                |                |
 |                |               |--[switchTab]-->|                |                |                |                |                |
 |                |               |                |<-[prefillForm]-|                |                |                |                |
 |                |               |                |--[showModal]-->|                |                |                |                |
 |                |               |                |                |--[onSend]----->|                |                |                |
 |                |               |                |                |                |--[rpc call]--->|                |                |
 |                |               |                |                |                |                |--[validate]--->|                |
 |                |               |                |                |                |                |--[update row]->|                |
 |                |               |                |                |                |                |<-[success]-----|                |
 |                |               |                |                |                |<-[{success}]---|                |                |
 |                |               |                |                |<-[result]------|                |                |--[UPDATE]----->|
 |                |               |                |                |--[success UI]->|                |                |                |--[cache update]->|
 |                |               |                |<-[onUpdated]---|                |                |                |                |                |
 |                |               |<-[refresh]-----|                |                |                |                |                |                |
 |                |<-[updated]----| 
```

---

## 3. Composer State Machine (Concise)

### Modes

1. **create**: Default mode for new messages
   - CTA: "Send Now" / "Schedule Message"
   - State: `editingMessage = null`

2. **schedule**: Time-delayed sending mode
   - CTA: "Schedule Message" / "Update Scheduled Message" (if editing)
   - State: `sendMode = 'schedule'`

3. **editScheduled**: Modifying existing scheduled message
   - CTA: "Update Scheduled Message"
   - State: `editingMessage != null && sendMode = 'schedule'`

### Transitions

- **create → editScheduled**: `editingMessage` prop becomes non-null
- **editScheduled → create**: `editingMessage` prop becomes null (after update completion)
- **Success Modal Behavior**:
  - create/schedule: "Message Scheduled"
  - editScheduled: "Schedule Updated" (driven by `isEditMode = !!editingMessage`)

---

## 4. API/RPC Path

### Client Function

**File**: `lib/services/messaging-client.ts:updateScheduledMessage()`

- **Parameters**: `messageId: string`, `updateData: UpdateScheduledMessageData`
- **RPC Call**: `supabase.rpc('update_scheduled_message', {...})`

### RPC Function

**File**: `supabase/migrations/20250125000000_add_modify_scheduled_message.sql`

- **Name**: `update_scheduled_message()`
- **Security**: `SECURITY DEFINER` with `SET search_path = public, pg_temp`
- **Parameters**:
  - `p_message_id: UUID`
  - `p_content: TEXT`
  - `p_send_at: TIMESTAMPTZ`
  - `p_message_type: message_type_enum`
  - `p_target_all_guests: BOOLEAN`
  - `p_target_guest_ids: UUID[]`
  - `p_target_guest_tags: TEXT[]`
  - `p_send_via_sms: BOOLEAN`
  - `p_send_via_push: BOOLEAN`

### Validation Performed

1. **Message Existence**: Row lock with `FOR UPDATE`
2. **User Authorization**: `v_sender_user_id = auth.uid() OR is_event_host(v_event_id)`
3. **Status Check**: `v_current_status = 'scheduled'`
4. **Timing Constraint**: `p_send_at > NOW() + 4 minutes` (3min lead + 1min freeze)
5. **Content Validation**: Length 1-1000 characters, non-empty after trim

### Return Shape

```json
{
  "success": true,
  "message": "Scheduled message updated successfully"
}
```

**Error Format**:

```json
{
  "success": false,
  "error": "Specific error message"
}
```

---

## 5. DB Effects (Before/After)

### Tables Updated

**Primary**: `scheduled_messages` table - single row update

### Columns Modified

- `content` ← new message text
- `send_at` ← new scheduled time (UTC)
- `message_type` ← announcement/channel/direct
- `target_all_guests` ← boolean targeting flag
- `target_guest_ids` ← array of specific guest UUIDs
- `target_guest_tags` ← array of tag strings
- `send_via_sms` ← SMS delivery flag
- `send_via_push` ← push notification flag
- `updated_at` ← NOW()
- `version` ← version + 1
- `modified_at` ← NOW()
- `modification_count` ← modification_count + 1

### Confirmed Behavior

✅ **Same Row Updated**: Only existing `scheduled_messages` row is modified
✅ **No New Messages**: Zero rows created in `messages` table
✅ **No Deliveries**: Zero rows created in `message_deliveries` table
✅ **Version Tracking**: Proper increment of version and modification counters

---

## 6. Realtime/Cache Behavior

### Subscription Setup

- **Hook**: `useScheduledMessagesRealtime`
- **Table**: `scheduled_messages`
- **Filter**: `event_id=eq.{eventId}`
- **Events**: INSERT, UPDATE, DELETE

### Query Keys

- **Primary**: `['scheduled-messages', eventId, filters]`
- **Invalidation**: Delayed by 1 second after realtime update

### Update Flow

1. **Optimistic Update**: React Query cache updated immediately via `handleRealtimeUpdate()`
2. **Deduplication**: `processedMessageIds` Set prevents duplicate processing
3. **Ordering**: Messages sorted by `send_at` chronologically
4. **Consistency Check**: Delayed query invalidation ensures server-client sync

### Cross-Tab Consistency

- **Realtime**: All tabs with same event receive UPDATE event
- **Cache Sync**: React Query ensures consistent state across components
- **UI Updates**: Message cards reflect changes immediately

---

## 7. RLS/Security

### Authorization Policy

**Policy**: `scheduled_messages_host_only_optimized` (from `20250129000002_optimize_rls_policies.sql`)

```sql
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = scheduled_messages.event_id 
    AND e.host_user_id = (SELECT auth.uid())
  )
)
```

### RPC Security

- **SECURITY DEFINER**: Function runs with elevated privileges
- **Double Authorization**: RPC checks `v_sender_user_id = auth.uid() OR is_event_host(v_event_id)`
- **Row Locking**: `FOR UPDATE` prevents concurrent modifications

### Edge Cases

- **Non-host User**: Returns `{success: false, error: "Unauthorized: You can only modify your own messages"}`
- **Past Send Time**: Returns `{success: false, error: "Send time is too soon..."}`
- **Wrong Status**: Returns `{success: false, error: "Message cannot be modified: Status is sent"}`

---

## 8. Observability

### Telemetry Events

#### 1. Modify Request (PII-Safe)

```typescript
logger.sms('Schedule modify requested', {
  event_id: eventId,
  scheduled_id: messageId,
  status_before: message.status,
  send_at_delta_seconds: sendAtDeltaSeconds,
  content_length: message.content.length,
  modification_count: message.modification_count || 0,
});
```

#### 2. Modify Success (PII-Safe)

```typescript
logger.sms('Schedule modify succeeded', {
  event_id: eventId,
  scheduled_id: editingMessage.id,
  send_at_delta_seconds: sendAtDeltaSeconds,
  timing_changed_ms: timingChanged,
  content_changed: contentChanged,
  targeting_changed: targetingChanged,
  modification_count: (editingMessage.modification_count || 0) + 1,
});
```

#### 3. Always-On Rollout (One-time per session)

```typescript
logger.sms('Feature rollout: modify always on', {
  event_id: eventId,
  feature: 'modify_scheduled',
  always_on: true,
  flag_removed: true,
});
```

### Fields Logged (All PII-Safe)

- Event ID, Message ID (UUIDs)
- Timing deltas (seconds/milliseconds)
- Content length (number)
- Boolean flags (changed/unchanged)
- Modification count (number)

---

## 9. Edge Cases & Guardrails

### Timing Constraints

- **Minimum Lead Time**: 3 minutes (180 seconds)
- **Freeze Window**: 1 minute (60 seconds)
- **Total Buffer**: 4 minutes before send_at
- **Validation**: Both client and RPC enforce timing rules

### Concurrency Protection

- **Row Locking**: `FOR UPDATE` in RPC prevents race conditions
- **Version Tracking**: Optimistic locking via version increment
- **Idempotency**: React Query deduplication prevents double-processing

### Offline/Error Handling

- **Network Errors**: React Query retry with exponential backoff
- **RPC Errors**: Proper error propagation to UI
- **Realtime Disconnection**: Automatic reconnection with error tracking

### Cross-Tab Consistency

- **Realtime Sync**: All tabs receive UPDATE events
- **Cache Invalidation**: Ensures consistency after realtime updates
- **Processed IDs**: Prevents duplicate processing across tabs

### Non-Negotiables Confirmed

✅ **No Twilio Changes**: Modify only updates scheduled_messages table
✅ **No Direct Exposure**: All access gated through RLS and RPC validation
✅ **No Delivery Backfills**: Zero impact on message_deliveries table
✅ **No PII in Logs**: All telemetry uses UUIDs, counts, and boolean flags

---

## 10. Validation Queries (Live Database Results)

### Sample Message Used

```sql
-- Message ID: 95597ef3-2a81-4f23-9d1c-8450b14b269e
-- Event ID: 24caa3a8-020e-4a80-9899-35ff2797dcc0
-- Status: scheduled, Version: 3, Modification Count: 2
-- Content: "Scheduled test message Sunday!" (redacted for privacy)
```

### Query 1: No Duplicate Messages

```sql
SELECT count(*) as duplicate_candidates
FROM scheduled_messages
WHERE event_id = '24caa3a8-020e-4a80-9899-35ff2797dcc0'
  AND id <> '95597ef3-2a81-4f23-9d1c-8450b14b269e'
  AND send_at = '2025-08-24 21:28:00+00'
  AND status = 'scheduled';
```

**Result**: `duplicate_candidates: 0` ✅

### Query 2: No Messages Created

```sql
SELECT count(*) as message_count 
FROM messages 
WHERE scheduled_message_id = '95597ef3-2a81-4f23-9d1c-8450b14b269e';
```

**Result**: `message_count: 0` ✅

### Query 3: No Deliveries Created

```sql
SELECT count(*) as delivery_count
FROM message_deliveries md
JOIN messages m on m.id = md.message_id
WHERE m.scheduled_message_id = '95597ef3-2a81-4f23-9d1c-8450b14b269e';
```

**Result**: `delivery_count: 0` ✅

---

## 11. Feature Flag Status

### Current State: Always-On ✅

- **Flag Removed**: `NEXT_PUBLIC_FEATURE_MODIFY_SCHEDULED` completely removed from codebase
- **Business Rules Only**: Gated by timing constraints and message status
- **Rollout Complete**: One-time telemetry confirms always-on deployment

### Rollback Strategy

If issues arise, emergency disable via single line change:

```tsx
const canModifyMessage = (message: ScheduledMessage): boolean => {
  return false; // ROLLBACK: Disable all modify functionality
  // ... rest of function
};
```

---

## Acceptance Criteria ✅

### Flow Completeness

- [x] **Clear Hop Tracing**: Each component/handler/RPC/DB step documented with file paths
- [x] **Sequence Diagram**: ASCII diagram shows complete actor flow
- [x] **State Machine**: Composer modes and transitions documented
- [x] **Validation Results**: Database queries prove same-row updates, no message/delivery creation

### Technical Correctness

- [x] **UI Driven by editScheduled**: Success modal shows "Schedule Updated" based on `isEditMode`
- [x] **Message History Updates**: Realtime subscription updates UI with modification badges
- [x] **No Feature Flag Dependencies**: Modify functionality always available when business rules allow
- [x] **Security Validation**: RLS policies and RPC authorization confirmed

### Edge Case Coverage

- [x] **Timing Constraints**: 4-minute buffer (3min lead + 1min freeze) enforced
- [x] **Concurrency Protection**: Row locking and version tracking prevent race conditions
- [x] **Error Handling**: Proper validation and error propagation at each layer
- [x] **Cross-Tab Consistency**: Realtime updates ensure synchronized state

The Modify button flow is production-ready, secure, and provides a seamless user experience from tap to database update to realtime UI refresh.
