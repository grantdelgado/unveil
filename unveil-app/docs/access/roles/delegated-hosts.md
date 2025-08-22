# Delegated Hosts in Unveil

**Last Updated:** January 30, 2025  
**Schema Version:** 98%+ Compatibility Achieved

## 📖 Overview

Delegated hosts are users who have been granted host-level permissions for specific events, stored as `role = 'host'` in the `event_guests` table. This enables **co-hosting** and **shared event administration** without requiring multiple primary hosts.

### 🎯 Core Concept

Unveil supports **two types of hosts** per event:

1. **Primary Host**: `events.host_user_id` (event creator, always required)
2. **Delegated Host(s)**: `event_guests.role = 'host'` (additional hosts with full permissions)

Both host types have **identical permissions** for event management, guest administration, SMS sending, and dashboard access.

---

## 🗃️ Data Model & Schema

### Primary Storage: `event_guests` Table

Delegated host roles are stored in the consolidated `event_guests` table:

```sql
CREATE TABLE event_guests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    guest_name text,
    guest_email text,
    phone text NOT NULL,
    role text DEFAULT 'guest' NOT NULL,                    -- 🔑 KEY FIELD
    rsvp_status text DEFAULT 'pending',
    notes text,
    guest_tags text[] DEFAULT '{}',
    -- ... additional fields

    CONSTRAINT event_guests_role_check CHECK (role IN ('host', 'guest', 'admin'))
);
```

### Schema Evolution

The delegated host system was introduced in **migration 20250109000000**:

```sql
-- Add role column for per-event role assignment
ALTER TABLE public.event_guests ADD COLUMN role TEXT NOT NULL DEFAULT 'guest';

-- Add check constraint for valid roles
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_role_check
CHECK (role IN ('host', 'guest', 'admin'));

-- Update existing records: set role to 'host' for event creators
UPDATE public.event_guests SET role = 'host'
WHERE user_id IN (SELECT host_user_id FROM events WHERE events.id = event_guests.event_id);
```

### Current Database State

As of January 30, 2025:

- **Total delegated hosts**: 1 user across 1 event
- **Roles supported**: `'host'`, `'guest'`, `'admin'`
- **Default role**: `'guest'` for all new guest imports

---

## 🔒 Authorization & RLS Implementation

### Core Authorization Function: `is_event_host()`

The system uses a **dual-check authorization function** that validates both primary and delegated hosts:

```sql
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := (SELECT auth.uid());

    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- PRIMARY HOST CHECK: Check events.host_user_id
    IF EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id
        AND e.host_user_id = current_user_id
    ) THEN
        RETURN true;
    END IF;

    -- DELEGATED HOST CHECK: Check event_guests.role = 'host'
    RETURN EXISTS (
        SELECT 1 FROM public.event_guests eg
        WHERE eg.event_id = p_event_id
        AND eg.user_id = current_user_id
        AND eg.role = 'host'
    );
END;
$$;
```

### RLS Policies Using Delegated Host Logic

**All major RLS policies** properly support delegated hosts via `is_event_host()`:

#### 1. Event Management

```sql
-- Events policies
CREATE POLICY "events_manage_own" ON events FOR ALL
USING (is_event_host(id));

CREATE POLICY "events_select_accessible" ON events FOR SELECT
USING (is_public = true OR can_access_event(id));
```

#### 2. Guest Management

```sql
-- Event guests policies
CREATE POLICY "event_guests_host_access" ON event_guests FOR ALL
USING (is_event_host(event_id))
WITH CHECK (is_event_host(event_id));
```

#### 3. Media Management

```sql
-- Media policies
CREATE POLICY "media_select_event_accessible" ON media FOR SELECT
USING (can_access_event(event_id));

CREATE POLICY "media_insert_event_participant" ON media FOR INSERT
WITH CHECK (can_access_event(event_id));
```

#### 4. Messaging & SMS

```sql
-- Messages policies
CREATE POLICY "messages_select_event_accessible" ON messages FOR SELECT
USING (is_event_host(event_id) OR is_event_guest(event_id));

CREATE POLICY "messages_insert_event_participant" ON messages FOR INSERT
WITH CHECK (sender_user_id = auth.uid() AND (is_event_host(event_id) OR is_event_guest(event_id)));
```

---

## 🧩 Application Usage

### ✅ Areas with Proper Delegated Host Support

#### 1. **SMS Invitations** (`app/api/sms/send-invitations/route.ts`)

```typescript
// ✅ CORRECTLY uses is_event_host() RPC function
const { data: hostCheck, error: hostError } = await supabaseAuth.rpc(
  'is_event_host',
  { p_event_id: eventId },
);

if (!hostCheck) {
  return NextResponse.json(
    { error: 'User is not authorized as host for this event' },
    { status: 403 },
  );
}
```

#### 2. **Guest Import & Management**

- **RLS enforcement**: All database operations use `is_event_host()` checks
- **Permission validation**: Service-layer validation supports delegated hosts
- **Bulk operations**: Guest imports work for both primary and delegated hosts

#### 3. **Messaging System**

- **Message sending**: Both primary and delegated hosts can send announcements
- **Message reading**: Host-level message access enforced via RLS
- **SMS announcements**: Delegated hosts can send SMS via proper API authorization

### ❌ Critical Bug: Host Dashboard Access

#### **Problem**: Delegated hosts cannot access the host dashboard

**Location**: `app/host/events/[eventId]/dashboard/page.tsx` (lines 54-59)

```typescript
// 🚨 BUG: Only checks primary host, excludes delegated hosts
const { data: eventData, error: eventError } = await supabase
  .from('events')
  .select('*')
  .eq('id', eventId)
  .eq('host_user_id', user.id) // ← ONLY checks primary host!
  .single();
```

