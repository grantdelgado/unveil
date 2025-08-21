# Dev Overlay Audit Report

## Executive Summary

This audit identified **3 debug widgets** that can appear in the bottom-right corner of the app during development. Two are actively used, one is defined but unused.

---

## Bottom-Right Debug Widgets

### 1. React Query Devtools

**Name**: `ReactQueryDevtools`  
**Purpose**: Inspect React Query cache, queries, mutations, and performance metrics  
**File**: `lib/react-query-client.tsx` (lines 57-61) and `lib/react-query.tsx` (lines 49-53)  
**Component**: `@tanstack/react-query-devtools`

**Mount Point**: 
- `app/layout.tsx` → `ReactQueryProvider` → `ReactQueryDevtools`
- Rendered at root level in both query provider implementations

**Visibility Conditions**:
```typescript
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools 
    initialIsOpen={false} 
    position="bottom" // or buttonPosition="bottom-left"
  />
)}
```

**Screenshot Ref**: Small floating button in bottom-left corner with React Query logo, expands to full devtools panel

**Disable Methods**:
- **Env**: Set `NODE_ENV=production` 
- **Code**: Remove lines 57-61 in `lib/react-query-client.tsx` and lines 49-53 in `lib/react-query.tsx`

**Risk**: Medium - Used for debugging query performance and cache invalidation

---

### 2. Message Debug Overlay

**Name**: `MessageDebugOverlay`  
**Purpose**: Debug message deliveries, SMS status, and guest records for messaging system  
**File**: `components/dev/MessageDebugOverlay.tsx`  
**Export**: `MessageDebugOverlay`

**Mount Point**:
- `components/features/messaging/guest/GuestMessaging.tsx` (lines 421-425)
- Only rendered in guest messaging interface

**Visibility Conditions**:
```typescript
// In MessageDebugOverlay.tsx (line 55)
if (process.env.NODE_ENV !== 'development') {
  return null;
}

// Usage in GuestMessaging.tsx
<MessageDebugOverlay 
  eventId={eventId}
  userId={currentUserId}
  guestId={guestId}
/>
```

**Screenshot Ref**: Small red button with "🐛 MSG" text, expands to modal with message delivery data

**Disable Methods**:
- **Env**: Set `NODE_ENV=production`
- **Code**: Remove lines 421-425 in `components/features/messaging/guest/GuestMessaging.tsx`

**Risk**: High - Critical for debugging SMS delivery issues and message routing

---

### 3. Realtime Debug Panel (UNUSED)

**Name**: `RealtimeDebugPanel`  
**Purpose**: Monitor Supabase realtime connection health, subscriptions, and stability  
**File**: `components/dev/RealtimeDebugPanel.tsx`  
**Export**: `RealtimeDebugPanel`

**Mount Point**: 
- **NOT MOUNTED** - Component is defined but never imported/used
- Placeholder exists in `app/guest/events/[eventId]/home/page.tsx` (lines 531-535) but empty

**Visibility Conditions**:
```typescript
// Component has built-in dev check (line 24)
enabled = process.env.NODE_ENV === 'development'

// And health monitoring check (line 50)
if (!enabled || !health.isMonitoring) return null;
```

**Screenshot Ref**: Would appear as white panel with "Realtime Debug" header and health percentage

**Disable Methods**:
- **Status**: Already disabled (not mounted anywhere)
- **Code**: Component can be safely deleted from `components/dev/RealtimeDebugPanel.tsx`

**Risk**: None - Component is unused

---

## Code Pointers

### 1. React Query Devtools Mount Points
```typescript
// lib/react-query-client.tsx:57-61
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools 
    initialIsOpen={false} 
    position="bottom"
  />
)}

// lib/react-query.tsx:49-53  
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools
    initialIsOpen={false}
    buttonPosition="bottom-left"
  />
)}
```

### 2. Message Debug Overlay Mount
```typescript
// components/features/messaging/guest/GuestMessaging.tsx:421-425
<MessageDebugOverlay 
  eventId={eventId}
  userId={currentUserId}
  guestId={guestId}
/>
```

### 3. Message Debug Overlay Dev Check
```typescript
// components/dev/MessageDebugOverlay.tsx:55-57
if (process.env.NODE_ENV !== 'development') {
  return null;
}
```

### 4. Realtime Debug Panel Definition (Unused)
```typescript
// components/dev/RealtimeDebugPanel.tsx:24
export function RealtimeDebugPanel({ enabled = process.env.NODE_ENV === 'development' })

// components/dev/RealtimeDebugPanel.tsx:68
return (
  <div className="fixed bottom-4 right-4 z-50">
```

### 5. Empty Debug Panel Placeholder
```typescript
// app/guest/events/[eventId]/home/page.tsx:531-535
{process.env.NODE_ENV === 'development' && (
  <div>
    {/* Debug panel loaded dynamically in development only */}
  </div>
)}
```

---

## Recommendations

| Widget | Recommendation | Rationale |
|--------|---------------|-----------|
| **React Query Devtools** | Keep, hide by default | Essential for debugging query performance |
| **Message Debug Overlay** | Keep, toggle via env | Critical for SMS delivery debugging |
| **Realtime Debug Panel** | Remove unused component | Cleanup dead code, reduce bundle size |

---

## Environment Variables

To disable all debug widgets globally:
```bash
NODE_ENV=production
```

To selectively control (future enhancement):
```bash
NEXT_PUBLIC_DEBUG_QUERIES=false
NEXT_PUBLIC_DEBUG_MESSAGING=false  
NEXT_PUBLIC_DEBUG_REALTIME=false
```

---

## Notes

- Both active widgets respect `NODE_ENV !== 'development'` check
- No third-party debug tools (Vercel Toolbar, etc.) detected
- All widgets use `z-50` for layering above app content
- Message Debug Overlay conflicts with Realtime Debug Panel position (both `bottom-4 right-4`)
- React Query Devtools has two different implementations in the codebase
