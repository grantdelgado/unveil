# Guest Message Ordering Investigation

**Date:** 2025-10-17  
**Issue:** Guest messages appearing out of order in `/guest/events/[id]/home`  
**Status:** Root cause identified ✅

---

## Executive Summary

Guest messages are being returned in correct reverse-chronological order from the RPC (`ORDER BY created_at DESC, id DESC`), but the **frontend rendering logic is NOT sorting messages within date groups**, causing messages to appear in reverse order when users expect chronological (oldest-first) reading order within each day.

---

## Investigation Findings

### 1. RPC Function: `get_guest_event_messages` ✅ CORRECT

**Location:** Database (calls `get_guest_event_messages_v3`)

**Ordering Logic:**
```sql
ORDER BY cm.created_at DESC, cm.message_id DESC  -- STABLE ORDERING
```

**Result:** Messages are returned in **reverse chronological order** (newest first), with stable tie-breaking using `message_id DESC` for messages with identical timestamps.

**Test Query:**
```sql
SELECT id, content, created_at, message_type
FROM messages 
WHERE event_id = '474d051a-14b5-4066-8702-bdcdb972b007'
ORDER BY created_at DESC, id DESC;
```

**Result:**
- `4744c6d3-...` "Scheduled test message to Grant!" at `2025-10-16 03:36:09` (newest)
- `4181ddaa-...` "Hello! Test announcement message." at `2025-10-16 03:30:12` (oldest)

✅ **RPC is working correctly** — returns newest messages first.

---

### 2. Hook: `useGuestMessagesRPC` ✅ PRESERVES ORDER

**Location:** `hooks/messaging/useGuestMessagesRPC.ts`

**Sorting Logic in Reducer:**
```typescript:51:56:hooks/messaging/useGuestMessagesRPC.ts
const sortedMessages = [...messagesToKeep].sort((a, b) => {
  const timeA = new Date(a.created_at).getTime();
  const timeB = new Date(b.created_at).getTime();
  if (timeB !== timeA) return timeB - timeA;  // DESC
  return a.message_id > b.message_id ? -1 : 1;  // DESC
});
```

✅ **Hook correctly maintains DESC order** — newest messages first.

---

### 3. Component: `GuestMessaging` ⚠️ **ROOT CAUSE IDENTIFIED**

**Location:** `components/features/messaging/guest/GuestMessaging.tsx`

#### Date Grouping (Line 130-158)

```typescript:130:158:components/features/messaging/guest/GuestMessaging.tsx
const messageGroups = useMemo(() => {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const messagesForGrouping = messages.map(msg => ({
    ...msg,
    id: msg.message_id,
  }));
  
  const groups = groupMessagesByDateWithTimezone(
    messagesForGrouping, 
    true,  // Always use local timezone for headers
    null   // Don't use event timezone for grouping
  );

  return groups;
}, [messages]);
```

The `groupMessagesByDateWithTimezone` function **does NOT sort messages within each group**. It preserves the order they arrive in (reverse chronological from RPC).

#### Rendering Logic (Line 402-434) ⚠️ **PROBLEM HERE**

```typescript:402:434:components/features/messaging/guest/GuestMessaging.tsx
{Object.entries(messageGroups)
  .sort(([a], [b]) => a.localeCompare(b)) // Sort dates chronologically (oldest first)
  .map(([dateKey, dayMessages]) => (
    <div key={dateKey}>
      {/* Date header */}
      <div className="text-center my-3 md:my-4">
        <div 
          className="inline-block px-3 py-1 bg-stone-100 rounded-full text-sm text-stone-500 font-medium"
          role="separator"
          aria-label={`Messages from ${formatEventDateHeader(dateKey, null)}`}
        >
          {formatEventDateHeader(dateKey, null)}
        </div>
      </div>
      {/* Messages for this date */}
      <div className="space-y-3 md:space-y-4">
        {dayMessages.map((message) => {  // ❌ NO SORTING HERE
          const originalMessage = messages.find(m => m.message_id === message.id);
          if (!originalMessage) return null;
          
          return (
            <GuestMessageBubble
              key={originalMessage.message_id}
              message={originalMessage}
              eventTimezone={eventTimezone}
              className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
            />
          );
        })}
      </div>
    </div>
  ))}
```

#### The Problem

1. **Date groups are sorted** chronologically (oldest dates first) ✅
2. **Messages within each date group are NOT sorted** ❌
3. Messages retain their original order from RPC (newest first within each day)

#### Visual Example

