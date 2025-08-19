# Event Access & Visibility — End-to-End Audit Report

**Date:** January 29, 2025  
**Scope:** Complete audit of event access control, visibility, and membership consistency  
**Status:** 🔴 **High-Risk Issues Identified**

## Executive Summary

This audit reveals **critical security and consistency gaps** in event access control across the Unveil application. While the database schema has strong foundations, there are significant inconsistencies between client-side queries, RLS policies, and membership filtering that create security vulnerabilities and user experience issues.

### Key Findings
- ✅ **Strong Database Foundation**: Canonical membership constraints and `removed_at` filtering
- 🔴 **Critical Gap**: Missing `removed_at` filters in multiple client paths
- 🔴 **Security Risk**: SECURITY DEFINER functions without proper search_path isolation
- 🔴 **Inconsistent Sources**: Multiple RPCs for event listing with different filtering logic
- 🔴 **Phone Normalization**: Inconsistent normalization across client/server boundaries

---

## Data Model & Policies

### Core Tables

#### `events` table
```sql
-- Location: app/reference/schema.sql:31-42
CREATE TABLE events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    event_date date NOT NULL,
    location text,
    description text,
    host_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    header_image_url text,
    is_public boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### `event_guests` table (Critical Membership Control)
```sql
-- Location: app/reference/schema.sql:44-62
CREATE TABLE event_guests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    guest_name text,
    guest_email text,
    phone text NOT NULL,
    rsvp_status text DEFAULT 'pending',
    notes text,
    guest_tags text[] DEFAULT '{}',
    role text DEFAULT 'guest' NOT NULL,
    invited_at timestamptz DEFAULT now(),
    phone_number_verified boolean DEFAULT false,
    sms_opt_out boolean DEFAULT false,
    preferred_communication varchar DEFAULT 'sms',
    removed_at timestamptz,  -- 🔑 CRITICAL: Soft delete timestamp
    declined_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### Critical Constraints

#### Canonical Membership Constraint
```sql
-- Location: supabase/migrations/20250120000003_canonical_membership_constraints.sql:5-7
CREATE UNIQUE INDEX uq_event_guests_event_phone_active
ON public.event_guests(event_id, phone)
WHERE removed_at IS NULL;
```
**Purpose**: Ensures exactly one active guest per phone per event. Historical duplicates preserved with `removed_at` timestamp.

### Security Functions

#### Core Access Control Functions
```sql
-- Location: app/reference/schema.sql:158-201
CREATE OR REPLACE FUNCTION is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''  -- ✅ Secure

CREATE OR REPLACE FUNCTION is_event_guest(p_event_id uuid)
RETURNS boolean  
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''  -- ✅ Secure

CREATE OR REPLACE FUNCTION can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''  -- ✅ Secure
```

### RLS Policies Summary

#### Events Table Policies
```sql
-- Location: app/reference/schema.sql:234-241
CREATE POLICY events_unified_access ON events FOR ALL USING (
  host_user_id = (select auth.uid()) OR
  (public.is_event_guest(id) AND public.can_access_event(id))
);
```

#### Event Guests Table Policies
```sql
-- Location: app/reference/schema.sql:244-245
CREATE POLICY event_guests_host_management ON event_guests FOR ALL 
USING (public.is_event_host(event_id));

CREATE POLICY event_guests_self_access ON event_guests FOR ALL 
USING (user_id = (select auth.uid()));
```

---

## Call Graph & Fetch Points

### Client UI Entry Points

| Location | Purpose | Data Source | Filters Applied | Cache/Invalidation |
|----------|---------|-------------|----------------|-------------------|
| `app/select-event/page.tsx:23` | Event selection list | `useUserEvents()` → `get_user_events` RPC | ✅ `removed_at IS NULL` (fixed) | No cache, direct fetch |
| `app/host/events/[eventId]/dashboard/page.tsx:56` | Host dashboard access | `is_event_host` RPC + direct table query | ✅ RLS via `is_event_host()` | No cache |
| `app/guest/events/[eventId]/page.tsx:147` | Guest event access | Direct table query + auto-join | ❌ **Missing `removed_at` filter** | No cache |
| `app/profile/page.tsx:96` | Profile events list | Direct table query `host_user_id` | ❌ **Only shows hosted events** | No cache |
| `hooks/events/useEventWithGuest.ts:61` | Guest event details | Direct table query with join | ✅ `removed_at IS NULL` (fixed) | No cache |

