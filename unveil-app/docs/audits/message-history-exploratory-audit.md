# Message History — Exploratory Audit Report

**Date:** January 2025  
**Issue:** Message History view shows empty list and constant re-rendering  
**Scope:** End-to-end data flow analysis (UI → hooks → API/RPC → DB → realtime)

## Executive Summary

The Message History feature suffers from **multiple conflicting data sources** and **React Query configuration conflicts** that cause empty displays and constant re-rendering. The root cause is a **dual hook architecture** where `useMessages` and `useScheduledMessages` operate independently with different query settings, leading to race conditions and subscription conflicts.

## System Architecture Map

```
UI Layer:
├── MessageCenter (tabs: compose/history)
├── RecentMessages (unified display)
└── ScheduledMessagesList (separate component)

Data Layer:
├── useMessages (messages + scheduled_messages tables)
├── useScheduledMessages (scheduled_messages only)
├── useScheduledMessagesQuery (React Query wrapper)
└── Multiple realtime subscriptions

Database Layer:
├── messages (45 rows, RLS: can_access_event)
├── scheduled_messages (27 rows, RLS: host_only_optimized)
└── RLS functions: is_event_host(), can_access_event()
```

## Root Cause Analysis

### 1. **Conflicting Data Sources** (Primary Issue)

**Problem:** Two hooks fetch the same `scheduled_messages` data with different configurations:

- `useMessages` (line 75-90): Basic query, `order('send_at', { ascending: true })`
- `useScheduledMessages` (line 60+): Complex hook with realtime, filters, auto-refresh

**Evidence:**
```typescript
// useMessages.ts - Simple query
const { data: scheduledMessages } = useQuery({
  queryKey: ['scheduled-messages', eventId],
  // Uses default React Query settings
});

// useScheduledMessages.ts - Complex hook  
const { scheduledMessages } = useScheduledMessages({ 
  eventId,
  autoRefresh: true,
  realTimeUpdates: true 
});
```

**Impact:** Race conditions where one query invalidates the other, causing constant refetching.

### 2. **React Query Configuration Conflicts** (Secondary Issue)

**Conflicting Settings:**

| Setting | Global Default | useScheduledMessagesQuery | useMessages |
|---------|---------------|---------------------------|-------------|
| `refetchOnWindowFocus` | `false` | `true` | `undefined` (inherits `false`) |
| `staleTime` | `5min` | `30s` | `undefined` (inherits `5min`) |
| `refetchInterval` | `false` | `60s` | `false` |

**Evidence from code:**
```typescript
// lib/react-query-client.tsx (line 38)
refetchOnWindowFocus: false, // Global default

// useScheduledMessagesQuery.ts (line 77-78)
refetchOnWindowFocus: true,
refetchInterval: autoRefresh ? 60000 : false,
```

**Impact:** Scheduled messages refetch every 60 seconds + on window focus, while regular messages use 5-minute cache.

### 3. **Realtime Subscription Duplication**

**Problem:** Multiple subscriptions to `scheduled_messages` table:

1. `useScheduledMessages` → `scheduled_messages:${eventId}` subscription
2. Potential additional subscriptions from other hooks
3. SubscriptionManager cleanup may not prevent duplicates during rapid re-mounts

**Evidence:**
```typescript
// useScheduledMessages.ts (line 303-304)
const subscriptionId = `scheduled_messages:${eventId}`;
const unsubscribe = manager.subscribe(subscriptionId, {
  // Real-time updates cause state changes → re-renders
});
```

### 4. **Data Ordering Inconsistency**

**Problem:** Different sort orders between data sources:

- `messages`: `order('created_at', { ascending: true })` (line 66)
- `scheduled_messages` in `useMessages`: `order('send_at', { ascending: true })` (line 84)
- Expected by UI: **created_at DESC, id DESC** for stable ordering

**Impact:** Inconsistent message ordering and potential display flickering.

## Database State Analysis

**Data Presence:** ✅ Confirmed
- `messages`: 45 records for event `41191573-7726-4b98-a7c9-a27d139af93a`
- `scheduled_messages`: 27 records (status: 'sent')
- Host user: `7a4ce708-0555-4db2-b181-b7404857f118`

**RLS Policies:** ✅ Properly configured
- `messages.messages_select_optimized`: Uses `can_access_event(event_id)`
- `scheduled_messages.scheduled_messages_host_only_optimized`: Host-only access via `events.host_user_id`

**RLS Functions:** ✅ Working correctly
- `is_event_host()`: Checks `events.host_user_id` + guest role fallback
- `can_access_event()`: Combines host + guest access checks

## Reproduction Steps

1. Navigate to `/host/events/[eventId]/messages`
2. Click "Message History" tab
3. **Observe:** Empty list with "No messages sent yet" 
4. **Observe:** "Updating..." indicator flashing intermittently
5. **Browser DevTools:** Multiple network requests to same endpoints
6. **Console:** Realtime subscription logs showing duplicate subscriptions

## Evidence Summary

