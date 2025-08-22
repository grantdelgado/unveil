# Event Membership Consistency Implementation

## Summary

Fixed the "Choose an event" list to hide events from removed guests and implemented canonical membership model with single rows per (event_id, phone).

## Implementation Details

### 1. Fixed Event List RPC ✅

**File**: `supabase/migrations/20250120000002_fix_get_user_events_removed_at.sql`

- Updated `get_user_events()` RPC to filter `removed_at IS NULL` in JOIN condition
- Now removed guests won't see events in "Choose an event" list
- Added proper WHERE clause filtering for guest membership

### 2. Canonical Membership Constraints ✅

**File**: `supabase/migrations/20250120000003_canonical_membership_constraints.sql`

- Ensured unique constraint: `uq_event_guests_event_phone_active` (already existed)
- Added performance indexes:
  - `idx_event_guests_user_active` - User/event lookups for active guests
  - `idx_event_guests_event_phone_all` - Phone lookups across all records
  - `idx_event_guests_removed_at` - Removed status filtering

### 3. Single Entry Point RPC ✅

**File**: `supabase/migrations/20250120000004_add_or_restore_guest_rpc.sql`

- Created `add_or_restore_guest(p_event_id, p_phone, p_name, p_email, p_role)` RPC
- **Logic**:
  - Find existing record by (event_id, phone) - most recent first
  - If removed → restore same row (clear removed_at, update details, reset decline/opt-out)
  - If active → update details only
  - If none exists → create new row
- **Returns**: `{success, guest_id, operation, phone, name, email, role}`

### 4. Backfill/Dedupe Migration ✅

**File**: `supabase/migrations/20250120000005_backfill_canonical_membership.sql`

- Safe migration to handle existing duplicate rows
- **Process**:
  - Identify groups with multiple rows for same (event_id, phone)
  - Choose canonical record (oldest with most history)
  - Re-point dependent FKs (message_deliveries) to canonical
  - Mark duplicates as removed (preserve for audit)
- **Validation**: Ensures no active duplicates remain

### 5. Updated Add Flows ✅

**Frontend Changes**:

- **CSV Import**: `lib/services/eventCreation.ts` → Uses `add_or_restore_guest` RPC
- **Manual Add**: `hooks/useGuests.ts` → Uses `add_or_restore_guest` RPC
- **Benefits**: No more duplicate rows, automatic restore of removed guests

### 6. Remove Flow (Already Working) ✅

- Uses existing `soft_delete_guest(p_guest_id)` RPC
- Sets `removed_at = NOW()` (soft delete)
- Preserves history and foreign key relationships

### 7. Cache Invalidation ✅

**Added to**:

- `GuestManagement.tsx` → Invalidates user events after guest removal
- `GuestImportWizard.tsx` → Invalidates user events after guest import
- **Result**: "Choose an event" list updates immediately

## Acceptance Criteria Status

✅ **Example user doesn't see removed events**: Fixed via `get_user_events` RPC filter  
✅ **Remove/re-add uses same guest_id**: Implemented via `add_or_restore_guest` RPC  
✅ **All recipient lists use canonical scope**: Already audited and confirmed  
✅ **Unique-active constraint enforced**: Existing constraint + backfill ensures this  
✅ **Backfill preserves history**: Migration re-points FKs and soft-deletes duplicates  
✅ **Cache invalidation**: Added to remove/add flows for immediate UI updates

## Database Schema Changes

### New RPC Functions

```sql
-- Single entry point for guest management
add_or_restore_guest(p_event_id uuid, p_phone text, p_name text, p_email text, p_role text)

-- Fixed event list filtering
get_user_events(user_id_param uuid) -- Now filters removed_at IS NULL
```

### New Indexes

```sql
-- Performance optimization for canonical membership
idx_event_guests_user_active ON event_guests(user_id, event_id) WHERE removed_at IS NULL
idx_event_guests_event_phone_all ON event_guests(event_id, phone)
```

## Testing Recommendations

1. **Remove/Re-add Flow**:

   - Remove a guest → Verify they can't see event in "Choose an event"
   - Re-add same guest → Verify same guest_id is restored
   - Check message_deliveries still point to correct guest_id

2. **CSV Import Duplicates**:

   - Import CSV with phone numbers that exist (some removed, some active)
   - Verify removed guests are restored, active guests are updated
   - No duplicate rows created

3. **Cache Validation**:
   - Remove guest → Verify "Choose an event" updates immediately
   - Add guest → Verify they see event immediately

## Performance Impact

- **Positive**: Better indexes for membership queries
- **Neutral**: Individual RPC calls vs batch inserts (trade-off for correctness)
- **Monitoring**: Watch for slow guest import on large CSV files

## Rollback Plan

If issues arise:

1. Revert to previous `get_user_events` function
2. Temporarily disable new `add_or_restore_guest` RPC
3. Fall back to direct INSERT for guest creation
4. Canonical constraint remains safe (partial unique index)