### API Routes Access Control

| Location | Purpose | Auth Method | Access Check | Risk Level |
|----------|---------|-------------|--------------|------------|
| `app/api/sms/send-invitations/route.ts:82` | SMS invitations | Bearer token/session | ✅ Event existence + host check | Low |
| `app/api/guests/invite-single/route.ts:42` | Single guest invite | Session auth | ✅ Host verification + active guest filter | Low |
| `app/api/messages/send/route.ts:52` | Send messages | Session auth | ✅ Host verification | Low |
| `app/api/admin/backfill-user-ids/route.ts:113` | Admin backfill | Session auth | ❌ **No admin role check** | High |

### Database RPCs

| Function | Location | Purpose | Security | Filters |
|----------|----------|---------|----------|---------|
| `get_user_events()` | `supabase/migrations/20250120000006_fix_get_user_events_final.sql:5` | Event list for user | ✅ SECURITY DEFINER + search_path | ✅ `removed_at IS NULL` |
| `is_event_host()` | `app/reference/schema.sql:158` | Host permission check | ✅ SECURITY DEFINER + search_path | N/A |
| `is_event_guest()` | `app/reference/schema.sql:182` | Guest permission check | ✅ SECURITY DEFINER + search_path | ❌ **Missing `removed_at` filter** |
| `can_access_event()` | `app/reference/schema.sql:205` | Combined access check | ✅ SECURITY DEFINER + search_path | Depends on `is_event_guest()` |

---

## Message Visibility Coupling

### Message Access Control Chain

1. **Messages Table RLS**
   ```sql
   -- Location: app/reference/schema.sql:252-253
   CREATE POLICY messages_select_optimized ON messages FOR SELECT 
   USING (public.can_access_event(event_id));
   ```

2. **Message Deliveries RLS**
   ```sql
   -- Location: app/reference/schema.sql:259-267
   CREATE POLICY message_deliveries_select_optimized ON message_deliveries FOR SELECT USING (
     CASE
       WHEN user_id IS NOT NULL THEN user_id = (select auth.uid())
       WHEN guest_id IS NOT NULL THEN public.can_access_event(
         (SELECT eg.event_id FROM event_guests eg WHERE eg.id = guest_id)
       )
       ELSE false
     END
   );
   ```

### Risk Assessment
- ✅ **Proper Isolation**: Messages use `can_access_event()` which should filter removed guests
- 🔴 **Indirect Risk**: `is_event_guest()` function doesn't filter `removed_at`, so removed guests might still see messages
- ✅ **Delivery Tracking**: Message deliveries properly scope to `user_id = auth.uid()`

---

## Risk & Inconsistency Analysis

### High Severity Issues

#### 1. Missing `removed_at` Filter in Core Functions
**Location**: `app/reference/schema.sql:182-201`  
**Issue**: `is_event_guest()` function doesn't filter `removed_at IS NULL`
```sql
-- CURRENT (VULNERABLE)
CREATE OR REPLACE FUNCTION is_event_guest(p_event_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests 
        WHERE event_id = p_event_id AND user_id = auth.uid()
        -- ❌ MISSING: AND removed_at IS NULL
    );
END;
$$;
```
**Impact**: Removed guests can still access events, messages, and media  
**Severity**: 🔴 **High**

#### 2. Inconsistent Phone Normalization
**Locations**: 
- `lib/utils/validation.ts:38-50` (client)
- `lib/utils/phone.ts:15-51` (client) 
- `supabase/migrations/20250129000000_auto_link_user_by_phone.sql:24-53` (database)

**Issue**: Three different normalization implementations
```typescript
// lib/utils/validation.ts - Simple approach
export const normalizePhoneNumber = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`;
  return phone; // ❌ INCONSISTENT: Returns original on failure
};

// lib/utils/phone.ts - Validation approach  
export function normalizePhoneNumber(phone: string): PhoneValidationResult {
  // ... more complex logic with validation
  return { isValid: true, normalized }; // ✅ BETTER: Returns validation result
}

// Database function - Most comprehensive
CREATE OR REPLACE FUNCTION normalize_phone(phone_input text) RETURNS text AS $$
  -- ... handles multiple formats, validates E.164
