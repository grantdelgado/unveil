# Prioritized Action Plan — October 17, 2025 (Updated)

**Review Date**: October 16-17, 2025  
**Last Updated**: October 17, 2025  
**Source**: Full App & DB Review + Live Database Verification  
**Format**: P0/P1/P2 prioritized with owners, LOE, and implementation details

---

## Priority Legend

- **P0 (Fix Immediately)**: User-visible pain, security risk, or data integrity issue
- **P1 (Next Sprint)**: Performance degradation, UX polish, or technical debt causing friction
- **P2 (Opportunistic)**: Nice-to-haves, optimizations, or documentation improvements

**LOE (Level of Effort)**:
- **S (Small)**: 1-3 hours
- **M (Medium)**: 4-8 hours
- **L (Large)**: 9+ hours or multi-day

---

## ✅ Completed Items (Already Implemented)

### ✅ P0-1: SECURITY DEFINER Search Path Protection

**Status**: ✅ COMPLETE — All 84 SECURITY DEFINER functions have proper `SET search_path` protection

**Verification**: Live database query (October 17, 2025) confirmed zero unprotected functions

**Report**: `docs/reviews/2025-10-17-p0-1-security-audit-complete.md`

---

### ✅ P1-1: Compound Cursor for Message Pagination

**Status**: ✅ COMPLETE — Compound cursor `(created_at, id)` fully implemented in v3 RPC

**Verification**: Database RPC uses compound WHERE logic, client hook tracks both cursor fields

**Report**: `docs/reviews/2025-10-17-compound-cursor-status.md`

---

## P0 Items (Fix Immediately)

### ✅ No P0 Items Remaining

All critical security and data integrity issues are resolved. System is production-ready.

---

## P1 Items (Next Sprint)

### P1-2: Add [TELEMETRY] Markers to Critical RPCs

**Problem**: Logger infrastructure exists but key production metrics missing, hampering debugging.

**Impact**: 3/5 — Observability gap

**Files to Modify**:
1. `hooks/messaging/useGuestMessagesRPC.ts`
2. `hooks/events/useUserEvents.ts`
3. `lib/realtime/SubscriptionManager.ts` (expand existing)

**Implementation**:

```typescript
// 1. In useGuestMessagesRPC after RPC call
const startTime = Date.now();
const { data, error } = await supabase.rpc('get_guest_event_messages', {...});

logger.performance('[TELEMETRY] messaging.rpc_v3_rows', {
  eventId: eventId.slice(0, 8) + '...',
  count: data?.length || 0,
  hasMore: (data?.length || 0) > BATCH_SIZE,
  duration: Date.now() - startTime,
  cursorType: compoundCursor ? 'compound' : 'initial',
});

// 2. In useUserEvents after RPC call
logger.performance('[TELEMETRY] events.user_events_count', {
  count: data?.length || 0,
  duration: Date.now() - startTime,
  hostCount: data?.filter(e => e.role === 'host').length || 0,
  guestCount: data?.filter(e => e.role === 'guest').length || 0,
});

// 3. In SubscriptionManager.subscribe() (expand existing telemetry)
logger.performance('[TELEMETRY] realtime.subscription_created', {
  subscriptionId: subscriptionId.slice(0, 20) + '...',
  table: config.table,
  totalActive: this.subscriptions.size,
});
```

**Owner**: Full-stack team  
**LOE**: S (Small) — 2-3 hours  
**Risk**: None (logging only)  
**Success Criteria**: [TELEMETRY] markers visible in production logs, no PII

---

### P1-3: Validate All RLS Policies Check `removed_at`

**Problem**: Some RLS policies on `event_guests` may not check `removed_at IS NULL`, allowing removed guests to access event data.

**Impact**: 4/5 — Potential security leak

**Files to Modify**: Create new migration

**Implementation**:

```sql
-- supabase/migrations/20251017000001_fix_removed_at_rls_policies.sql

BEGIN;

-- Drop existing policies that don't check removed_at
DROP POLICY IF EXISTS "event_guests_own_access" ON public.event_guests;
DROP POLICY IF EXISTS "event_guests_read_event_access" ON public.event_guests;

-- Recreate with removed_at check
CREATE POLICY "event_guests_own_access" ON public.event_guests
  FOR ALL TO authenticated, anon
  USING (
    removed_at IS NULL AND (
      user_id = auth.uid()
      OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
    )
  );

CREATE POLICY "event_guests_read_event_access" ON public.event_guests
  FOR SELECT TO authenticated, anon
  USING (
    removed_at IS NULL AND can_access_event(event_id)
  );

COMMIT;
```