For messages on October 16:
- RPC returns: `[Message B (10:36 PM), Message A (10:30 PM)]` (newest first)
- Date grouping preserves: `{ "2025-10-16": [Message B, Message A] }`
- Rendering displays:
  ```
  October 16, 2025
  [Message B - 10:36 PM]  ← Newer message shown first
  [Message A - 10:30 PM]  ← Older message shown last
  ```

**User Expectation:** Within a date section, users expect to read messages chronologically (top = oldest, bottom = newest), like a conversation thread.

---

### 4. Timestamp Display: `GuestMessageBubble` ✅ CORRECT

**Location:** `components/features/messaging/guest/GuestMessageBubble.tsx`

```typescript:67:144:components/features/messaging/guest/GuestMessageBubble.tsx
const timeLabel = formatBubbleTimeOnly(message.created_at);

<span>{formatBubbleTimeOnly(message.created_at)}</span>
{hasDateMismatch(message.created_at, eventTimezone) && (
  <span 
    className="text-amber-600 ml-1"
    title="Local date differs from event timezone"
  >
    *
  </span>
)}
```

✅ **Timestamps use consistent local timezone formatting** via `formatBubbleTimeOnly`.

---

## Root Cause Summary

**Issue:** Messages within date groups are displayed in **reverse chronological order** (newest first), but users expect **chronological order** (oldest first) for reading conversations naturally.

**Location:** `components/features/messaging/guest/GuestMessaging.tsx:418`

**Current Behavior:**
```
Today
├─ Message 3 (11:30 AM) ← newest shown first
├─ Message 2 (11:00 AM)
└─ Message 1 (10:30 AM) ← oldest shown last
```

**Expected Behavior:**
```
Today
├─ Message 1 (10:30 AM) ← oldest shown first
├─ Message 2 (11:00 AM)
└─ Message 3 (11:30 AM) ← newest shown last
```

---

## Proposed Fix

### Option 1: Sort Messages Within Date Groups (Recommended)

**Location:** `components/features/messaging/guest/GuestMessaging.tsx:418`

**Change:**
```typescript
{/* Messages for this date */}
<div className="space-y-3 md:space-y-4">
  {dayMessages
    .sort((a, b) => {
      // Sort messages within day chronologically (oldest first)
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;  // ASC
      return a.id < b.id ? -1 : 1;  // ASC (stable)
    })
    .map((message) => {
      // ... existing render logic
    })
  }
</div>
```

**Pros:**
- Minimal change (single `.sort()` call)
- Maintains existing date grouping logic
- Preserves RPC order (no backend changes needed)
- Natural reading order (top to bottom, oldest to newest)

**Cons:**
- Slight performance cost (sorting on each render, mitigated by `useMemo`)

---

### Option 2: Update `groupMessagesByDateWithTimezone` Utility

**Location:** `lib/utils/date.ts:243-292`

**Change:** Add sorting inside the grouping function:
```typescript
export const groupMessagesByDateWithTimezone = <T extends { created_at: string; sent_at?: string; id: string }>(
  messages: T[],
  showMyTime: boolean = true,
  eventTimezone?: string | null
): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};

  messages.forEach((message) => {
    // ... existing grouping logic ...
    groups[dateKey].push(message);
  });

  // NEW: Sort messages within each group chronologically
  Object.keys(groups).forEach((dateKey) => {
    groups[dateKey].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;  // ASC
      return a.id < b.id ? -1 : 1;  // ASC (stable)
    });
  });

  return groups;
};
```

**Pros:**
- Centralized sorting logic
- Affects all consumers of `groupMessagesByDateWithTimezone`

**Cons:**
- Potentially affects host messaging if they expect different order
- Requires testing across multiple components

---

## Recommendation

**Use Option 1** — Sort messages locally in `GuestMessaging.tsx`.

**Reasoning:**
1. **Isolated change** — only affects guest view
2. **No risk to host messaging** or other consumers
3. **Easy to test and rollback**
4. **Defensive** — doesn't assume utility function behavior

---

## Testing Plan

### Manual Testing

1. **Same-day messages:** Send 3-4 messages with different timestamps on the same day
2. **Multi-day messages:** Send messages across 2-3 different days
3. **Quick succession:** Send messages within 1 second of each other (test stable tie-breaker)
4. **Realtime:** Send a new message while guest view is open (verify auto-scroll + ordering)
5. **Pagination:** Load older messages and verify ordering consistency

### Test Cases

