# Unified Guest Counts Implementation

## Discovery Summary

### Where Old Counts Came From

**Host Dashboard (`EventSummaryCard`):**

- Header count: Direct query `event_guests.select('declined_at').eq('event_id', eventId)` → `total = data.length`
- Attendance bar: Same query, split by `declined_at IS NULL` (attending) vs `declined_at IS NOT NULL` (declined)

**Guest Management (`useSimpleGuestStore` + `GuestManagement`):**

- Used `get_event_guests_with_display_names` RPC (already excludes `removed_at IS NULL`)
- Total: `statusCounts.total` from attendance helper
- Invited: `guests.filter(g => g.invited_at && !g.declined_at).length`
- Not Invited: `guests.filter(g => !g.invited_at && !g.declined_at).length`
- Declined: `guests.filter(g => g.declined_at).length`

### Alignment Choice: Include Hosts

**Decision:** Both surfaces now include hosts in counts, matching Guest Management's existing behavior.

**Rationale:**

- Guest Management's "All" filter shows hosts (verified: role='host' exists in event_guests)
- Hosts can be invited, decline, etc. (they're event participants)
- Simpler to maintain consistency by including rather than special-casing exclusion

## Implementation

### 1. Created Unified RPC Function

```sql
get_event_guest_counts(p_event_id UUID)
```

**Base Scope:** `event_guests WHERE event_id = $id AND removed_at IS NULL`

**Returns:**

- `total_guests`: All active guests (includes hosts)
- `total_invited`: `COUNT(*) WHERE invited_at IS NOT NULL`
- `attending`: `COUNT(*) WHERE invited_at IS NOT NULL AND declined_at IS NULL`
- `declined`: `COUNT(*) WHERE declined_at IS NOT NULL`
- `not_invited`: `COUNT(*) WHERE invited_at IS NULL AND declined_at IS NULL`

### 2. Created Shared Hook

`useUnifiedGuestCounts(eventId)` - wraps the RPC with loading states and error handling.

### 3. Updated Components

**Host Dashboard:**

- Header count: Now shows `total_invited` (with "invited" label for clarity)
- Attendance bar: Uses `attending` and `declined` from unified counts

**Guest Management:**

- Filter pills: Use unified counts for consistency
- All refresh operations now also refresh unified counts

## Verification

✅ Soft-deleted guests (`removed_at IS NOT NULL`) excluded from all counts
✅ Host Dashboard header count === Guest Management "Invited" pill count  
✅ Attending + Declined ≤ Total Invited (mathematical consistency)
✅ Adding guest without inviting doesn't increase "invited" count
✅ All count updates are atomic and consistent across both surfaces

## Files Changed

- `supabase/migrations/[timestamp]_unified_guest_counts_rpc.sql` - RPC function
- `hooks/guests/useUnifiedGuestCounts.ts` - Shared hook
- `hooks/guests/index.ts` - Export new hook
- `components/features/host-dashboard/EventSummaryCard.tsx` - Use unified counts
- `app/host/events/[eventId]/dashboard/page.tsx` - Use unified counts for ModernActionList
- `components/features/host-dashboard/GuestManagement.tsx` - Use unified counts for filter pills
- `__tests__/integration/unified-guest-counts.test.ts` - Test coverage
