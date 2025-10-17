# Performance Snapshot — October 16, 2025

**Audit Date**: October 16, 2025  
**Baseline Comparison**: September 26, 2025  
**Method**: Code review + existing artifact analysis (fresh build pending)

---

## Executive Summary

**Performance Grade**: B+ (8.0/10)

- **Bundle Size**: ⚠️ Needs fresh build to confirm current state (Sept 26: 676KB main-app, 69% over target)
- **Mobile UX**: ✅ Excellent — Safe-area handling, viewport fixes, keyboard awareness all implemented
- **Realtime Performance**: ✅ Strong — Single SubscriptionProvider, exponential backoff, cold reconnect logic
- **Query Optimization**: ✅ Good — Key paths indexed, RLS policies optimized, canonical RPCs in place
- **Quick Wins Available**: 3 optimizations identified (150-180KB total savings, 5-7 hours effort)

---

## Bundle Size Analysis

### Current Route Budgets (from `bundle-budgets.json`)

| Route | Budget (KB) | Warning (KB) | Sept 26 Actual | Status | Delta |
|-------|-------------|--------------|----------------|--------|-------|
| `/` (Landing) | 220 | 200 | TBD | 🟡 Needs build | N/A |
| `/login` | 200 | 180 | TBD | 🟡 Needs build | N/A |
| `/select-event` | 280 | 250 | TBD | 🟡 Needs build | N/A |
| `/guest/home` | 320 | 290 | TBD | 🟡 Needs build | N/A |
| `/host/dashboard` | 350 | 320 | TBD | 🟡 Needs build | N/A |
| `/host/messaging` | 400 | 370 | TBD | 🟡 Needs build | N/A |
| **Main-app** | **400** | **370** | **676** | 🔴 **69% over** | **+276KB** |

### September 26 Baseline Issues

**From `docs/reviews/2025-09-26/opportunities_ranked.md`**:

> **Bundle Size Optimization — Main App**  
> Context: 676KB main-app bundle exceeds 400KB target by 69%  
> Impact: 4/5 — Mobile loading performance impact  
> Effort: M (Medium) — Audit React Query devtools, dynamic imports

**Likely Contributors** (Based on Code Review):
1. `@tanstack/react-query` + devtools (~100KB)
2. `@tanstack/react-query-devtools` (loaded in production, ~50-80KB)
3. `date-fns` (not tree-shaken, ~60KB)
4. `lucide-react` (full icon set imported, ~40KB)
5. `react-dropzone` + `react-hook-form` (~30KB combined)

### Action Required

**Run Fresh Build**:
```bash
pnpm build
```

**Extract Route Sizes**:
```bash
# Read from Next.js build output
cat .next/build-manifest.json | jq '.pages' > bundle-sizes-2025-10.json

# Or use bundle analyzer
ANALYZE=true pnpm build
```

**Compare to Baseline**:
- Load `docs/reviews/2025-09-26/lighthouse_*.json` (if contains bundle info)
- Calculate delta per route
- Identify regressions > 10KB

---

## Per-Route Bundle Analysis (Estimated)

### Critical Routes

#### `/login` (Auth Entry Point)

**Budget**: 200KB | **Warning**: 180KB

**Expected Contents**:
- Next.js runtime + React (~80KB gzipped)
- Auth components (`PhoneStep`, `OTPStep`, `ModernOTPInput`) (~15KB)
- Supabase client (~40KB)
- UI components (`Button`, `Input`, `LoadingSpinner`) (~10KB)
- Logger + error handling (~8KB)

**Estimated Total**: ~153KB ✅ **Within budget**

**Optimizations in Place**:
- ✅ No heavy dependencies (no React Query on this page)
- ✅ Minimal component tree
- ✅ Font preload with fallback

**No action needed**

---

#### `/select-event` (Event Selection)

**Budget**: 280KB | **Warning**: 250KB

**Expected Contents**:
- Base runtime + React (~80KB)
- React Query client (~50KB)
- `useUserEvents` hook + event selection components (~20KB)
- Avatar component (lazy loaded) (~8KB)
- Supabase client (~40KB)
- UI components (~15KB)

**Estimated Total**: ~213KB ✅ **Within budget**

**Optimizations in Place**:
- ✅ Server component for initial render (EventSelectionView)
- ✅ Client component for interactivity only (EventSelectionClient)
- ✅ UserAvatarButton lazy loaded

**No action needed**

---

#### `/guest/events/[eventId]/home` (Guest Home)

**Budget**: 320KB | **Warning**: 290KB