```typescript
// Test 1: Multiple messages, same day
const messages = [
  { created_at: '2025-10-16T10:30:00Z', content: 'Message A' },
  { created_at: '2025-10-16T11:00:00Z', content: 'Message B' },
  { created_at: '2025-10-16T11:30:00Z', content: 'Message C' },
];
// Expected order on screen: A, B, C (oldest to newest)

// Test 2: Messages with identical timestamps
const messages = [
  { created_at: '2025-10-16T10:30:00Z', id: 'uuid-1', content: 'First' },
  { created_at: '2025-10-16T10:30:00Z', id: 'uuid-2', content: 'Second' },
];
// Expected order: uuid-1, uuid-2 (stable by ID ascending)

// Test 3: Cross-day messages
const messages = [
  { created_at: '2025-10-15T23:00:00Z', content: 'Yesterday' },
  { created_at: '2025-10-16T01:00:00Z', content: 'Today early' },
  { created_at: '2025-10-16T10:00:00Z', content: 'Today late' },
];
// Expected: 
//   October 15 → Yesterday
//   October 16 → Today early, Today late
```

---

## Acceptance Criteria

✅ Messages render in chronological order within each date group (oldest first, newest last)  
✅ Date headers appear in chronological order (oldest dates first)  
✅ Messages with identical timestamps maintain stable order using ID tie-breaker  
✅ Timestamps display in consistent local timezone  
✅ Realtime messages appear at bottom of current day group  
✅ Pagination preserves ordering when loading older messages  
✅ No change to RPC function or backend logic  
✅ No regression in host messaging or other features  

---

## Implementation Status

- [x] Investigation complete
- [x] Root cause identified
- [x] Fix implemented (Option 1: Local sort in GuestMessaging.tsx)
- [x] Unit tests added and passing (5/5 tests)
- [x] TypeScript compilation verified
- [x] Linting verified (no errors)
- [x] Observability logging enhanced (PII-safe)
- [ ] Manual testing in production environment
- [ ] Playwright E2E test (optional, covered by unit tests)

---

## Changes Made

### 1. Fixed Message Ordering in `GuestMessaging.tsx`

**File:** `components/features/messaging/guest/GuestMessaging.tsx:418-440`

**Change:** Added `.sort()` call to order messages chronologically within each date group:

```typescript
{dayMessages
  .sort((a, b) => {
    // Sort messages within day chronologically (oldest first for natural reading order)
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;  // ASC
    return a.id < b.id ? -1 : 1;  // ASC (stable tie-breaker)
  })
  .map((message) => {
    // ... render logic
  })
}
```

### 2. Enhanced Observability Logging

**File:** `components/features/messaging/guest/GuestMessaging.tsx:148-164`

**Change:** Added detailed logging for message ordering (development only, PII-safe):

```typescript
const orderingInfo = messages.slice(0, 5).map(msg => ({
  id: msg.message_id.slice(0, 8),
  created_at: msg.created_at,
  type: msg.message_type,
  contentLength: msg.content?.length || 0,
}));

console.log('GuestMessaging render:', {
  phase: 'date-grouping',
  tz: localTz,
  groups: Object.keys(groups).length,
  totalMessages: messages.length,
  sampleOrder: orderingInfo,
});
```

### 3. Added Comprehensive Test Suite

**File:** `__tests__/components/GuestMessaging-ordering.test.tsx`

**Coverage:**
- ✅ Same-day message ordering (chronological within day)
- ✅ Identical timestamp handling (stable tie-breaker by ID)
- ✅ Cross-day message ordering
- ✅ Date group sorting (oldest dates first)
- ✅ Combined behavior (end-to-end natural reading flow)

**Test Results:** All 5 tests passing

---

## Verification

### Build Verification

```bash
npm run typecheck  # ✅ Passed
npm run lint       # ✅ No errors
npm test           # ✅ 5/5 tests passed
```

### Expected User Experience

**Before Fix:**
```
Today
├─ Message 3 (11:30 AM) ← Newest shown first (confusing)
├─ Message 2 (11:00 AM)
└─ Message 1 (10:30 AM) ← Oldest shown last
```

**After Fix:**
```
Today
├─ Message 1 (10:30 AM) ← Oldest shown first (natural reading)
├─ Message 2 (11:00 AM)
└─ Message 3 (11:30 AM) ← Newest shown last
```

---

## Rollback Plan

If issues arise, revert commit with:

```bash
git revert <commit-hash>
```

Or manually remove the `.sort()` call from line 418 in `GuestMessaging.tsx`.

---

## Implementation Status

- [x] Investigation complete
- [x] Root cause identified
- [x] Fix implemented (Option 1: Local sort in GuestMessaging.tsx)
- [x] Unit tests added and passing (5/5 tests)
- [x] TypeScript compilation verified
- [x] Linting verified (no errors)
- [x] Observability logging enhanced (PII-safe)
- [ ] Manual testing in production environment
- [ ] Deployed to production

