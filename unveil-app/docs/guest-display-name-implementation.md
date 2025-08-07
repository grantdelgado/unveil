# Guest Display Name Implementation

This document describes the implementation of query-time override for guest names, ensuring that when a guest is linked to a user record with a `full_name`, the system displays the user's name instead of the original `guest_name`.

## Overview

The implementation uses a database function with `COALESCE(users.full_name, event_guests.guest_name, 'Unnamed Guest')` to provide a computed `guest_display_name` field that:

1. **Prefers user's full_name** when guest is linked to a user account
2. **Falls back to guest_name** when no user is linked or user has no full_name
3. **Falls back to "Unnamed Guest"** when both values are null
4. **Never modifies the original guest_name** field in the database

## Database Changes

### Migration: `20250200000000_add_guest_display_name_function.sql`

**Database Function:**
```sql
CREATE OR REPLACE FUNCTION public.get_event_guests_with_display_names(
  p_event_id UUID,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
```

**Key Features:**
- Uses `LEFT JOIN` to include user data
- Returns computed `guest_display_name` field
- Supports pagination with `p_limit` and `p_offset`
- Maintains all original guest fields
- Includes flattened user data for compatibility

**Performance Optimizations:**
- Added indexes on `event_guests.user_id` for efficient JOINs
- Composite index on `(event_id, user_id)` for event-scoped queries
- Uses `CONCURRENTLY` for non-blocking index creation

## Type System Updates

### Enhanced Types

All guest types now include the computed `guest_display_name` field:

```typescript
interface OptimizedGuest {
  // ... existing fields
  /** 
   * Computed display name from COALESCE(users.full_name, event_guests.guest_name)
   * Prefer this over guest_name for UI display
   * @readonly
   */
  guest_display_name: string;
}
```

**Updated Types:**
- `OptimizedGuest` in `hooks/guests/useGuestData.ts`
- `OptimizedGuest` in `components/features/host-dashboard/types.ts`
- `GuestWithUser` in `lib/utils/guestFiltering.ts`
- `SimpleGuest` in `hooks/guests/useSimpleGuestStore.ts`
- Added `EventGuestWithDisplayName` in `lib/supabase/types.ts`

## Hook Updates

All guest-fetching hooks now use the RPC function:

### Updated Hooks:
1. **`useGuestData`** - Main guest data hook with pagination and search
2. **`useGuests`** - Simplified guest fetching hook
3. **`useRealtimeGuestStore`** - Real-time guest data with subscriptions
4. **`useSimpleGuestStore`** - Lightweight guest data store

### Implementation Pattern:
```typescript
const { data: guestData, error } = await supabase
  .rpc('get_event_guests_with_display_names', {
    p_event_id: eventId,
    p_limit: limit,
    p_offset: offset
  });

// Transform RPC data to OptimizedGuest format
const guests = guestData.map(guest => ({
  ...guest,
  guest_display_name: guest.guest_display_name, // Already computed
  users: guest.user_id ? {
    id: guest.user_id,
    full_name: guest.user_full_name,
    // ... other user fields
  } : null
}));
```

## Service Layer Updates

### `lib/services/events.ts`

Updated `getEventGuests()` function to use the RPC function and maintain backward compatibility with existing consumers.

## UI Component Updates

### Updated Components:
1. **`GuestListItem`** - Updated display name logic with fallbacks
2. **`GuestManagement`** - Enhanced search to include display names
3. **`NotificationCenter`** - Updated activity descriptions

### Display Logic Pattern:
```typescript
// Preferred approach with fallbacks
const displayName = guest.guest_display_name || 
                   guest.users?.full_name || 
                   guest.guest_name || 
                   'Unnamed Guest';
```

### Search Enhancement:
```typescript
// Search now includes computed display name
const searchLower = searchTerm.toLowerCase();
return displayName.includes(searchLower) ||
       guestName.includes(searchLower) ||
       // ... other search fields
```