$$;
```
**Impact**: Inconsistent phone matching across guest lookups and invitations  
**Severity**: 🔴 **High**

#### 3. SECURITY DEFINER Functions Without Proper Isolation
**Locations**: Multiple files (113 instances found)  
**Issue**: Some SECURITY DEFINER functions missing `SET search_path = ''`

**Examples of Vulnerable Functions**:
```sql
-- VULNERABLE (missing search_path)
-- Location: supabase/migrations/20250120000000_fix_duplicate_events_function.sql:8
CREATE OR REPLACE FUNCTION public.get_user_events(...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''  -- ❌ Should be = '' not TO ''
```

**Impact**: Potential privilege escalation via search_path manipulation  
**Severity**: 🔴 **High**

### Medium Severity Issues

#### 4. Multiple Sources of Truth for Event Lists
**Issue**: Different components use different methods to fetch user events
- `useUserEvents()` → `get_user_events` RPC (✅ filtered)
- `useEvents()` → Direct table query (❌ unfiltered) 
- Profile page → Direct host query (❌ partial)

**Impact**: Inconsistent event visibility across UI  
**Severity**: 🟡 **Medium**

#### 5. Missing Admin Role Verification
**Location**: `app/api/admin/backfill-user-ids/route.ts:113`  
**Issue**: Admin endpoints only check authentication, not admin role
```typescript
// CURRENT (INSUFFICIENT)
const { data: { session }, error: authError } = await supabase.auth.getSession();
if (authError || !session) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
// ❌ MISSING: Admin role verification
```
**Impact**: Any authenticated user can access admin functions  
**Severity**: 🟡 **Medium**

### Low Severity Issues

#### 6. Inconsistent Cache Invalidation
**Issue**: Most hooks don't implement caching, leading to unnecessary re-fetches  
**Impact**: Performance degradation, no stale data issues  
**Severity**: 🟢 **Low**

#### 7. Client-Side Event Access Without Server Validation
**Location**: `app/guest/events/[eventId]/page.tsx:147`  
**Issue**: Direct table query without removed_at filter
```typescript
// CURRENT (POTENTIAL ISSUE)
const { data: event, error: eventError } = await supabase
  .from('events')
  .select('id, title, event_date, location, time_zone')
  .eq('id', eventId)
  .single();
// ❌ No membership validation, relies on RLS
```
**Impact**: Removed guests might see basic event info  
**Severity**: 🟢 **Low** (RLS should prevent, but inconsistent UX)

---

## Recommendations & Migration Plan

### Phase 1: Critical Security Fixes (Immediate - ≤ 1 week)

#### 1.1 Fix `is_event_guest()` Function
```sql
-- File: supabase/migrations/YYYYMMDD_fix_is_event_guest_removed_at.sql
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests 
        WHERE event_id = p_event_id 
        AND user_id = (SELECT auth.uid())
        AND removed_at IS NULL  -- 🔧 FIX: Add removed_at filter
    );
END;
$$;
```

#### 1.2 Standardize Phone Normalization
**Action**: Create single source of truth for phone normalization
```typescript
// File: lib/utils/phone.ts - Keep this as the canonical implementation
// Remove duplicate implementations in lib/utils/validation.ts
// Update all client code to use lib/utils/phone.ts
```

#### 1.3 Fix SECURITY DEFINER search_path Issues
```sql
-- Audit all SECURITY DEFINER functions and ensure:
SET search_path = ''  -- Not TO ''
```

### Phase 2: Consistency & Architecture (1-2 weeks)

#### 2.1 Single Source of Truth for Event Access
**Create canonical functions**:
```sql
-- New canonical RPC
CREATE OR REPLACE FUNCTION public.get_user_events_canonical(user_id uuid DEFAULT auth.uid())
RETURNS TABLE(...) AS $$
  -- Single implementation with proper removed_at filtering
$$;

