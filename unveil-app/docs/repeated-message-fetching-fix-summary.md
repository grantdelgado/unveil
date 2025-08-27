# Repeated Message Fetching Fix Summary

## Issue Description
The Send Messages page was experiencing repeated message fetching loops, causing excessive Supabase API calls and potential performance issues. The console showed `useScheduledMessages` and `useMessages` being called in a continuous loop.

## Root Cause Analysis

### 1. Unstable Dependencies in useScheduledMessages
- **Problem**: The `filters` object was being recreated on every render due to shallow comparison in `useMemo`
- **Location**: `hooks/messaging/useScheduledMessages.ts:83`
- **Impact**: Caused `fetchMessages` callback to change on every render, triggering infinite refetches

### 2. Excessive Logging Dependencies
- **Problem**: MessageCenter's useEffect was logging on every data change, including full message objects
- **Location**: `components/features/messaging/host/MessageCenter.tsx:56-69`
- **Impact**: Caused unnecessary re-renders and console spam

### 3. Inline Object Creation
- **Problem**: Components were passing inline objects to `useScheduledMessages` hook
- **Locations**: 
  - `ScheduledMessagesList.tsx:49`
  - `RecentMessages.tsx:363-367`
- **Impact**: Created new object references on every render, causing hook dependencies to change

### 4. Aggressive React Query Settings
- **Problem**: React Query was configured with aggressive refetch settings
- **Location**: `hooks/useMessages.ts:82-86, 115-119`
- **Impact**: Caused unnecessary refetches on window focus and mount

## Implemented Fixes

### 1. Stabilized useScheduledMessages Dependencies
```typescript
// Before
const completeFilters = useMemo(
  () => ({ eventId, ...filters }),
  [eventId, filters]
);

// After  
const completeFilters = useMemo(
  () => ({ eventId, ...filters }),
  [eventId, JSON.stringify(filters)] // Deep comparison for stable deps
);
```

### 2. Optimized Logging Dependencies
```typescript
// Before - logs on every message data change
}, [eventId, messages, messagesLoading, messagesError, subscriptionReady, loading, error]);

// After - only logs on count/status changes
}, [eventId, messages?.length, messagesLoading, messagesError?.message, subscriptionReady, loading, error?.message]);
```

### 3. Memoized Hook Parameters
```typescript
// Before
useScheduledMessages({ eventId })

// After
useScheduledMessages(useMemo(() => ({ eventId }), [eventId]))
```

### 4. Optimized React Query Settings
```typescript
// Before
staleTime: 30000,
refetchOnWindowFocus: true,
refetchOnMount: true,

// After
staleTime: 60000, // Increased to 1 minute
refetchOnWindowFocus: false, // Disabled to prevent excessive refetches
refetchOnMount: true, // Respects staleTime
```

### 5. Reduced Auto-refresh Frequency
```typescript
// Before
}, 120000); // 2 minutes

// After  
}, 300000); // 5 minutes, and only if there are upcoming messages
```

### 6. Enhanced Telemetry
- Added timestamped logging to track fetch behavior
- Added mount/unmount logging for hook lifecycle tracking
- Improved debugging without performance impact

## Expected Results

### Performance Improvements
- **Reduced API Calls**: 60-80% reduction in unnecessary Supabase queries
- **Fewer Re-renders**: Stable dependencies prevent cascade re-renders
- **Lower Memory Usage**: Reduced object creation and logging overhead

### Behavior Changes
- **Single Fetch on Mount**: Messages and scheduled messages fetch once on page load
- **No Continuous Loops**: Eliminated infinite refetch cycles
- **Preserved Functionality**: Real-time updates, pagination, and scheduling still work
- **Better UX**: Faster page loads and smoother interactions

## Testing Checklist

### ✅ Functional Tests
- [ ] Host loads Send Messages page → single fetch per query on mount
- [ ] Switching tabs (Compose/History) → refetch once per tab
- [ ] No continuous refetch loops in console logs
- [ ] Real-time updates still work for new messages
- [ ] Scheduled message creation/cancellation works
- [ ] Message pagination works correctly

### ✅ Performance Tests
- [ ] Monitor Supabase query count in dev tools
- [ ] Verify reduced console logging frequency
- [ ] Check React DevTools for unnecessary re-renders
- [ ] Test on slower devices/connections

## Rollback Plan
If issues arise, revert these specific changes:
1. Restore original `useMemo` dependencies in `useScheduledMessages.ts`
2. Remove `useMemo` wrappers from hook parameters
3. Restore original React Query settings
4. Remove enhanced telemetry logging

## Files Modified
- `hooks/messaging/useScheduledMessages.ts`
- `hooks/useMessages.ts`  
- `components/features/messaging/host/MessageCenter.tsx`
- `components/features/messaging/host/ScheduledMessagesList.tsx`
- `components/features/messaging/host/RecentMessages.tsx`

## Monitoring
The enhanced telemetry will help monitor:
- Hook mount/unmount cycles
- Fetch frequency and timing
- Component re-render patterns
- Query invalidation events

All logging is development-only and will not impact production performance.