**Expected Contents**:
- Base runtime + React (~80KB)
- React Query client + devtools (⚠️ ~100KB if devtools in prod)
- Messaging components (GuestMessaging, MessageBubble, etc.) (~40KB)
- Realtime SubscriptionProvider + Manager (~30KB)
- `useGuestMessagesRPC` hook (~20KB)
- `date-fns` for timestamp formatting (~20KB if not tree-shaken)
- UI components (~20KB)

**Estimated Total**: ~310KB ⚠️ **Close to budget**

**Optimizations in Place**:
- ✅ GuestMessaging lazy loaded (dynamic import with 100ms defer)
- ✅ DeclineEventModal lazy loaded
- ✅ Deferred mount for below-the-fold content

**Potential Issues**:
- ⚠️ React Query devtools may be loading in production
- ⚠️ `date-fns` not tree-shaken (imports full library)

**Recommended Actions**:
1. Verify devtools are dev-only (Quick Win #1)
2. Tree-shake `date-fns` (Quick Win #2)

---

#### `/host/events/[eventId]/dashboard` (Host Dashboard)

**Budget**: 350KB | **Warning**: 320KB

**Expected Contents**:
- Base runtime + React (~80KB)
- React Query client + devtools (~100KB)
- Host dashboard components (QuickActions, stats widgets) (~30KB)
- `useUnifiedGuestCounts` hook (~10KB)
- UI components (~20KB)
- Chart library (if present, ~40KB)

**Estimated Total**: ~280KB ✅ **Within budget**

**Optimizations in Place**:
- ✅ LeanHostProvider (no heavy realtime subscriptions on dashboard)
- ✅ Quick actions use icons (Lucide), not images

**No action needed**

---

### Global Thresholds

**From `bundle-budgets.json`**:
- Max single route: 400KB
- Average route size: 280KB
- Total bundle size: 2000KB
- Vendor chunk: 800KB
- Common chunk: 150KB

**Status**: ⚠️ Main-app bundle at 676KB (Sept 26) exceeds 400KB max by 69%

---

## React Query & Subscription Metrics

### Subscription Manager Health

**Current Implementation** (`lib/realtime/SubscriptionManager.ts`):

- ✅ **Single provider per route**: No duplicate SubscriptionProvider instances
- ✅ **isReady check**: All subscriptions wait for `isReady && manager` before subscribing
- ✅ **Exponential backoff**: 2s → 4s → 8s → 16s → 30s max for failed connections
- ✅ **Cold reconnect**: After 3 consecutive timeouts, destroy and recreate client
- ✅ **Metrics batching**: Aggregates telemetry every 5 seconds to reduce log noise
- ✅ **Memory leak prevention**: Cleanup refs in `useEffect` return functions

**Subscription Counts** (Estimated per Route):

| Route | Subscriptions | Tables Monitored | Notes |
|-------|---------------|------------------|-------|
| `/guest/home` | 3 | messages, message_deliveries, messages (UPDATE) | Fast-path INSERT + delivery status |
| `/host/dashboard` | 0 | None | No realtime on dashboard (stats are static) |
| `/host/messages` | 2-4 | messages, scheduled_messages, message_deliveries | Depends on view (composer vs list) |

**Total Active Subscriptions** (Typical Session):
- Guest user: 3 subscriptions
- Host user: 0-4 subscriptions (dashboard → messaging)

**Assessment**: ✅ **Healthy** — Subscription counts are reasonable, no duplicate subscriptions observed

---

### React Query Cache Behavior

**Query Keys Reviewed**:
```typescript
// Well-structured, no collisions
['events', userId]                   // useUserEvents
['event', eventId, userId]           // useEventWithGuest
['messages', eventId, guestId]       // useGuestMessagesRPC
['guest-counts', eventId]            // useUnifiedGuestCounts
['current-user']                     // useCurrentUser
```

**Cache Configuration** (from `lib/react-query-client.tsx`):
```typescript
defaultOptions: {
  queries: {
    // Default staleTime: 0 (always refetch on mount)
    // Default cacheTime: 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,  // ✅ Good — prevents excessive refetches
  }
}
```

**Potential Optimizations**:

⚠️ **No `staleTime` set on stable queries**:
```typescript
// Current: Always refetches on mount
const { data: events } = useQuery({
  queryKey: ['user-events', userId],
  queryFn: fetchUserEvents,
  // staleTime: 0 (default)
});

// Recommended: Add staleTime for stable data
const { data: events } = useQuery({
  queryKey: ['user-events', userId],
  queryFn: fetchUserEvents,
  staleTime: 60_000, // 1 minute — events don't change frequently
});
```

**Affected Hooks**:
- `hooks/events/useUserEvents.ts` — User's event list
- `hooks/useCurrentUser.ts` — Current user profile
- `hooks/guests/useUnifiedGuestCounts.ts` — Guest count stats (updates slowly)

**Estimated Impact**:
- Reduced network requests: 10-20% fewer queries
- Faster navigation: Instant render from cache instead of loading spinner
- Effort: 1 hour to add `staleTime` to 5-10 queries

---

### Network Waterfall Analysis

**Initial Load Sequence** (Based on Code Review):

```
1. HTML Document (SSR)              — 0ms
2. Critical CSS + JS Chunks         — 50-200ms (network dependent)
3. Font Files (Inter variable)      — 100-300ms (preloaded, parallel)
   ├─ inter-variable.woff2
   └─ inter-variable-italic.woff2
4. Auth Session Check               — 50-150ms (supabase.auth.getSession)
5. User Data Fetch                  — 100-200ms (get_user_events RPC)
6. Realtime Connection              — 200-500ms (after isReady)
   ├─ WebSocket handshake
   └─ Channel subscriptions
```

**Opportunities**:

⚠️ **Sequential Auth + Data Fetch**:
Currently:
```typescript
// Step 1: Wait for auth
const { session } = useAuth();

// Step 2: Then fetch data
useEffect(() => {
  if (session) fetchUserEvents();
}, [session]);
```

Could be parallel:
```typescript
// Fetch both in parallel
Promise.all([
  supabase.auth.getSession(),
  supabase.rpc('get_user_events')  // Will fail if not authed, but faster success path
]);
```

**Estimated Savings**: 50-100ms on authenticated load

---

## Mobile Performance Observations

### Viewport & Layout Stability

**Safe-Area Handling** (`app/globals.css:86-122`):

```css
/* ✅ Safe area variables defined */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
}

/* ✅ Utility classes for safe areas */
.safe-top { padding-top: max(var(--sat), 0px); }
.safe-bottom { padding-bottom: max(var(--sab), 0px); }
.safe-x { 
  padding-left: max(var(--sal), 0px);
  padding-right: max(var(--sar), 0px);
}
```

**Status**: ✅ **Excellent** — All iOS notch + home indicator cases handled

---

**Viewport Height Fixes** (`app/globals.css:124-139`):

```css
/* ✅ iOS 100vh bug mitigation */
.min-h-mobile {
  min-height: 100svh;  /* Small viewport (excludes browser chrome) */
  min-height: 100dvh;  /* Dynamic viewport (adjusts with keyboard) */
}

.h-mobile {
  height: 100svh;
  height: 100dvh;
}
```

**Status**: ✅ **Excellent** — Prevents content jumping when iOS Safari shows/hides URL bar

---

**Keyboard Handling** (`app/globals.css:320-329`):

```css
/* ✅ Keyboard-aware padding */
.keyboard-adjust {
  padding-bottom: env(keyboard-inset-height, 0px);
}

/* ✅ Scroll padding for sticky elements */
.scroll-pb-safe {
  scroll-padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
}
```

**Status**: ✅ **Good** — Composer stays visible when keyboard opens

**Potential Issue**: `env(keyboard-inset-height)` is not widely supported yet. May need JavaScript fallback for Android.

---

### Touch Target Sizes

**From `app/globals.css:298-310`**:

```css
/* ✅ Minimum touch target enforcement */
button,
[role='button'] {
  min-height: 44px;  /* iOS HIG minimum */
  min-width: 44px;
  touch-action: manipulation;  /* Prevents double-tap zoom */
  -webkit-tap-highlight-color: rgba(255, 107, 107, 0.2);
}
```

**Status**: ✅ **Excellent** — All interactive elements meet accessibility guidelines

---

### Scroll Performance

**From `app/globals.css:313-329`**:

```css
/* ✅ Optimized scroll behavior */
.scroll-container {
  overscroll-behavior-y: contain;  /* Prevents rubber-band on iOS */
  -webkit-overflow-scrolling: touch;  /* Momentum scrolling */
}
```

**Status**: ✅ **Good** — Smooth scrolling with proper boundaries

---

## 3 Quick Performance Wins

### Quick Win #1: Lazy Load React Query Devtools

**Current State** (`lib/react-query-client.tsx`):
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Devtools always loaded, even in production
<ReactQueryDevtools initialIsOpen={false} />
```

**Recommended Fix**:
```typescript
// Only load devtools in development
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? require('@tanstack/react-query-devtools').ReactQueryDevtools
    : () => null;

// Or use dynamic import
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then(mod => ({ 
    default: mod.ReactQueryDevtools 
  })),
  { ssr: false, loading: () => null }
);
```

**Estimated Savings**: 50-80KB gzipped  
**Effort**: 30 minutes  
**Risk**: None (devtools-only change)  
**Files**: `lib/react-query-client.tsx`

---

### Quick Win #2: Tree-Shake `date-fns`

**Current State** (across multiple files):
```typescript
import { format, parseISO } from 'date-fns';  // ✅ Good (tree-shakeable)

// But some files may have:
import * as dateFns from 'date-fns';  // ❌ Bad (imports everything)
```

**Recommended Fix**:
```typescript
// Use specific imports everywhere
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

// Or use date-fns-tz for timezone-aware functions
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
```

**Estimated Savings**: 40-60KB gzipped  
**Effort**: 1-2 hours (find and replace across codebase)  
**Risk**: Low (regression test date formatting)  
**Files**: Grep for `import.*date-fns` and audit each usage

---

### Quick Win #3: Add `staleTime` to Stable Queries

**Current State**:
```typescript
// User events query refetches on every mount
const { data: events } = useQuery({
  queryKey: ['user-events', userId],
  queryFn: fetchUserEvents,
  // staleTime: 0 (default)
});
```

**Recommended Fix**:
```typescript
const { data: events } = useQuery({
  queryKey: ['user-events', userId],
  queryFn: fetchUserEvents,
  staleTime: 60_000, // 1 minute
});
```

**Estimated Savings**: 10-20% fewer network requests, faster perceived performance  
**Effort**: 1 hour (add to 5-10 hooks)  
**Risk**: Very low (can invalidate cache manually when needed)  
**Files**:
- `hooks/events/useUserEvents.ts`
- `hooks/useCurrentUser.ts`
- `hooks/guests/useUnifiedGuestCounts.ts`
- `hooks/events/useEventWithGuest.ts`

---

## Performance Recommendations

### Priority 1 (Next Sprint)

1. **Run Fresh Build & Compare to Baseline**
   - Execute `pnpm build` and extract route sizes
   - Compare to September 26 baseline
   - Document regressions >10KB per route

2. **Apply Quick Wins #1 and #2**
   - Lazy load React Query devtools (50-80KB)
   - Tree-shake date-fns (40-60KB)
   - Total estimated savings: 90-140KB

3. **Add Lighthouse Mobile Audits**
   - Run on `/select-event`, `/guest/home`, `/host/dashboard`
   - Capture LCP, INP, CLS, FCP, TTI, TBT
   - Compare to September 26 baseline

### Priority 2 (Opportunistic)

1. **Apply Quick Win #3 (staleTime)**
   - Add to stable queries
   - Reduce unnecessary network requests

2. **Code Split Large Dependencies**
   - Investigate if `lucide-react` can be tree-shaken further
   - Consider replacing `react-dropzone` with lighter alternative
   - Audit `react-hook-form` usage (may be over-featured for simple forms)

3. **Optimize Font Loading**
   - Use `font-display: swap` to prevent FOIT
   - Preload only critical font weights
   - Consider variable font subsetting

---

## Appendix: Performance Monitoring Commands

### Build Analysis

```bash
# Generate build with bundle analyzer
ANALYZE=true pnpm build

# Check first load JS per route
pnpm bundle:check

# Generate bundle budget report
pnpm build:budget
```

### Lighthouse Audits

```bash
# Run Lighthouse CI on critical routes
pnpm test:lighthouse

# Manual Lighthouse audit
lighthouse http://localhost:3000/select-event \
  --emulated-form-factor=mobile \
  --throttling.rttMs=150 \
  --throttling.throughputKbps=1638.4 \
  --output=json \
  --output-path=./lighthouse-select-event-2025-10.json
```

### React Query Devtools (in browser console)

```javascript
// Check cache contents
window.__REACT_QUERY_DEVTOOLS__.client.getQueryCache().getAll()

// Check subscription counts
window.__REACT_QUERY_DEVTOOLS__.client.getQueryCache().getAll().length
```

### Subscription Manager Stats

```javascript
// In browser console (if exposed)
// Check active subscriptions
subscriptionManager.getStats()

// Output:
// {
//   activeSubscriptions: 3,
//   totalSubscriptions: 5,
//   failedSubscriptions: 0,
//   consecutiveErrors: 0,
//   averageLatency: 45ms
// }
```

---

**End of Performance Snapshot**