-- New access check RPC  
CREATE OR REPLACE FUNCTION public.can_user_access_event(event_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
  -- Combines host check + active guest check
$$;
```

#### 2.2 Refactor Client Code to Use Canonical RPCs
- Update `useEvents()` to use `get_user_events_canonical()`
- Update all direct table queries to use access check RPCs
- Add proper error handling for access denied scenarios

#### 2.3 Add Admin Role Verification
```typescript
// File: lib/auth/adminAuth.ts
export async function verifyAdminRole(userId: string): Promise<boolean> {
  // Check user role in database or JWT claims
}

// Update all admin API routes to use this verification
```

### Phase 3: Performance & UX Improvements (2-3 weeks)

#### 3.1 Implement Proper Caching Strategy
```typescript
// Use React Query with proper cache keys and invalidation
const CACHE_KEYS = {
  userEvents: (userId: string) => ['events', 'user', userId],
  eventDetails: (eventId: string) => ['events', 'details', eventId],
  eventGuests: (eventId: string) => ['events', eventId, 'guests']
};
```

#### 3.2 Add Comprehensive Access Logging
```sql
-- Create audit table for access attempts
CREATE TABLE event_access_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event_id uuid,
  access_type text, -- 'view', 'message', 'media'
  access_granted boolean,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

### Quick Wins (≤10 lines each)

1. **Fix is_event_guest() function** - Add `AND removed_at IS NULL`
2. **Standardize phone utils** - Remove duplicate in validation.ts  
3. **Add admin check** - Single function call in admin routes
4. **Fix search_path syntax** - Change `TO ''` to `= ''`

---

## Test Matrix

### Access Control Tests Needed

| Scenario | User Type | Expected Result | Test Location |
|----------|-----------|----------------|---------------|
| Removed guest views event list | Removed guest | Event not visible | `__tests__/integration/event-access.test.ts` |
| Removed guest accesses event page | Removed guest | 403 Forbidden | `__tests__/integration/event-access.test.ts` |
| Removed guest sees messages | Removed guest | No messages visible | `__tests__/integration/messaging.test.ts` |
| Host removes then restores guest | Host | Guest regains access | `__tests__/integration/membership.test.ts` |
| Phone normalization consistency | Any | Same result client/server | `__tests__/unit/phone-normalization.test.ts` |
| Admin endpoint access | Non-admin | 403 Forbidden | `__tests__/integration/admin-access.test.ts` |

### Membership State Tests

| State | removed_at | declined_at | Expected Access |
|-------|------------|-------------|----------------|
| Active | NULL | NULL | ✅ Full access |
| Removed | NOT NULL | NULL | ❌ No access |
| Declined | NULL | NOT NULL | ✅ Limited access |
| Removed + Declined | NOT NULL | NOT NULL | ❌ No access |

---

## Appendix

### Full RPC Index

#### Event Access RPCs
- `get_user_events(user_id)` - ✅ Secure, filters removed_at
- `is_event_host(event_id)` - ✅ Secure  
- `is_event_guest(event_id)` - 🔴 Missing removed_at filter
- `can_access_event(event_id)` - 🔴 Depends on is_event_guest()

#### Guest Management RPCs  
- `add_or_restore_guest(...)` - ✅ Secure, canonical membership
- `soft_delete_guest(guest_id)` - ✅ Secure, sets removed_at
- `get_event_guests_with_display_names(...)` - ✅ Secure, filters removed_at

#### Message RPCs
- `get_guest_event_messages(...)` - ✅ Secure, proper filtering
- `resolve_message_recipients(...)` - ✅ Secure, filters removed_at

### RLS Policy Summary

#### Events Table
- `events_unified_access` - Allows host + guest access via can_access_event()
- `events_select_read_access` - Read-only version

#### Event Guests Table  
- `event_guests_host_management` - Hosts can manage all guests
- `event_guests_self_access` - Users can manage own records

#### Messages & Media
- `messages_select_optimized` - Uses can_access_event()
- `media_event_access` - Uses can_access_event()
- `message_deliveries_select_optimized` - User-scoped + event access

### Critical Files Requiring Updates

1. `app/reference/schema.sql` - Fix is_event_guest() function
2. `lib/utils/validation.ts` - Remove duplicate phone normalization  
3. `supabase/migrations/20250120000000_fix_duplicate_events_function.sql` - Fix search_path syntax
4. `app/api/admin/backfill-user-ids/route.ts` - Add admin verification
5. `hooks/useEvents.ts` - Use canonical RPC instead of direct queries

---

**Report Generated**: January 29, 2025  
**Next Review**: After Phase 1 implementation (≤ 1 week)  
**Contact**: Development Team Lead for implementation coordination