## Testing

### Test Coverage:

1. **Database Tests** (`__tests__/database/guest-display-name-rpc.test.ts`)
   - COALESCE logic with all scenarios
   - Pagination support
   - Performance validation
   - RLS policy compliance

2. **Hook Tests** (`__tests__/hooks/guest-display-name-hooks.test.ts`)
   - Data transformation accuracy
   - Error handling
   - Pagination behavior
   - Search functionality

3. **UI Tests** (`__tests__/components/guest-display-name-ui.test.tsx`)
   - Display name preference order
   - Fallback logic
   - Accessibility compliance
   - Data integrity

4. **Service Tests** (`__tests__/lib/guest-display-name.test.ts`)
   - RPC function integration
   - Edge case handling
   - Type safety validation

### Test Scenarios Covered:

✅ **Linked user with full_name** → displays user's name  
✅ **Linked user without full_name** → falls back to guest_name  
✅ **Unlinked guest** → displays guest_name  
✅ **No names available** → displays "Unnamed Guest"  
✅ **Data integrity** → guest_name never modified  
✅ **Performance** → single query with JOIN, no N+1  
✅ **Pagination** → proper limit/offset handling  
✅ **Search** → works with computed display names  

## Performance Considerations

### Query Optimization:
- **Single RPC call** replaces previous separate queries
- **Efficient LEFT JOIN** with proper indexing
- **No N+1 queries** - all data fetched in one operation
- **Pagination support** to handle large guest lists

### Indexes Added:
```sql
-- For efficient user lookups in JOIN
CREATE INDEX idx_event_guests_user_id ON event_guests(user_id) 
WHERE user_id IS NOT NULL;

-- For event-scoped queries with user data
CREATE INDEX idx_event_guests_event_user ON event_guests(event_id, user_id);
```

### Memory Usage:
- **Flattened user data** prevents nested object allocation overhead
- **Computed field** eliminates client-side name resolution logic
- **Selective field fetching** reduces payload size

## Backward Compatibility

### Maintained Compatibility:
- ✅ **Original `guest_name` field** preserved in all responses
- ✅ **Existing component props** continue to work
- ✅ **Legacy search logic** still functional
- ✅ **Import/export flows** unaffected
- ✅ **Database writes** unchanged

### Migration Strategy:
1. **Database function added** - no breaking changes
2. **Types extended** - additive changes only
3. **Hooks updated** - internal implementation changes
4. **UI enhanced** - improved display logic
5. **Gradual rollout** - old logic as fallback

## Edge Cases Handled

### Data Edge Cases:
- **Null guest_name and user full_name** → "Unnamed Guest"
- **Empty string values** → fallback logic
- **Malformed user data** → graceful degradation
- **Missing RPC function** → fallback to original query

### UI Edge Cases:
- **Long display names** → proper truncation/wrapping
- **Special characters** → proper escaping
- **Accessibility** → screen reader compatibility
- **Search highlighting** → works with computed names

### Performance Edge Cases:
- **Large guest lists** → pagination prevents timeouts
- **Concurrent updates** → real-time subscriptions handle changes
- **Database load** → indexed queries perform efficiently

## Future Enhancements

### Potential Improvements:
1. **Real-time display name updates** when user changes full_name
2. **Search relevance scoring** based on display name matches
3. **Audit trail** for name changes in guest history
4. **Bulk operations** with computed display names
5. **Advanced filtering** by name source (guest vs user)

### Monitoring:
1. **Query performance** monitoring for RPC function
2. **Index usage** analytics
3. **Search effectiveness** metrics
4. **User adoption** of linked names

## Rollback Plan

If issues arise, rollback can be performed by:

1. **Revert hook changes** to use original queries
2. **Remove RPC function calls** from services
3. **Restore original display logic** in components
4. **Keep database function** for future use (safe to leave)

The implementation is designed to be **safe and reversible** with minimal risk to existing functionality.