# Event Membership Consistency - Discovery Notes

## Discovery Summary

### 1. Event List Data Source ✅
- **Component**: `app/select-event/page.tsx` uses `useUserEvents()` hook
- **Hook**: `hooks/events/useUserEvents.ts` calls `get_user_events()` RPC
- **Current RPC**: Does NOT filter `removed_at IS NULL` in the JOIN clause
- **Issue**: Removed guests can still see events in "Choose an event" list

### 2. Current `get_user_events` RPC Issues ❌
```sql
-- Current implementation (BROKEN):
LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = COALESCE(user_id_param, auth.uid())
WHERE e.host_user_id = COALESCE(user_id_param, auth.uid()) OR eg.user_id = COALESCE(user_id_param, auth.uid())

-- Missing: AND eg.removed_at IS NULL in the JOIN condition
```

### 3. Membership Query Audit ✅
**Already Fixed (using canonical scope with `removed_at IS NULL`):**
- ✅ `useEventWithGuest` - Fixed in recent PR
- ✅ Message send API - All recipient validation queries
- ✅ Scheduled message processing - All recipient resolution
- ✅ Messaging hooks (`useGuestSelection`, `useRecipientPreview`)
- ✅ Guest management RPC (`get_event_guests_with_display_names`)

**Still Missing `removed_at` Filter:**
- ❌ `get_user_events` RPC - Core issue for event list
- ❌ Some direct queries in older components (see below)

### 4. Add/Remove Flows ✅
**Remove Flow (Soft Delete):**
- Uses `soft_delete_guest(p_guest_id)` RPC ✅
- Sets `removed_at = NOW()` ✅
- Used in: `components/features/host-dashboard/GuestManagement.tsx`

**Add Flows (Create New Rows):**
- **Manual Add**: `GuestImportWizard` → `useGuests.importGuests` → Direct INSERT
- **CSV Import**: `EventCreationService.importGuests` → Batch INSERT
- **Problem**: Both create new rows even if removed row exists for same (event_id, phone)

### 5. Existing Constraints ✅
```sql
-- Already exists:
CREATE UNIQUE INDEX event_guests_event_id_phone_active_key 
ON public.event_guests (event_id, phone) 
WHERE removed_at IS NULL;
```

### 6. Example User Check ⚠️
- Cannot access Supabase directly via MCP (permission error)
- Need to verify via application logs or alternative method

## Implementation Priority

### Phase 1: Fix Event List (Critical)
1. Update `get_user_events` RPC to filter `removed_at IS NULL`
2. Test with example user

### Phase 2: Canonical Membership (Core)
1. Create `add_or_restore_guest` RPC
2. Update add flows to use RPC instead of direct INSERT
3. Create backfill migration for duplicate cleanup

### Phase 3: Additional Indexes (Performance)
1. Add suggested indexes for lookups
2. Cache invalidation improvements
