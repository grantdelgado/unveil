# Prioritized Action Plan — October 16, 2025

**Review Date**: October 16, 2025  
**Source**: Full App & DB Review  
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

### ✅ P0-1: SECURITY DEFINER Search Path Protection — COMPLETE

**Status**: ✅ All 84 SECURITY DEFINER functions already have proper `SET search_path` protection.

**Verification Date**: October 17, 2025

**See**: `2025-10-17-p0-1-security-audit-complete.md` for full audit report.

---

### ✅ P1-1: Compound Cursor for Message Pagination — COMPLETE

**Status**: ✅ Compound cursor `(created_at, id)` is fully implemented in `get_guest_event_messages_v3` and used by client hook.

**Verification Date**: October 17, 2025

**Implementation Details**:
- Database RPC accepts `p_cursor_created_at` and `p_cursor_id` parameters
- WHERE clause uses compound logic (backward compatible with legacy `p_before`)
- Client hook tracks `compoundCursor: { created_at, id }`
- Composite index exists: `idx_messages_event_created_id`

**See**: `2025-10-17-compound-cursor-status.md` for verification details.

---

## P0 Items (Fix Immediately)

### ✅ No P0 Items Remaining

All critical security and data integrity issues have been resolved. The original P0-1 item was already fixed in January 2025 migrations.

---

## P1 Items (Next Sprint)

### ~~P1-1: Compound Cursor~~ — ✅ ALREADY COMPLETE

(Moved to "Completed Items" section above)

---

### P1-2: Add [TELEMETRY] Markers to Critical RPCs

**Problem**: Logger infrastructure exists but key metrics missing in production RPCs, hampering debugging.

**Impact**: 3/5 — Observability gap

**Files to Modify**:
1. `hooks/messaging/useGuestMessagesRPC.ts`
2. `hooks/events/useUserEvents.ts`
3. `lib/realtime/SubscriptionManager.ts`

**Implementation Steps**:

**Implementation Steps**:

1. **Update RPC Signature** (1 hour):
```sql
-- Create new version of function with compound cursor
CREATE OR REPLACE FUNCTION public.get_guest_event_messages_v2(
    p_event_id uuid,
    p_limit int DEFAULT 50,
    p_before_timestamp timestamptz DEFAULT NULL,
    p_before_id uuid DEFAULT NULL
)
RETURNS TABLE(
    message_id uuid,
    content text,
    created_at timestamptz,
    delivery_status text,
    sender_name text,
    sender_avatar_url text,
    message_type text,
    is_own_message boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id uuid;
    guest_record RECORD;
BEGIN
    -- ... existing auth checks ...
    
    RETURN QUERY
    WITH user_messages AS (
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            md.sms_status as delivery_status,
            COALESCE(u.full_name, 'Host') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            false as is_own_message
        FROM public.message_deliveries md
        JOIN public.messages m ON m.id = md.message_id
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE md.user_id = current_user_id
        AND m.event_id = p_event_id
        AND (
            -- Compound cursor logic
            p_before_timestamp IS NULL
            OR m.created_at < p_before_timestamp
            OR (m.created_at = p_before_timestamp AND m.id < p_before_id)
        )
        
        UNION ALL
        
        SELECT DISTINCT
            m.id as message_id,
            m.content,
            m.created_at,
            'sent'::text as delivery_status,
            COALESCE(u.full_name, guest_record.guest_name, 'You') as sender_name,
            u.avatar_url as sender_avatar_url,
            m.message_type::text,
            true as is_own_message
        FROM public.messages m
        LEFT JOIN public.users u ON u.id = m.sender_user_id
        WHERE m.sender_user_id = current_user_id
        AND m.event_id = p_event_id
        AND (
            p_before_timestamp IS NULL
            OR m.created_at < p_before_timestamp
            OR (m.created_at = p_before_timestamp AND m.id < p_before_id)
        )
    )
    SELECT 
        um.message_id,
        um.content,
        um.created_at,
        um.delivery_status,
        um.sender_name,
        um.sender_avatar_url,
        um.message_type,
        um.is_own_message
    FROM user_messages um
    ORDER BY um.created_at DESC, um.message_id DESC
    LIMIT p_limit;
END;
$$;

-- Create alias for backwards compatibility
CREATE OR REPLACE FUNCTION public.get_guest_event_messages(
    p_event_id uuid,
    p_limit int DEFAULT 50,
    p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(...) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.get_guest_event_messages_v2(p_event_id, p_limit, p_before, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

2. **Update Client Hook** (2 hours):
```typescript
// hooks/messaging/useGuestMessagesRPC.ts

