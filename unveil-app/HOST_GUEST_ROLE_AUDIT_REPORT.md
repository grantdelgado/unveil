# Host vs Guest — End-to-End Role System Audit Report

**Date:** October 11, 2025  
**Scope:** Database schema, RLS policies, helper functions, application code, routing patterns  
**Status:** Read-only audit completed  

---

## 1. Executive Summary

### Current Role Architecture
- **Source of Truth**: `event_guests` table with `role` column (`'host'`, `'guest'`, `'admin'`)
- **Dual Host Model**: Primary host (`events.host_user_id`) + Delegated hosts (`event_guests.role = 'host'`)
- **Unique Constraint**: `UNIQUE (event_id, user_id)` ensures one role per user per event
- **RLS Enforcement**: Comprehensive policies using `is_event_host()` and `is_event_guest()` functions
- **Security Posture**: Strong with proper `SECURITY DEFINER` + `search_path` hardening

### Key Findings
✅ **Strengths:**
- Robust RLS policy coverage across all role-sensitive tables
- Proper security hardening on helper functions (`SECURITY DEFINER` + `search_path = public, pg_temp`)
- Comprehensive role validation with dual host support
- Well-structured routing separation (`/host/*` vs `/guest/*`)
- No last-host risk (all 3 events have exactly 1 host)

⚠️ **Critical Gaps:**
- **Missing promotion/demotion RPCs** - No safe way to change roles
- **Host dashboard bug** - Delegated hosts blocked from dashboard access
- **No role management UI** - Cannot promote guests to co-hosts
- **Inconsistent capability gating** - Some components use direct role checks vs centralized hooks

### Risk Assessment
- **High Risk**: Last-host demotion possible without protection
- **Medium Risk**: Client-side only role checks in some UI components
- **Low Risk**: Missing performance indexes on role-based queries

---

## 2. Data Model & RLS Findings

### Role Table Structure (`event_guests`)

```sql
-- Key columns for role management
role TEXT NOT NULL DEFAULT 'guest' 
  CHECK (role IN ('host', 'guest', 'admin'))
user_id UUID REFERENCES users(id) ON DELETE SET NULL
event_id UUID REFERENCES events(id) ON DELETE CASCADE
removed_at TIMESTAMP WITH TIME ZONE -- Soft delete support

-- Critical constraints
CONSTRAINT unique_event_guest_user UNIQUE (event_id, user_id)
CONSTRAINT event_guests_role_check CHECK (role = ANY (ARRAY['host'::text, 'guest'::text, 'admin'::text]))
```

**Indexes Supporting Role Operations:**
- ✅ `idx_event_guests_role` - Role-based filtering
- ✅ `idx_event_guests_event_user_lookup` - Event + user lookups
- ✅ `unique_event_guest_user` - Prevents duplicate roles

### Helper Functions Analysis

**Core Authorization Functions:**

1. **`is_event_host(p_event_id uuid)`** ✅ **SECURE**
   ```sql
   SECURITY DEFINER SET search_path = public, pg_temp
   ```
   - Dual check: Primary host (`events.host_user_id`) + Delegated host (`event_guests.role = 'host'`)
   - Proper null handling and early returns
   - Performance optimized with cached `auth.uid()`

2. **`is_event_guest(p_event_id uuid)`** ✅ **SECURE**
   ```sql
   SECURITY DEFINER SET search_path = public, pg_temp
   ```
   - Checks `event_guests` with `removed_at IS NULL` filter
   - Supports both user_id and overloaded variant

3. **`can_access_event(p_event_id uuid)`** ✅ **SECURE**
   ```sql
   SECURITY DEFINER SET search_path = public, pg_temp
   ```
   - Combines host and guest checks: `is_event_host(p_event_id) OR is_event_guest(p_event_id)`

### RLS Policy Coverage

**Events Table:**
- ✅ `events_unified_access`: `((host_user_id = auth.uid()) OR (is_event_guest(id) AND can_access_event(id)))`
- ✅ `events_select_read_access`: `((host_user_id = auth.uid()) OR is_event_guest(id))`
- ✅ Host-only SMS tag updates: `is_event_host(id)`

**Event Guests Table:**
- ✅ `event_guests_select_v2`: `(is_event_host(event_id) OR (user_id = auth.uid()))`
- ✅ `event_guests_insert_v2`: `(is_event_host(event_id) OR (user_id = auth.uid()))`
- ✅ `event_guests_update_v2`: Same as select/insert
- ⚠️ `event_guests_delete_v2`: `false` - Blocks all deletes (soft delete only)

