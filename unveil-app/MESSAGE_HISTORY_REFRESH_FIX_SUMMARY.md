# Message History Refresh Fix - Implementation Summary

## Overview
Fixed two critical issues in the host Message History view:
1. **Slow refresh**: Newly scheduled messages didn't appear until manual reload
2. **Mysterious "0" metric**: Scheduled cards showed meaningless "0" for recipient counts

## Root Causes Identified

### 1. Query Key Inconsistency
- `useMessages` used `['scheduled-messages', eventId]`
- `useScheduledMessagesQuery` used `['scheduled-messages', eventId, filters]`
- Invalidation after scheduling only targeted the first pattern, missing filtered queries

### 2. Conservative React Query Settings
- `staleTime: 60000` (1 minute) prevented immediate freshness
- `refetchOnWindowFocus: false` disabled automatic updates
- `refetchOnMount: false` prevented fresh data on navigation

### 3. Meaningless Zero Display
- `{message.recipient_count || 0}` always showed "0" for scheduled messages
- No distinction between "not yet calculated" vs "actually zero"

## Changes Implemented

### A) Instant Freshness (No Breaking Changes)

#### 1. Enhanced Cache Invalidation
**File**: `hooks/useMessages.ts`
```typescript
// Added predicate-based invalidation to catch all query variations
await queryClient.invalidateQueries({
  queryKey: ['scheduled-messages'],
  predicate: (query) => {
    const [table, id] = query.queryKey;
    return table === 'scheduled-messages' && id === eventId;
  }
});
```

#### 2. Aggressive React Query Settings
**Files**: `hooks/useMessages.ts`, `hooks/messaging/scheduled/useScheduledMessagesQuery.ts`
```typescript
// Changed from conservative to instant freshness
staleTime: 0, // Always consider stale for immediate updates
refetchOnWindowFocus: true, // Enable for immediate freshness
refetchOnMount: 'always', // Always refetch on mount
refetchOnReconnect: true, // Refetch when reconnecting
refetchInterval: typeof window !== 'undefined' && document.visibilityState === 'visible' ? 15000 : false, // 15s when focused
```

#### 3. Enhanced Success Callbacks
**File**: `components/features/messaging/host/MessageCenter.tsx`
```typescript
const handleMessageScheduled = async () => {
  // Refresh messages after scheduling with proper invalidation
  await refreshMessages(eventId);
  
  // Dev observability - log invalidation success
  if (process.env.NODE_ENV === 'development') {
    console.log('[MessageCenter] Schedule success invalidation:', {
      phase: 'schedule:success',
      invalidateKeys: ['messages', 'scheduled-messages'],
      eventId
    });
  }
};
```

### B) Clarified "0" Display

#### 1. Scheduled Messages Show "TBD"
**File**: `components/features/messaging/host/ScheduledMessagesList.tsx`
```typescript
// Before: {message.recipient_count || 0}
// After:
{message.status === 'scheduled' 
  ? (message.recipient_count && message.recipient_count > 0 ? message.recipient_count : 'TBD')
  : (message.recipient_count || 0)
}
```

#### 2. Success Counts Only When > 0
```typescript
// Only show delivery counts when meaningful
{message.status === 'sent' &&
  message.success_count !== undefined && message.success_count > 0 && (
    <span className="text-green-600 ml-1">
      ({message.success_count} delivered)
    </span>
  )}
```

#### 3. Upcoming Cards Show Placeholder
**File**: `components/features/messaging/host/RecentMessages.tsx`
```typescript
{message.type === 'scheduled' && (!message.recipient_count || message.recipient_count === 0) && (
  <span className="text-gray-500">
    Recipients TBD
  </span>
)}
```

### C) Production Ready

The realtime improvements are now permanently enabled in production without feature flags. The implementation is stable and provides immediate benefits to all users.

### D) Observability (Dev Only, PII-Safe)

#### 1. Invalidation Logging
```typescript
console.log('[MessageCenter] Schedule success invalidation:', {
  phase: 'schedule:success',
  invalidateKeys: ['messages', 'scheduled-messages'],
  eventId
});
```

#### 2. Fetch Performance Tracking
```typescript
console.log('[useScheduledMessagesQuery] Fetch completed:', {
  phase: 'fetch',
  freshMs: Math.round(fetchEnd - fetchStart),
  from: 'query',
  count: result.data?.length || 0,
  eventId
});
```

## Tests Added

### 1. Playwright E2E Tests
**File**: `tests/e2e/message-history-refresh.spec.ts`
- ✅ Newly scheduled items appear immediately (≤3s, no reload)
- ✅ Modified scheduled time updates via realtime
- ✅ Cancelled scheduled messages disappear immediately
- ✅ No "0" rendered on scheduled cards
- ✅ Timezone toggle still works correctly

### 2. Unit Tests
**File**: `__tests__/unit/message-history-cache.test.ts`
- ✅ Cache merge helper de-dupes by id and keeps order
- ✅ Realtime events are idempotent
- ✅ Performance with large datasets (100 messages < 100ms)

## Rollback Plan

### Full Rollback (If Needed)
All changes are view-layer only. To revert:
1. Restore React Query settings to previous conservative values (`staleTime: 60000`, `refetchOnWindowFocus: false`)
2. Remove predicate-based invalidation logic
3. Restore "0" display in scheduled message cards
4. Remove observability logging

## Acceptance Criteria ✅

- [x] Newly scheduled items appear on Message History immediately after scheduling (no manual reload)
- [x] Scheduled cards show no stray "0"; metrics are either meaningful or omitted
- [x] No DB/Twilio/RPC changes; no regressions to past messages or guest views
- [x] Timezone toggle functionality preserved
- [x] Realtime improvements permanently enabled for all users

## Performance Impact

### Positive
- **Immediate UX**: No more waiting/refreshing for scheduled messages to appear
- **Consistent State**: Query key alignment prevents cache misses
- **Reduced Confusion**: "TBD" vs "0" clarifies message state

### Considerations
- **Slightly More Aggressive Polling**: 15s interval when focused (vs previous 2min)
- **More Frequent Refetches**: `staleTime: 0` means more network requests
- **Mitigated By**: Realtime updates reduce need for polling; stable implementation tested thoroughly

## Monitoring

Watch for:
- **Client Performance**: Monitor React Query cache hit/miss ratios
- **Network Requests**: Track fetch frequency in dev tools
- **User Reports**: "Messages still not appearing" or "Too many refreshes"

The improvements are now permanent and provide immediate benefits to all users.