**Test Strategy**:
```typescript
// Create test: removed guest cannot access event_guests table
test('removed guest access denied', async () => {
  // Remove guest
  await supabase.from('event_guests').update({ removed_at: new Date() }).eq('id', guestId);
  
  // Attempt to read (should fail or return empty)
  const { data } = await supabase.from('event_guests').select('*').eq('id', guestId);
  expect(data).toEqual([]);
});
```

**Owner**: Database/Backend team  
**LOE**: M (Medium) — 3-4 hours  
**Risk**: Low (tightening security)

---

### P1-4: Bundle Size Optimization — React Query Devtools

**Problem**: React Query devtools may be loading in production, adding 50-80KB.

**Impact**: 3/5 — Performance degradation on mobile

**Files to Modify**: `lib/react-query-client.tsx`

**Implementation**:

```typescript
// Conditional import of devtools
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () => import('@tanstack/react-query-devtools').then((mod) => ({
          default: mod.ReactQueryDevtools,
        })),
        { ssr: false }
      )
    : () => null;

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

**Verification**:
```bash
# Before/after bundle size comparison
pnpm build
# Check .next/build-manifest.json or terminal output
```

**Owner**: Frontend team  
**LOE**: S (Small) — 1-2 hours  
**Risk**: Very low (dev-only feature)  
**Expected Savings**: 50-80KB gzipped

---

## P2 Items (Opportunistic)

### P2-1: Standardize Auth Error Messages

**Impact**: 2/5 — UX polish  
**LOE**: S (Small) — 2 hours  
**Files**: `app/(auth)/login/page.tsx`

Map Supabase error codes to user-friendly messages.

---

### P2-2: Add Index on `message_deliveries(message_id, user_id)`

**Impact**: 2/5 — Query performance  
**LOE**: S (Small) — 30 minutes

```sql
CREATE INDEX IF NOT EXISTS idx_md_message_user 
ON public.message_deliveries(message_id, user_id)
WHERE message_id IS NOT NULL AND user_id IS NOT NULL;
```

---

### P2-3: Document Realtime Subscription Lifecycle

**Impact**: 2/5 — Developer onboarding  
**LOE**: S (Small) — 2 hours

Create `docs/architecture/realtime-subscriptions.md` with lifecycle diagrams.

---

### P2-4: Tree-Shake `date-fns` Library

**Impact**: 2/5 — Bundle size (40-60KB savings)  
**LOE**: S (Small) — 2 hours

Replace full imports with specific function imports:
```typescript
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
```

---

### P2-5: Add `staleTime` to Stable React Queries

**Impact**: 2/5 — Network request reduction  
**LOE**: S (Small) — 1 hour

Add 60-second staleTime to user events and profile queries.

---

## Implementation Roadmap (Updated)

### Week 1 (October 21-25)

**✅ P0/P1 Critical Items: Already Complete**

Focus on remaining P1 items based on team capacity:

**Option A (Performance Focus)**:
- Day 1: P1-4 Bundle optimization (1-2 hours)
- Day 2: P2-4 Tree-shake date-fns (2 hours)
- Day 3: P2-5 Add staleTime (1 hour)
- **Total savings**: ~90-140KB bundle size + reduced network requests

**Option B (Security Hardening)**:
- Day 1-2: P1-3 RLS policy fixes (3-4 hours)
- Day 3: P1-2 Telemetry markers (2-3 hours)
- **Benefit**: Tighter security + better production debugging

**Option C (Documentation)**:
- Day 1-2: Generate UX snapshots (3.5 hours)
- Day 3: P2-3 Document realtime (2 hours)
- **Benefit**: Better onboarding + visual regression tracking

---

### Week 2+ (November)

Address remaining P2 items opportunistically:
- Auth error messages (2 hours)
- Delivery index (30 min)
- Additional performance tuning

---

## Success Metrics

### Completed ✅
- ✅ Zero SECURITY DEFINER functions without search_path protection
- ✅ Compound cursor prevents pagination duplicates/gaps
- ✅ Composite index optimizes pagination queries

### Remaining (P1)
- [ ] [TELEMETRY] markers in production logs
- [ ] Removed guests blocked by RLS policies
- [ ] Bundle size reduced by 50-80KB (devtools)

### Optional (P2)
- [ ] Auth errors are specific and actionable
- [ ] date-fns tree-shaken (40-60KB savings)
- [ ] Network requests reduced by 10-20%

---

## Risk Mitigation

All remaining items are **low-risk optimizations**:
- P1-2: Logging only (no behavior change)
- P1-3: Tightening security (fail-safe direction)
- P1-4: Removing dev feature from prod (isolated change)
- P2 items: Non-critical enhancements

**No rollback complexity** — All changes are additive or isolated.

---

**End of Updated Action Plan**