interface CompoundCursor {
  created_at: string;
  id: string;
}

// Update state to track compound cursor
const [compoundCursor, setCompoundCursor] = useState<CompoundCursor | null>(null);

// Update fetchOlderMessages to use compound cursor
const fetchOlderMessages = async () => {
  if (!hasMore || isFetchingOlder) return;
  
  setIsFetchingOlder(true);
  
  try {
    const { data, error } = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: eventId,
      p_limit: 50,
      p_before_timestamp: compoundCursor?.created_at || null,
      p_before_id: compoundCursor?.id || null,
    });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const oldestMessage = data[data.length - 1];
      setCompoundCursor({
        created_at: oldestMessage.created_at,
        id: oldestMessage.message_id,
      });
      
      // Merge messages with deduplication
      dispatch({
        type: 'ADD_MESSAGES',
        payload: data,
        hasMore: data.length === 50,
      });
    } else {
      setHasMore(false);
    }
  } catch (err) {
    logger.error('Failed to fetch older messages', err);
  } finally {
    setIsFetchingOlder(false);
  }
};
```

3. **Create Test Cases** (1 hour):
```typescript
// __tests__/messaging/pagination-compound-cursor.test.ts

describe('Compound Cursor Pagination', () => {
  test('handles messages with identical timestamps', async () => {
    const timestamp = '2025-10-16T12:00:00Z';
    
    // Insert 3 messages with same timestamp
    await supabase.from('messages').insert([
      { id: 'msg-1', event_id: testEventId, created_at: timestamp, content: 'A' },
      { id: 'msg-2', event_id: testEventId, created_at: timestamp, content: 'B' },
      { id: 'msg-3', event_id: testEventId, created_at: timestamp, content: 'C' },
    ]);
    
    // Fetch first page (limit: 2)
    const page1 = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 2,
      p_before_timestamp: null,
      p_before_id: null,
    });
    
    expect(page1.data).toHaveLength(2);
    
    // Fetch second page with compound cursor
    const lastMessage = page1.data[1];
    const page2 = await supabase.rpc('get_guest_event_messages_v2', {
      p_event_id: testEventId,
      p_limit: 2,
      p_before_timestamp: lastMessage.created_at,
      p_before_id: lastMessage.message_id,
    });
    
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].message_id).not.toBe(lastMessage.message_id);
    
    // Verify no duplicates across pages
    const allIds = [...page1.data, ...page2.data].map(m => m.message_id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
```

4. **Deploy & Monitor** (30 min):
```bash
# Apply migration
supabase db push

# Monitor query performance
# Run EXPLAIN ANALYZE on new RPC
# Check for index usage on (created_at, id) columns
```

**Rollback Plan**:
```sql
-- Keep old function as fallback
-- Revert client code to use get_guest_event_messages (v1)
ALTER FUNCTION public.get_guest_event_messages RENAME TO get_guest_event_messages_v1;
```

**Owner**: Backend team (RPC) + Frontend team (hook)  
**LOE**: M (Medium) — 4-5 hours total  
**Risk**: Low (backwards compatible, additive change)  
**Success Criteria**: No duplicate messages in pagination, stable ordering with concurrent inserts

---

### P1-2: Add [TELEMETRY] Markers to Critical RPCs

**Problem**: Logger infrastructure exists but key metrics missing in production RPCs, hampering debugging.

**Impact**: 3/5 — Observability gap

**Files to Modify**:
1. `hooks/messaging/useGuestMessagesRPC.ts`
2. `hooks/events/useUserEvents.ts`
3. `lib/realtime/SubscriptionManager.ts`

**Implementation Steps**:

1. **Add Telemetry to Messaging Hook** (1 hour):
```typescript
// hooks/messaging/useGuestMessagesRPC.ts

const fetchMessages = async () => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.rpc('get_guest_event_messages', {
      p_event_id: eventId,
      p_limit: 50,
      p_before: oldestMessageCursor,
    });
    
    if (error) throw error;
    
    // ✅ Add telemetry
    logger.performance('[TELEMETRY] messaging.rpc_v3_rows', {
      eventId: eventId.slice(0, 8) + '...', // Truncate UUID for privacy
      count: data?.length || 0,
      hasMore: (data?.length || 0) === 50,
      duration: Date.now() - startTime,
      cursor: oldestMessageCursor ? 'paginated' : 'initial',
    });
    
    // ... rest of function
  } catch (err) {
    logger.error('[TELEMETRY] messaging.rpc_v3_error', {
      eventId: eventId.slice(0, 8) + '...',
      error: err,
      duration: Date.now() - startTime,
    });
  }
};
```

2. **Add Telemetry to Events Hook** (30 min):
```typescript
// hooks/events/useUserEvents.ts