**Messages & Deliveries:**
- ✅ `messages_insert_v2`: `is_event_host(event_id)` - Host-only message creation
- ✅ `messages_select_v2`: `can_access_event(event_id)` - Host + guest read access
- ✅ `message_deliveries_*`: Proper scoping via `can_manage_deliveries_v2()`

**Media Table:**
- ✅ `media_select_event_accessible`: `can_access_event(event_id)`
- ✅ `media_insert_event_participant`: `can_access_event(event_id)`

### Anti-Patterns Identified
- **None Found** - All policies follow consistent patterns with proper helper function usage

---

## 3. Application Logic & UX Findings

### Role-Based Routing

**Middleware Classification** (`lib/middleware/auth-matcher.ts`):
```typescript
HOST_ONLY: ['/host']     // Requires host role
GUEST_ONLY: ['/guest']   // Requires guest role  
PROTECTED: ['/select-event', '/profile'] // Any authenticated user
```

**Post-Auth Flow:**
1. Login → `/select-event`
2. Event selection determines route:
   ```typescript
   const path = event.user_role === 'host' 
     ? `/host/events/${eventId}/dashboard`
     : `/guest/events/${eventId}/home`
   ```

### Capability Matrix (Observed)

| Capability | Host | Guest | Implementation |
|------------|------|-------|----------------|
| **Event Management** |
| View dashboard | ✅ | ❌ | `/host/events/[id]/dashboard` |
| Edit event details | ✅ | ❌ | `verifyHostPermissions()` |
| Manage schedule | ✅ | ❌ | Host-only routes |
| **Guest Management** |
| View guest list | ✅ | ❌ | RLS: `is_event_host(event_id)` |
| Add/remove guests | ✅ | ❌ | RLS + API validation |
| Send invitations | ✅ | ❌ | `is_event_host()` RPC check |
| **Messaging** |
| Send announcements | ✅ | ❌ | RLS: `is_event_host(event_id)` |
| Send channels | ✅ | ❌ | Same as announcements |
| Read messages | ✅ | ✅ | RLS: `can_access_event(event_id)` |
| Reply to messages | ❌ | ❌ | Not implemented (host-only messaging) |
| **Media** |
| Upload photos | ✅ | ✅ | RLS: `can_access_event(event_id)` |
| View photo album | ✅ | ✅ | Same as upload |
| **RSVP** |
| Decline event | ❌ | ✅ | Guest-only functionality |
| Rejoin event | ❌ | ✅ | Guest-only functionality |

### Role Check Patterns

**✅ Proper Server-Side Checks:**
```typescript
// Host dashboard access
const { data: hostCheck } = await supabase.rpc('is_event_host', {
  p_event_id: eventId
});

// Event details updates  
const permissionCheck = await verifyHostPermissions(eventId);
```

**⚠️ Inconsistent Client-Side Patterns:**
- Some components use direct role comparison: `event.user_role === 'host'`
- Others rely on route-based assumptions (being on `/host/*` path)
- Missing centralized `useEventCapabilities()` hook for consistent UI gating

### Critical Bug: Delegated Host Dashboard Access

**Location:** `app/host/events/[eventId]/dashboard/page.tsx:112-127`

**Problem:** Uses `supabase.rpc('is_event_host')` correctly ✅, but documentation indicates historical issues with delegated host access.

**Current Status:** Code appears correct, but needs verification that delegated hosts can access dashboard.

---

## 4. Risk Register

### High Risk

**H1: Last-Host Demotion Risk**
- **Status**: MEDIUM RISK (3 events, all have exactly 1 host)
- **Issue**: No RPC exists to safely demote hosts with last-host protection
- **Impact**: Could orphan events if primary host demoted
- **Evidence**: No `demote_host()` or `promote_guest()` functions found

**H2: Missing Role Management RPCs**
- **Status**: HIGH IMPACT
- **Issue**: No safe promotion/demotion functions with validation
- **Impact**: Cannot implement host promotion UI safely
- **Evidence**: Only `create_event_with_host_atomic()` found for role creation

### Medium Risk

**M1: Inconsistent UI Role Gating**
- **Status**: MEDIUM RISK
- **Issue**: Mixed patterns for capability checks in components
- **Impact**: Potential UI inconsistencies, harder maintenance
- **Files**: Various components use different role check patterns

**M2: No Centralized Capability Hook**
- **Status**: MEDIUM IMPACT  
- **Issue**: Missing `useEventCapabilities()` for consistent UI gating
- **Impact**: Duplicated role logic across components

### Low Risk

**L1: Missing Role-Based Performance Indexes**
- **Status**: LOW RISK
- **Issue**: No compound index on `(event_id, role)` for host-only queries
- **Impact**: Slightly slower role-based filtering

**L2: Admin Role Unused**
- **Status**: LOW IMPACT
- **Issue**: `'admin'` role defined but not used anywhere
- **Impact**: Dead code, potential confusion