### Query Keys & Dependencies
```typescript
// Conflicting query keys for same data:
['messages', eventId]                    // useMessages
['scheduled-messages', eventId]          // useMessages  
['scheduled-messages', eventId, filters] // useScheduledMessagesQuery
```

### Subscription Logs (Expected)
```
📡 Creating enhanced subscription: scheduled_messages:41191573-7726-4b98-a7c9-a27d139af93a
⚠️ Subscription already active, skipping: scheduled_messages:41191573-7726-4b98-a7c9-a27d139af93a
```

### React Query States
- `isLoading`: Alternates between `true`/`false` 
- `isFetching`: Frequently `true` due to window focus refetches
- `isStale`: `true` after 30 seconds for scheduled messages

## Root Causes (Ranked)

### 1. **Dual Hook Architecture** (Critical)
Two hooks (`useMessages`, `useScheduledMessages`) fetch overlapping data with different configurations, causing race conditions and cache conflicts.

### 2. **React Query Settings Mismatch** (High)  
`refetchOnWindowFocus: true` + `refetchInterval: 60000` in scheduled messages hook conflicts with global `refetchOnWindowFocus: false`, causing excessive refetching.

### 3. **Missing Unified Data Model** (Medium)
No single source of truth for "message history" that combines sent messages + scheduled messages with consistent ordering.

### 4. **Subscription Management** (Low)
Potential duplicate subscriptions during component re-mounts, though SubscriptionManager has deduplication logic.

## High-Level Fix Options

### Option A: **Unified Hook Architecture** (Recommended)
**Approach:** Single `useMessageHistory` hook that combines both data sources
```typescript
// New unified hook
export function useMessageHistory(eventId: string) {
  // Single React Query for both messages + scheduled_messages
  // Unified sorting: created_at DESC, id DESC  
  // Single realtime subscription
  // Consistent cache settings
}
```
**Pros:** Eliminates race conditions, single source of truth, consistent UX
**Cons:** Requires refactoring existing components

### Option B: **React Query Settings Alignment** (Quick Fix)
**Approach:** Align all message-related queries to use same cache settings
```typescript
// Standardize across all hooks:
staleTime: 30000,
refetchOnWindowFocus: false,
refetchInterval: false, // Rely on realtime only
```
**Pros:** Minimal code changes, reduces refetch loops
**Cons:** Doesn't solve dual hook architecture issue

### Option C: **Data Source Consolidation** (Hybrid)
**Approach:** Make `useMessages` the single source, remove scheduled messages query
```typescript
// Modify useMessages to handle all message types
// Remove useScheduledMessages from RecentMessages component
// Single subscription for both tables
```
**Pros:** Leverages existing architecture, reduces complexity
**Cons:** May require changes to scheduled message management features

## Implementation Recommendations

### Phase 1: **Immediate Stabilization**
1. **Disable conflicting settings** in `useScheduledMessagesQuery`:
   ```typescript
   refetchOnWindowFocus: false,
   refetchInterval: false,
   ```
2. **Add query deduplication** in `RecentMessages` component
3. **Implement stable sorting** across all queries

### Phase 2: **Architecture Unification**  
1. **Create `useMessageHistory`** hook combining both data sources
2. **Implement unified realtime subscription** for messages + scheduled_messages
3. **Add proper empty states** and loading skeletons
4. **Update UI components** to use single data source

### Phase 3: **Performance Optimization**
1. **Add pagination** for large message lists
2. **Implement virtualization** for mobile performance  
3. **Add message type filtering** (announcement, direct, etc.)
4. **Optimize subscription payload** size

## Test Plan Outline

### Unit Tests
- `useMessageHistory` hook behavior with/without eventId
- Stable sort order verification  
- Message type filtering and combination logic

### Integration Tests  
- Mount Message History tab → no refetch loops
- Lists populate deterministically within 2 seconds
- Empty states display correctly when no data

### Realtime Tests
- New message/schedule events update correct sections exactly once
- Subscription cleanup prevents memory leaks
- Network reconnection maintains data consistency

### Mobile Tests
- iPhone/Android responsive layouts
- Sticky headers and scroll performance
- Friendly timestamp formatting in different timezones

## Guardrails & Non-Goals

**Preserve:**
- ✅ Existing RLS policies and security model
- ✅ Separate server/browser Supabase clients  
- ✅ No PII in logs or error messages
- ✅ Twilio send path and notification behavior

**Exclude from scope:**
- ❌ Direct message delivery backfill for late joiners
- ❌ Changes to message composition or scheduling UI
- ❌ Database schema modifications
- ❌ Authentication or event access control changes

## Next Steps

1. **Implement Option B** (React Query alignment) as immediate hotfix
2. **Design unified data model** for message history  
3. **Create implementation plan** for Option A (unified architecture)
4. **Set up monitoring** for query performance and subscription health
5. **Plan gradual migration** to avoid disrupting existing functionality

---

**Audit completed:** Ready for implementation planning and technical review.