const fetchUserEvents = async () => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.rpc('get_user_events');
    
    if (error) throw error;
    
    // ✅ Add telemetry
    logger.performance('[TELEMETRY] events.user_events_count', {
      count: data?.length || 0,
      duration: Date.now() - startTime,
      hostCount: data?.filter(e => e.role === 'host').length || 0,
      guestCount: data?.filter(e => e.role === 'guest').length || 0,
    });
    
    setRawEvents(data || []);
  } catch (err) {
    logger.error('[TELEMETRY] events.user_events_error', {
      error: err,
      duration: Date.now() - startTime,
    });
  }
};
```

3. **Expand Subscription Manager Telemetry** (30 min):
```typescript
// lib/realtime/SubscriptionManager.ts

// Already has some telemetry, add more context
public subscribe(subscriptionId: string, config: SubscriptionConfig): () => void {
  const startTime = Date.now();
  
  try {
    // ... existing subscription logic ...
    
    // ✅ Add detailed telemetry
    logger.performance('[TELEMETRY] realtime.subscription_created', {
      subscriptionId: subscriptionId.slice(0, 20) + '...', // Truncate for logs
      table: config.table,
      event: config.event,
      duration: Date.now() - startTime,
      totalActive: this.subscriptions.size,
    });
    
    return () => {
      logger.performance('[TELEMETRY] realtime.subscription_removed', {
        subscriptionId: subscriptionId.slice(0, 20) + '...',
        lifetimeMs: Date.now() - startTime,
        totalActive: this.subscriptions.size - 1,
      });
      // ... existing cleanup ...
    };
  } catch (err) {
    logger.error('[TELEMETRY] realtime.subscription_error', {
      subscriptionId: subscriptionId.slice(0, 20) + '...',
      error: err,
    });
    throw err;
  }
}
```

4. **Verify in Development** (30 min):
```bash
# Start dev server with telemetry logging enabled
UNVEIL_DEBUG=true pnpm dev

# Open browser console
# Look for [TELEMETRY] logs
# Verify no PII is logged (UUIDs truncated, no phone numbers)
```

**Rollback Plan**: Remove `logger.performance` calls if logs are too noisy (no breaking changes)

**Owner**: Full-stack team  
**LOE**: S (Small) — 2-3 hours total  
**Risk**: None (logging only, no behavior change)  
**Success Criteria**: [TELEMETRY] markers visible in production logs, no PII leakage

---

### P1-3: Validate All RLS Policies Check `removed_at`

**Problem**: Not all RLS policies on `event_guests` table check `removed_at IS NULL`, potentially allowing removed guests to access event data.

**Impact**: 4/5 — Security leak

**Files to Modify**:
```
supabase/migrations/20250128000001_cleanup_rls_policies.sql
```

**Implementation Steps**:

1. **Audit Current Policies** (30 min):
```sql
-- List all policies on event_guests
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'event_guests';

-- Check if removed_at is mentioned in qual (USING clause)
```

2. **Create Fix Migration** (1 hour):
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

-- Add comment for documentation
COMMENT ON POLICY "event_guests_own_access" ON public.event_guests IS
'Guests can access their own records, but only if not removed (removed_at IS NULL)';

COMMIT;
```

3. **Create Test Cases** (1 hour):
```typescript
// tests/security/removed-guest-access.spec.ts

describe('Removed Guest Access Control', () => {
  let testEventId: string;
  let testGuestId: string;
  let testUserId: string;
  
  beforeAll(async () => {
    // Create test event and guest
    const { data: event } = await supabase
      .from('events')
      .insert({ title: 'Test Event', event_date: '2025-12-01' })
      .select()
      .single();
    
    testEventId = event.id;
    
    const { data: guest } = await supabase
      .from('event_guests')
      .insert({ event_id: testEventId, guest_name: 'Removed Guest' })
      .select()
      .single();
    
    testGuestId = guest.id;
  });
  
  test('removed guest cannot read event_guests table', async () => {
    // Remove guest
    await supabase
      .from('event_guests')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', testGuestId);
    
    // Attempt to read as removed guest (simulate with RLS)
    const { data, error } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', testEventId);
    
    // Removed guest should not see any records (including their own)
    expect(data).toEqual([]);
  });
  
  test('removed guest cannot access messages via get_guest_event_messages', async () => {
    // Attempt to call RPC as removed guest
    const { data, error } = await supabase.rpc('get_guest_event_messages', {
      p_event_id: testEventId,
      p_limit: 50,
      p_before: null,
    });
    
    // Should raise exception: "User has been removed from this event"
    expect(error).toBeDefined();
    expect(error.message).toContain('removed');
  });
});
```