**Impact**: Delegated hosts receive "Event not found or you do not have permission to access it" error when trying to access the dashboard.

**Fix Required**: Replace direct `host_user_id` check with `is_event_host()` RPC call:

```typescript
// ✅ SOLUTION: Use proper authorization check
const { data: hostCheck } = await supabase.rpc('is_event_host', {
  p_event_id: eventId,
});

if (!hostCheck) {
  setError('Event not found or you do not have permission to access it.');
  return;
}

// Then fetch event data separately without host restriction
const { data: eventData, error: eventError } = await supabase
  .from('events')
  .select('*')
  .eq('id', eventId)
  .single();
```

---

## ⚠️ Edge Cases & Known Issues

### 1. **Unlinked Delegated Hosts**

**Scenario**: A user is assigned `role = 'host'` but has `user_id = NULL` (phone-only guest record)

**Current Behavior**:

- ✅ **Database RLS**: Supports phone-based access via JWT claims
- ✅ **Guest linking**: Auto-links when user signs up with matching phone
- ❌ **Host permissions**: `is_event_host()` requires authenticated `user_id`

**Risk**: Delegated hosts with unlinked accounts cannot perform host actions until they create an account.

**Mitigation**:

```sql
-- Enhanced is_event_host() to support phone-based host access
-- (Currently only implemented for is_event_guest())
```

### 2. **Role Promotion Race Conditions**

**Scenario**: Multiple operations simultaneously promote a guest to host

**Potential Issues**:

- Database constraint violations
- Inconsistent permission states
- Authorization check timing

**Mitigation**: Atomic role updates with proper error handling

### 3. **Cascade Deletion Effects**

**Scenario**: Primary host deletes their account

**Current Behavior**:

- ✅ Event maintains delegated hosts
- ❌ **Potential orphaning**: Event may become inaccessible if no delegated hosts exist
- ⚠️ **Migration path**: No automatic promotion of delegated host to primary

**Recommendation**: Implement primary host succession logic

### 4. **Schema Migration Inconsistencies**

**Issue**: Multiple migrations modify `is_event_host()` function with conflicting implementations

**Problem Files**:

- `20250135000000_safe_jwt_claim_extraction.sql` - Reverts to primary-only check
- `20250616043442_remote_schema.sql` - Missing delegated host support

**Current State**: ✅ Database contains correct implementation (from `20250129000004_optimize_helper_functions.sql`)

**Risk**: Future schema deployments may regress delegated host functionality

---

## 🚀 Management & Assignment

### Current Delegated Host Assignment

**Manual Process** (No UI implementation found):

1. **Database Direct**: Update `event_guests.role = 'host'` for existing guest records
2. **Guest Import**: Import guests with `role = 'host'` during CSV import
3. **API Operations**: Use guest management APIs with role parameter

### Missing UI Features

**Event Management Interface**:

- ❌ Role assignment dropdown in guest management
- ❌ Host promotion/demotion buttons
- ❌ Visual distinction between primary and delegated hosts
- ❌ Host permission management UI

**Recommended Implementation**:

```typescript
// Guest role management component
const GuestRoleSelector = ({ guest, onRoleChange }) => (
  <Select value={guest.role} onValueChange={onRoleChange}>
    <SelectItem value="guest">Guest</SelectItem>
    <SelectItem value="host">Co-Host</SelectItem>
    <SelectItem value="admin">Admin</SelectItem>
  </Select>
);
```

---

## 📋 Security Considerations

### ✅ Secure Implementation

1. **RLS Enforcement**: All host permissions properly enforced at database level
2. **Function Optimization**: `is_event_host()` uses efficient indexed queries
3. **Search Path Security**: Functions use `SET search_path = ''` to prevent injection
4. **Atomic Operations**: Role assignments use transaction-safe updates

### ⚠️ Security Gaps

1. **Audit Trail**: No logging of role assignments/changes
2. **Role Validation**: No verification that delegated hosts have linked accounts
3. **Escalation Prevention**: No checks against self-promotion or circular delegation

### 🔐 Best Practices

```sql
-- Recommended: Audit delegated host operations
CREATE TABLE host_role_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  previous_role text,
  new_role text,
  changed_by uuid NOT NULL,
  changed_at timestamptz DEFAULT now()
);
```

---

## 🔄 Future Enhancements

### Planned Features

1. **UI Management**: Complete role assignment interface
2. **Host Succession**: Automatic primary host transfer
3. **Permission Levels**: Granular host permission control
4. **Bulk Operations**: Multi-guest role assignments
5. **Audit Trail**: Complete role change logging

### API Enhancements

```typescript
// Proposed delegated host management API
interface HostManagementAPI {
  promoteToHost(guestId: string): Promise<void>;
  demoteToGuest(hostId: string): Promise<void>;
  transferPrimaryHost(newHostId: string): Promise<void>;
  listEventHosts(eventId: string): Promise<HostInfo[]>;
}
```

---

## 📚 References

- **Database Schema**: `app/reference/schema.sql`
- **RLS Policies**: `supabase/migrations/20250128000001_cleanup_rls_policies.sql`
- **Authorization Functions**: `supabase/migrations/20250129000004_optimize_helper_functions.sql`
- **SMS Integration**: `app/api/sms/send-invitations/route.ts`
- **Guest Management**: `lib/services/eventCreation.ts`

---

**Document Status**: ✅ Complete Analysis  
**Action Required**: Fix host dashboard authorization bug  
**Priority**: High (blocks delegated host functionality)
