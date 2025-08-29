# Guest Pagination Implementation - Test Plan

## Overview
This document outlines the testing approach for the newly implemented server-side pagination with infinite scroll in the Host Guest Management page.

## Implementation Summary

### Files Changed
- ✅ `lib/config/guests.ts` - Feature flag configuration
- ✅ `hooks/guests/useSimpleGuestStore.ts` - Pagination logic
- ✅ `components/features/host-dashboard/GuestManagement.tsx` - Infinite scroll UI
- ✅ `__tests__/hooks/useSimpleGuestStore-basic.test.ts` - Basic configuration tests

### Key Features
- **Safe Rollback**: `GuestsFlags.paginationEnabled = false` reverts to pre-change behavior
- **Server Pagination**: 50 guests per page using existing RPC function
- **Infinite Scroll**: Automatic loading when scrolling near bottom
- **Deduplication**: Prevents duplicate guests when appending pages
- **Filter Reset**: Pagination resets when changing filters/search

## Manual Testing Checklist

### Prerequisites
- Event with 134+ guests (target event: `24caa3a8-020e-4a80-9899-35ff2797dcc0`)
- Host access to the event
- Chrome DevTools open to monitor network requests

### Test Cases

#### ✅ 1. Initial Load (Page 1)
- [ ] Navigate to Host → Guest Management
- [ ] Verify "All 134" chip shows correct total
- [ ] Verify list shows first 50 guests
- [ ] Check Network tab: RPC call with `p_limit: 50, p_offset: 0`
- [ ] Verify loading state appears briefly

#### ✅ 2. Infinite Scroll (Page 2)
- [ ] Scroll to bottom of guest list
- [ ] Verify "Loading more guests..." appears
- [ ] Verify list grows to 100 guests (no duplicates)
- [ ] Check Network tab: RPC call with `p_limit: 50, p_offset: 50`
- [ ] Verify smooth scrolling experience

#### ✅ 3. Complete Loading (Page 3)
- [ ] Continue scrolling to load page 3
- [ ] Verify list shows all 134 guests
- [ ] Verify no more loading indicator appears
- [ ] Verify no duplicate guests in list
- [ ] Check Network tab: RPC call with `p_limit: 50, p_offset: 100`

#### ✅ 4. Filter Reset
- [ ] Switch to "Invited" filter
- [ ] Verify list resets and shows only invited guests
- [ ] Switch back to "All"
- [ ] Verify pagination resets to page 1 (first 50 guests)
- [ ] Verify can scroll to load more pages again

#### ✅ 5. Search Reset
- [ ] Enter search term (e.g., "John")
- [ ] Verify list filters immediately
- [ ] Clear search term
- [ ] Verify pagination resets to page 1

#### ✅ 6. Rollback Test
- [ ] Set `GuestsFlags.paginationEnabled = false` in `lib/config/guests.ts`
- [ ] Refresh page
- [ ] Verify all 134 guests load immediately
- [ ] Check Network tab: RPC call with `p_limit: undefined, p_offset: 0`
- [ ] Verify no infinite scroll behavior
- [ ] Reset `GuestsFlags.paginationEnabled = true`

#### ✅ 7. Mobile Testing
- [ ] Test on mobile viewport (iPhone 14 Pro simulation)
- [ ] Verify infinite scroll triggers correctly on touch scroll
- [ ] Verify loading indicator is visible and well-positioned
- [ ] Verify no horizontal scrolling issues

#### ✅ 8. Performance Testing
- [ ] Monitor memory usage while scrolling through all pages
- [ ] Verify no memory leaks in Chrome DevTools
- [ ] Verify smooth scrolling performance
- [ ] Check that intersection observer cleans up properly

### Error Scenarios

#### ✅ 9. Network Error Handling
- [ ] Block network in DevTools after loading page 1
- [ ] Try to scroll to trigger page 2
- [ ] Verify error handling (keeps existing guests)
- [ ] Restore network and verify recovery

#### ✅ 10. Empty State
- [ ] Test with event that has 0 guests
- [ ] Verify "No guests yet" message appears
- [ ] Verify no infinite scroll behavior

### Performance Metrics

#### Expected Network Requests
- **Page 1**: `get_event_guests_with_display_names(event_id, 50, 0)`
- **Page 2**: `get_event_guests_with_display_names(event_id, 50, 50)`
- **Page 3**: `get_event_guests_with_display_names(event_id, 50, 100)` (returns 34 items)

#### Expected Memory Usage
- Should remain stable across all pages
- No significant memory growth when scrolling
- Proper cleanup when component unmounts

### Acceptance Criteria

- ✅ All 134 guests eventually load via pagination
- ✅ Count chips match actual list length
- ✅ No console errors during normal operation
- ✅ Smooth infinite scroll on desktop and mobile
- ✅ Filter switching resets pagination correctly
- ✅ Feature flag rollback works immediately
- ✅ No regressions in existing RSVP functionality

### Debug Logging

When `NODE_ENV === 'development'`, check console for:
```
guests.pagination: { page: 1, pageSize: 50, received: 50, hasMore: true }
guests.pagination: { page: 2, pageSize: 50, received: 50, hasMore: true }
guests.pagination: { page: 3, pageSize: 50, received: 34, hasMore: false }
```

## Implementation Notes

### Safe Rollback Mechanism
```typescript
// To rollback immediately:
export const GuestsFlags = {
  paginationEnabled: false, // Set to false
  pageSize: 50 as const,
} as const;
```

### Key Technical Decisions
1. **Append Strategy**: New pages append to existing list with deduplication
2. **Reset Triggers**: Filter/search changes reset pagination to page 1
3. **Error Handling**: Pagination errors don't clear existing guests
4. **Loading States**: Separate `loading` (initial) and `isPaging` (subsequent)
5. **Intersection Observer**: 100px trigger margin for smooth UX

### Monitoring in Production
- Watch for any performance issues with large guest lists
- Monitor error rates on pagination RPC calls
- Track user engagement with infinite scroll feature
- Verify no memory leaks in long-running sessions
