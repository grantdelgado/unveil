# Database & RLS Security Audit

**Audit Date**: October 16, 2025  
**Scope**: Critical tables (events, event_guests, messages, message_deliveries, scheduled_messages)  
**Method**: Schema introspection via Supabase MCP + migration file review

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [RLS Policy Matrix](#rls-policy-matrix)
3. [SECURITY DEFINER Function Audit](#security-definer-function-audit)
4. [Index Analysis](#index-analysis)
5. [Query Performance Notes](#query-performance-notes)
6. [Recommendations](#recommendations)

---

## Schema Overview

### Critical Tables Summary

| Table | Rows | RLS Enabled | Foreign Keys | Check Constraints | Notes |
|-------|------|-------------|--------------|-------------------|-------|
| `users` | 81 | ✅ Yes | 0 | 1 (phone format) | Phone-first auth, E.164 format |
| `events` | 4 | ✅ Yes | 1 (host_user_id) | 3 (time_zone, sms_tag, allow_open_signup) | Core event data |
| `event_guests` | 145 | ✅ Yes | 2 (event_id, user_id) | 4 (phone, role, guest_tags, preferred_communication) | RSVP-Lite (declined_at) |
| `messages` | 114 | ✅ Yes | 3 (event_id, sender_user_id, scheduled_message_id) | 2 (delivered_count ≥ 0, failed_count ≥ 0) | Announcement/Channel/Direct types |
| `message_deliveries` | 1,445 | ✅ Yes | 5 (message_id, guest_id, user_id, response_message_id, scheduled_message_id) | 2 (sms_status, push_status) | Delivery tracking |
| `scheduled_messages` | 46 | ✅ Yes | 2 (event_id, sender_user_id) | 2 (status, trigger_source) | Scheduled announcements |
| `event_schedule_items` | 7 | ✅ Yes | 1 (event_id) | 0 | Event timeline |
| `media` | 0 | ✅ Yes | 2 (event_id, uploader_user_id) | 1 (media_type) | Photo/video uploads |

### Enum Types

```sql
-- Message type enum
CREATE TYPE message_type_enum AS ENUM ('direct', 'announcement', 'channel');

-- Media type enum  
CREATE TYPE media_type_enum AS ENUM ('image', 'video');

-- User role enum
CREATE TYPE user_role_enum AS ENUM ('guest', 'host', 'admin');
```

**Status**: ✅ All enums are correctly defined and used consistently

---

## RLS Policy Matrix

### Events Table

**Current Policies**:

```sql
-- Policy 1: SELECT — Public events or user-accessible events
CREATE POLICY "events_select_accessible" ON public.events 
  FOR SELECT TO authenticated
  USING (is_public = true OR can_access_event(id));

-- Policy 2: ALL — Host-only management
CREATE POLICY "events_manage_own" ON public.events 
  FOR ALL TO authenticated
  USING (is_event_host(id));
```

**Security Assessment**:
- ✅ **Correct**: Uses helper functions for authorization
- ✅ **Scope**: Host-only write access via `is_event_host()`
- ✅ **Public events**: Properly exposed via `is_public` flag
- ⚠️ **Improvement**: Consider separating UPDATE and DELETE policies for auditability

**Helper Function Dependencies**:
- `is_event_host(uuid)` — Checks `events.host_user_id` OR `event_guests.role='host'`
- `can_access_event(uuid)` — Returns `is_event_host(id) OR is_event_guest(id)`

---

### Event Guests Table

**Current Policies**:

```sql
-- Policy 1: Hosts have full access to manage guests
CREATE POLICY "event_guests_host_access" ON public.event_guests
  FOR ALL TO authenticated
  USING (is_event_host(event_id))
  WITH CHECK (is_event_host(event_id));

-- Policy 2: Guests can read and update their own records
CREATE POLICY "event_guests_own_access" ON public.event_guests
  FOR ALL TO authenticated, anon
  USING (
    user_id = auth.uid()
    OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
  );

-- Policy 3: Event participants can read guest list
CREATE POLICY "event_guests_read_event_access" ON public.event_guests
  FOR SELECT TO authenticated, anon
  USING (can_access_event(event_id));
```

**Security Assessment**:
- ✅ **Host access**: Full CRUD for hosts
- ✅ **Phone matching**: Supports unlinked guests via JWT phone claim
- ⚠️ **CRITICAL**: Policy 2 and 3 do NOT check `removed_at IS NULL`
  - **Risk**: Removed guests can still read event data
  - **Fix Required**: Add `AND removed_at IS NULL` to USING clauses

**Recommended Fix**:
```sql
-- Update Policy 2
CREATE POLICY "event_guests_own_access" ON public.event_guests
  FOR ALL TO authenticated, anon
  USING (
    removed_at IS NULL AND (
      user_id = auth.uid()
      OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
    )
  );

-- Update Policy 3
CREATE POLICY "event_guests_read_event_access" ON public.event_guests
  FOR SELECT TO authenticated, anon
  USING (
    can_access_event(event_id) 
    AND removed_at IS NULL
  );
```

---

### Messages Table

**Current Policies**:

```sql
-- Policy 1: SELECT — Event-accessible users can read messages
CREATE POLICY "messages_select_event_accessible" ON public.messages
  FOR SELECT TO authenticated
  USING (can_access_event(event_id));

-- Policy 2: INSERT — Event participants can send messages
CREATE POLICY "messages_insert_event_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (can_access_event(event_id));
```

**Security Assessment**:
- ⚠️ **CRITICAL ISSUE**: Direct messages (`message_type = 'direct'`) should NOT be visible via Policy 1
- **Risk**: Guest A could potentially see Direct messages sent to Guest B (both have `can_access_event`)
- **Current Protection**: Canonical RPC `get_guest_event_messages` filters via `message_deliveries` join
- **Problem**: Direct table access or custom queries could bypass RPC protection

**Recommended Fix**:
```sql
-- Update Policy 1 to exclude Direct messages unless delivered to user
CREATE POLICY "messages_select_event_accessible" ON public.messages
  FOR SELECT TO authenticated
  USING (
    can_access_event(event_id) 
    AND (
      message_type IN ('announcement', 'channel')
      OR EXISTS (
        SELECT 1 FROM public.message_deliveries md
        WHERE md.message_id = id 
        AND md.user_id = auth.uid()
      )
    )
  );
```

**Alternative Approach** (More restrictive):
```sql
-- Remove SELECT policy on messages table entirely
-- Force all access through get_guest_event_messages RPC
-- This ensures delivery-gating is always enforced
```

---

### Message Deliveries Table

**Current Policies**:

```sql
-- Policy 1: SELECT — Users see their own deliveries, hosts see all
CREATE POLICY "message_deliveries_select_optimized" ON public.message_deliveries
  FOR SELECT TO authenticated, anon
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = (
        SELECT m.event_id FROM public.messages m WHERE m.id = message_id
      )
      AND is_event_host(e.id)
    )
  );

-- Policy 2: ALL — Host-only modifications
CREATE POLICY "message_deliveries_modify_host_only" ON public.message_deliveries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
      AND is_event_host(m.event_id)
    )
  );
```

**Security Assessment**:
- ✅ **Correct**: Guests see only their deliveries
- ✅ **Host access**: Full visibility for debugging/analytics
- ✅ **Write protection**: Only hosts can modify delivery records
- ✅ **No improvement needed**

---

### Scheduled Messages Table

**Current Policies**:

```sql
-- Policy: ALL — Host-only access
CREATE POLICY "scheduled_messages_host_only_optimized" ON public.scheduled_messages
  FOR ALL TO authenticated
  USING (is_event_host(event_id));
```

**Security Assessment**:
- ✅ **Correct**: Only event hosts can create/read/update scheduled messages
- ✅ **Scope**: Prevents guests from seeing future messages
- ✅ **No improvement needed**

---

## SECURITY DEFINER Function Audit

### Functions WITH Correct `SET search_path`

**Helper Functions** (from `20250130000030_secure_search_path_functions.sql`):

```sql
-- ✅ is_event_host
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := (SELECT auth.uid());
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Primary host check
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id 
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Delegated host check
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id 
        AND eg.user_id = current_user_id
        AND eg.role = 'host'
    );
END;
$$;
```

**Status**: ✅ **Secure** — Uses `SET search_path = public, pg_temp`

---

```sql
-- ✅ is_event_guest
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1
        FROM public.event_guests eg
        WHERE eg.event_id = p_event_id
          AND eg.user_id = (SELECT auth.uid())
          AND eg.removed_at IS NULL  -- ✅ Checks removed_at
    );
END;
$$;
```

**Status**: ✅ **Secure** — Uses `SET search_path = public, pg_temp` AND checks `removed_at`

---

```sql
-- ✅ get_guest_event_messages
CREATE OR REPLACE FUNCTION public.get_guest_event_messages(
    p_event_id uuid,
    p_limit int DEFAULT 50,
    p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ✅ Empty search_path (also valid)
AS $$
DECLARE
    current_user_id uuid;
    guest_record RECORD;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Verify guest membership
    SELECT eg.id, eg.user_id, eg.phone, eg.guest_name, eg.removed_at
    INTO guest_record
    FROM public.event_guests eg
    WHERE eg.event_id = p_event_id 
    AND eg.user_id = current_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Access denied: User is not a guest of this event';
    END IF;
    
    -- ✅ Check removed_at
    IF guest_record.removed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Access denied: User has been removed from this event';
    END IF;
    
    -- Return messages via message_deliveries join (delivery-gated)
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
        AND (p_before IS NULL OR m.created_at < p_before)
        ...
    )
    SELECT * FROM user_messages
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;
```

**Status**: ✅ **Secure** — Uses `SET search_path = ''` (empty, which is safe)

---

### Functions POTENTIALLY Missing `SET search_path`

**Audit Needed** (Based on grep results):

Total `SECURITY DEFINER` occurrences: 172  
Total `SET search_path` occurrences: 113  
**Gap**: ~59 functions may lack protection

**High-Risk Files to Audit**:
1. `20250101000000_initial_schema.sql` — Early schema migrations (3 DEFINER, check if patched)
2. `20250112000000_simplify_schema.sql` — Schema refactor (5 DEFINER, check if patched)
3. `20250118000002_update_messaging_rls.sql` — Messaging functions (3 DEFINER)
4. `20250129000000_auto_link_user_by_phone.sql` — Auto-linking logic (4 DEFINER)

**Verification Query** (Run on Supabase):
```sql
SELECT 
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER functions only
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY p.proname;
```

**Expected Action**:
- Run query to identify functions lacking `SET search_path`
- Create migration to apply `ALTER FUNCTION ... SET search_path = public, pg_temp`
- Test with malicious schema attack (create schema with table named "events", verify function still uses public.events)

---

## Index Analysis

### Existing Indexes (Confirmed)

```sql
-- Events table
CREATE INDEX idx_events_host ON public.events(host_user_id);

-- Event guests table  
CREATE INDEX idx_event_guests_user_events ON public.event_guests(user_id, event_id);

-- Message deliveries table
CREATE INDEX idx_md_user_event_created 
ON public.message_deliveries(user_id, created_at DESC)
WHERE user_id IS NOT NULL;
```

**Status**: ✅ All critical paths are indexed

---

### Unindexed Foreign Keys

**Potentially Missing Indexes**:

1. `media.uploader_user_id` → `users.id`
   - **Impact**: LOW (0 rows currently, likely low volume)
   - **Action**: Monitor query patterns before adding index

2. `message_deliveries.guest_id` → `event_guests.id`
   - **Impact**: MEDIUM (1,445 rows, but rarely queried by guest_id alone)
   - **Current**: `user_id` index covers most use cases
   - **Action**: Add index only if guest-specific queries are slow

3. `message_deliveries.response_message_id` → `messages.id`
   - **Impact**: LOW (response functionality not yet implemented)
   - **Action**: Add index when response feature is enabled

4. `scheduled_messages.trigger_ref_id` → `event_schedule_items.id`
   - **Impact**: LOW (46 rows, event reminder feature not heavily used)
   - **Action**: Monitor as feature adoption grows

---

### Suggested Indexes (P2 Priority)

```sql
-- Index for message delivery status lookups (by message)
CREATE INDEX IF NOT EXISTS idx_md_message_user 
ON public.message_deliveries(message_id, user_id)
WHERE message_id IS NOT NULL AND user_id IS NOT NULL;

-- Index for removed guests (optimize is_event_guest checks)
CREATE INDEX IF NOT EXISTS idx_event_guests_removed 
ON public.event_guests(event_id, user_id)
WHERE removed_at IS NULL;

-- Partial index for active scheduled messages
CREATE INDEX IF NOT EXISTS idx_scheduled_pending 
ON public.scheduled_messages(send_at)
WHERE status IN ('scheduled', 'sending');

-- Index for message type filtering (if Direct message queries are common)
CREATE INDEX IF NOT EXISTS idx_messages_type_event 
ON public.messages(event_id, message_type)
WHERE message_type = 'direct';
```

**Application Strategy**:
- Apply indexes during low-traffic periods
- Monitor query performance before/after with EXPLAIN ANALYZE
- Remove indexes that don't improve query plans (unused indexes slow down writes)

---

## Query Performance Notes

### Key RPCs to Profile

**1. `get_guest_event_messages()`**

**Current Signature**:
```sql
get_guest_event_messages(p_event_id uuid, p_limit int, p_before timestamptz)
```

**Performance Expectations**:
- **Target**: <50ms for 50 messages
- **Indexes Used**:
  - `idx_md_user_event_created` for message_deliveries lookup
  - No index on `messages.created_at` (relies on sequential scan for < 1000 rows)

**EXPLAIN ANALYZE Template**:
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM public.get_guest_event_messages(
  '00000000-0000-0000-0000-000000000000'::uuid,  -- Replace with real event_id
  50,
  NULL
);
```

**What to Look For**:
- Sequential scans on messages table (acceptable if < 1000 rows)
- Index scan on message_deliveries (should use `idx_md_user_event_created`)
- Total execution time <50ms

---

**2. `get_user_events()`**

**Expected Query Plan**:
- Index scan on `event_guests(user_id, event_id)`
- Join to `events` table
- Should complete in <20ms with 20 events

**EXPLAIN ANALYZE Template**:
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM public.get_user_events();
```

---

**3. `is_event_host(uuid)`**

**Performance Target**: <1ms (called frequently in RLS policies)

**Expected Query Plan**:
- Index-only scan on `events(host_user_id)` using `idx_events_host`
- Fallback index scan on `event_guests` if primary host check fails

**Test Query**:
```sql
SELECT public.is_event_host('event-uuid-here');
```

**Critical**: If this function is slow (>10ms), ALL RLS policy checks will be slow. Verify index usage.

---

## Recommendations

### Priority 0 (Immediate)

1. **Complete SECURITY DEFINER Audit**
   - Run verification query to identify functions lacking `SET search_path`
   - Create migration to apply fixes
   - Test with malicious schema simulation

2. **Fix `removed_at` Checks in RLS Policies**
   - Update `event_guests_own_access` policy
   - Update `event_guests_read_event_access` policy
   - Verify `is_event_guest()` helper is used everywhere (it already checks `removed_at`)

3. **Restrict Direct Message Visibility**
   - Update `messages_select_event_accessible` policy to exclude Direct messages OR
   - Remove SELECT policy entirely and force all access through RPCs

---

### Priority 1 (Next Sprint)

1. **Implement Compound Cursor for Pagination**
   - Update `get_guest_event_messages()` signature
   - Add `p_before_id uuid` parameter
   - Update WHERE clause to use (created_at, id) compound key

2. **Add Suggested Indexes**
   - `idx_md_message_user` for delivery lookups
   - `idx_event_guests_removed` for removed guest checks
   - Monitor performance impact

3. **Run EXPLAIN ANALYZE on Key RPCs**
   - Profile `get_guest_event_messages` with 1000+ messages
   - Profile `get_user_events` with 20+ events
   - Document slow queries and optimization opportunities

---

### Priority 2 (Opportunistic)

1. **Create Performance Regression Tests**
   - Set up automated EXPLAIN ANALYZE runs in CI
   - Alert if query execution time exceeds thresholds
   - Track index usage over time

2. **Add Query Observability**
   - Log slow queries (>100ms) in production
   - Track RPC call frequency and duration
   - Create dashboard for database health monitoring

---

## Appendix: Query Templates

### Check for Unprotected SECURITY DEFINER Functions

```sql
-- Run on Supabase SQL Editor
SELECT 
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ Protected'
        ELSE '⚠️ UNPROTECTED'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY status DESC, p.proname;
```

### Check for Unused Indexes

```sql
-- Identify indexes that have never been scanned
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY tablename, indexname;
```

### Find Slow Queries (Enable pg_stat_statements extension first)

```sql
-- Top 10 slowest queries
SELECT 
    queryid,
    LEFT(query, 100) AS query_preview,
    calls,
    total_exec_time / 1000 AS total_time_sec,
    mean_exec_time AS avg_time_ms,
    max_exec_time AS max_time_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

**End of DB/RLS Audit**