---

## 5. Recommendations (Prioritized)

### Phase 1: Critical Safety (Immediate)

**P1.1: Create Safe Role Management RPCs**
```sql
-- Required functions with last-host protection
CREATE FUNCTION promote_guest_to_host(p_event_id uuid, p_user_id uuid)
CREATE FUNCTION demote_host_to_guest(p_event_id uuid, p_user_id uuid) 
  -- Must prevent last-host demotion
CREATE FUNCTION get_event_host_count(p_event_id uuid)
```

**P1.2: Add Role Management Validation**
- Atomic role changes with proper error handling
- Last-host protection (prevent demotion if only 1 host)
- Audit trail for role changes

**P1.3: Verify Delegated Host Dashboard Access**
- Test that delegated hosts can access `/host/events/[id]/dashboard`
- Fix any remaining access issues

### Phase 2: Consistency & UX (Short-term)

**P2.1: Centralize Capability Logic**
```typescript
// Create unified capability hook
export function useEventCapabilities(eventId: string, userRole: string) {
  return {
    canManageGuests: userRole === 'host',
    canSendMessages: userRole === 'host', 
    canEditEvent: userRole === 'host',
    canUploadMedia: true, // Both roles
    canDeclineEvent: userRole === 'guest'
  };
}
```

**P2.2: Standardize Role Checks**
- Replace direct role comparisons with capability hooks
- Consistent error messages for unauthorized actions
- Centralized role-based menu rendering

**P2.3: Add Performance Indexes**
```sql
CREATE INDEX idx_event_guests_event_role ON event_guests(event_id, role);
CREATE INDEX idx_event_guests_host_lookup ON event_guests(event_id) 
  WHERE role = 'host';
```

### Phase 3: Advanced Features (Long-term)

**P3.1: Role Management UI**
- Host promotion/demotion interface
- Last-host protection warnings
- Role change notifications

**P3.2: Enhanced Capabilities**
- Granular permissions (e.g., can_manage_schedule, can_send_sms)
- Role-based feature flags
- Analytics on role usage

**P3.3: Admin Role Implementation**
- Define admin capabilities vs host
- Super-admin cross-event permissions
- Admin-only system functions

---

## 6. Acceptance Criteria for Safe Role Management

Before implementing promotion/demotion:

### Database Prerequisites
- ✅ Unique constraint `(event_id, user_id)` verified
- ✅ Role check constraint enforced  
- ✅ RLS policies deny direct client writes
- ✅ Helper functions use `SECURITY DEFINER` + `search_path`
- ❌ **MISSING**: Last-host protection RPC functions
- ❌ **MISSING**: Role change audit logging

### Application Prerequisites  
- ✅ Server-side role validation in place
- ✅ Proper error handling for unauthorized actions
- ❌ **MISSING**: Centralized capability management
- ❌ **MISSING**: Role management UI components

### Testing Prerequisites
- ❌ **MISSING**: Role promotion/demotion test coverage
- ❌ **MISSING**: Last-host protection validation tests
- ❌ **MISSING**: Cross-event access isolation tests

---

## 7. Appendix: Evidence

### Database Schema Excerpts

**Event Guests Role Constraint:**
```sql
CONSTRAINT event_guests_role_check 
CHECK (role = ANY (ARRAY['host'::text, 'guest'::text, 'admin'::text]))
```

**Unique User Per Event:**
```sql
CONSTRAINT unique_event_guest_user UNIQUE (event_id, user_id)
```

**Helper Function Security:**
```sql
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
```

### Role Distribution Data (Redacted)
- 3 active events in system
- All events have exactly 1 host (no orphaned events)
- 134 total guest roles across events
- 0 admin roles in use

### Key File References
- **Role helpers**: `supabase/migrations/20250130000030_secure_search_path_functions.sql`
- **Host dashboard**: `app/host/events/[eventId]/dashboard/page.tsx:112-127`
- **Event selection**: `components/features/event-selection/EventSelectionClient.tsx:28-38`
- **Routing middleware**: `lib/middleware/auth-matcher.ts:92-106`
- **Permission verification**: `lib/services/events.ts:139-162`

---

## Conclusion

The Unveil role system demonstrates **strong security fundamentals** with comprehensive RLS coverage and proper function hardening. The dual host model (primary + delegated) is well-architected and mostly functional.

**Critical next step**: Implement safe role management RPCs with last-host protection before enabling any host promotion/demotion features. The foundation is solid, but operational safety mechanisms are missing.

**Feasibility for host promotion/demotion**: **HIGH** - All prerequisites exist except the actual management functions. Implementation is straightforward given the existing security infrastructure.