4. **Deploy & Verify** (30 min):
```bash
# Apply migration
supabase db push

# Run security tests
pnpm test:e2e -- tests/security/removed-guest-access.spec.ts
```

**Rollback Plan**:
```sql
-- Revert to previous policies (without removed_at check)
-- Keep old migration as backup
```

**Owner**: Database/Backend team  
**LOE**: M (Medium) — 3-4 hours total  
**Risk**: Low (tightening security, no functionality regression)  
**Success Criteria**: Removed guests cannot access event data via RLS policies or RPCs

---

### P1-4: Bundle Size Optimization — React Query Devtools

**Problem**: React Query devtools may be loading in production, adding 50-80KB to bundle.

**Impact**: 3/5 — Performance degradation on mobile

**Files to Modify**:
1. `lib/react-query-client.tsx`

**Implementation Steps**:

1. **Conditional Import of Devtools** (30 min):
```typescript
// lib/react-query-client.tsx

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { ReactNode, useState } from 'react';

// ✅ Only load devtools in development
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () =>
          import('@tanstack/react-query-devtools').then((mod) => ({
            default: mod.ReactQueryDevtools,
          })),
        { ssr: false }
      )
    : () => null;

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

2. **Build & Compare Bundle Sizes** (30 min):
```bash
# Before optimization
pnpm build
cat .next/build-manifest.json | jq '.pages["/select-event"]' > before.json

# After optimization (apply code above)
pnpm build
cat .next/build-manifest.json | jq '.pages["/select-event"]' > after.json

# Compare
diff before.json after.json
```

3. **Test in Production Mode** (15 min):
```bash
# Build and start production server
pnpm build && pnpm start

# Open browser, check Network tab
# Verify devtools.js is NOT loaded
# Verify app still functions correctly
```

**Rollback Plan**: Revert to previous `lib/react-query-client.tsx` (git revert)

**Owner**: Frontend team  
**LOE**: S (Small) — 1-2 hours total  
**Risk**: Very low (dev-only feature removal from prod)  
**Success Criteria**: Bundle size reduced by 50-80KB, devtools still work in development

---

## P2 Items (Opportunistic / Tech Debt)

### P2-1: Standardize Error Messages Across Auth Flow

**Problem**: Generic error messages ("An unexpected error occurred") in auth flow don't guide users.

**Impact**: 2/5 — UX polish

**Files**: `app/(auth)/login/page.tsx`

**Implementation** (2 hours):
```typescript
// Create error message mapping
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'invalid_otp': 'The verification code you entered is incorrect. Please try again.',
  'expired_otp': 'Your verification code has expired. Please request a new one.',
  'rate_limit_exceeded': 'Too many attempts. Please wait 1 minute and try again.',
  'phone_not_authorized': 'This phone number is not authorized for this event. Contact the host for assistance.',
  'network_error': 'Unable to connect. Please check your internet connection and try again.',
};

// Use in error handler
if (error) {
  const userFriendlyMessage = AUTH_ERROR_MESSAGES[error.code] || 
    'Something went wrong. Please try again or contact support if the issue persists.';
  setError(userFriendlyMessage);
}
```

**Owner**: Frontend team  
**LOE**: S (Small) — 2 hours  
**Success Criteria**: All auth errors have specific, actionable messages

---

### P2-2: Add Index on `message_deliveries(message_id, user_id)`

**Problem**: Missing index for message delivery status lookups.

**Impact**: 2/5 — Query performance optimization

**Implementation** (30 min):
```sql
-- supabase/migrations/20251017000002_add_delivery_message_user_index.sql

CREATE INDEX IF NOT EXISTS idx_md_message_user 
ON public.message_deliveries(message_id, user_id)
WHERE message_id IS NOT NULL AND user_id IS NOT NULL;

COMMENT ON INDEX idx_md_message_user IS
'Optimizes message delivery status lookups by message and user';
```

**Owner**: Database team  
**LOE**: S (Small) — 30 minutes  
**Success Criteria**: Index created, query plans use new index for delivery lookups

---

### P2-3: Document Realtime Subscription Lifecycle

**Problem**: Complex SubscriptionProvider/Manager code lacks documentation.

**Impact**: 2/5 — Developer onboarding

**Implementation** (2 hours):
- Create `docs/architecture/realtime-subscriptions.md`
- Document `isReady` && `manager` pattern
- Explain cold reconnect logic
- Add diagrams for subscription lifecycle

**Owner**: Documentation/Full-stack team  
**LOE**: S (Small) — 2 hours  
**Success Criteria**: New developers can understand realtime setup without code dive

---

### P2-4: Tree-Shake `date-fns` Library

**Problem**: Full `date-fns` library imported instead of individual functions.

**Impact**: 2/5 — Bundle size (40-60KB potential savings)

**Implementation** (2 hours):
```typescript
// Before (if found)
import * as dateFns from 'date-fns';

// After
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
```

**Files to Audit**:
```bash
# Find all date-fns imports
grep -r "import.*date-fns" --include="*.ts" --include="*.tsx"
```

**Owner**: Frontend team  
**LOE**: S (Small) — 2 hours  
**Success Criteria**: All date-fns imports use specific functions, bundle size reduced

---

### P2-5: Add `staleTime` to Stable React Queries

**Problem**: Queries refetch on every mount even for stable data.

**Impact**: 2/5 — Network request reduction

**Implementation** (1 hour):
```typescript
// hooks/events/useUserEvents.ts
const { data: events } = useQuery({
  queryKey: ['user-events', userId],
  queryFn: fetchUserEvents,
  staleTime: 60_000, // ✅ Add 1-minute staleTime
});

// hooks/useCurrentUser.ts
const { data: user } = useQuery({
  queryKey: ['current-user'],
  queryFn: fetchCurrentUser,
  staleTime: 300_000, // ✅ Add 5-minute staleTime (user profile changes rarely)
});

// hooks/guests/useUnifiedGuestCounts.ts
const { data: counts } = useQuery({
  queryKey: ['guest-counts', eventId],
  queryFn: fetchGuestCounts,
  staleTime: 30_000, // ✅ Add 30-second staleTime
});
```

**Owner**: Frontend team  
**LOE**: S (Small) — 1 hour  
**Success Criteria**: 10-20% fewer network requests, faster perceived performance

---

## Implementation Roadmap

### Week 1 (P0 Items)

**Day 1-2**: Complete SECURITY DEFINER search_path audit
- Run verification query
- Create fix migration
- Test with malicious schema
- Deploy to staging → production

**Day 3**: Review and plan P1 items
- Triage based on team capacity
- Assign owners
- Schedule implementation

---

### Week 2 (P1 Items — Part 1)

**Day 1-2**: Implement compound cursor pagination
- Update RPC function
- Update client hook
- Create test cases
- Deploy to staging

**Day 3**: Add telemetry markers
- Update messaging, events, and realtime hooks
- Verify in development
- Deploy to production

**Day 4**: Validate RLS policies for removed_at
- Audit policies
- Create fix migration
- Test removed guest access
- Deploy to staging → production

**Day 5**: Optimize React Query devtools
- Conditional import
- Build and compare bundle sizes
- Deploy to production

---

### Week 3+ (P2 Items — Opportunistic)

- Standardize auth error messages (2 hours)
- Add delivery index (30 min)
- Document realtime subscriptions (2 hours)
- Tree-shake date-fns (2 hours)
- Add staleTime to queries (1 hour)

**Total P2 effort**: ~7-8 hours (can be distributed across sprints)

---

## Success Metrics

### P0 Metrics
- ✅ Zero SECURITY DEFINER functions without search_path protection
- ✅ Penetration test passes (malicious schema attack fails)

### P1 Metrics
- ✅ Message pagination stable with concurrent inserts (no duplicates)
- ✅ [TELEMETRY] markers visible in production logs
- ✅ Removed guests cannot access event data (RLS + RPC tests pass)
- ✅ Bundle size reduced by 50-80KB (React Query devtools)

### P2 Metrics
- ✅ Auth error messages are specific and actionable
- ✅ Query performance improved for delivery lookups
- ✅ Realtime documentation complete
- ✅ Bundle size reduced by 40-60KB (date-fns tree-shaking)
- ✅ Network requests reduced by 10-20% (staleTime)

---

## Risk Mitigation

### Deployment Strategy

1. **Staging First**: All P0/P1 changes deploy to staging for 24 hours
2. **Gradual Rollout**: Production deployment in phases (10% → 50% → 100%)
3. **Rollback Plan**: Each item has documented rollback SQL/code
4. **Monitoring**: Watch error rates, query performance, bundle sizes

### Communication Plan

1. **Before Deployment**: Notify team of upcoming changes
2. **During Deployment**: Post in team chat when changes go live
3. **After Deployment**: Report success metrics and any issues

---

**End of Action Plan**

