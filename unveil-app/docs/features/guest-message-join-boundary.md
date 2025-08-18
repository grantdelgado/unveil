# Guest Message Join Boundary Implementation

## Overview

The guest message feed now displays a clear visual boundary between messages sent before a guest joined an event and those sent after. This helps preserve context while avoiding confusion for late joiners.

## Implementation Details

### Data Source
- **Join Timestamp**: Uses `event_guests.created_at` as the guest's join timestamp
- **RPC Function**: `get_guest_join_timestamp(event_id)` - SECURITY DEFINER function that returns the calling user's join timestamp for a specific event
- **RLS Enforcement**: The RPC respects existing Row Level Security policies

### UI Components
- **MessageJoinBoundary**: Accessible divider component with proper ARIA labels
- **Styling**: Pre-join messages have subtle archival treatment (80% opacity, slight desaturation)
- **Mobile-Safe**: Uses proper safe areas and touch targets ≥44px

### Boundary Logic
- **Calculation**: Finds the first message created on or after the guest's join timestamp
- **Edge Cases**:
  - No boundary if guest joined before any messages
  - No boundary if guest joined after all messages (all messages get archival styling)
  - Graceful handling of null/missing join timestamps

### Accessibility Features
- `role="separator"` with descriptive `aria-label`
- Screen reader friendly date formatting
- Keyboard navigation compatible
- High contrast maintained for readability

### Performance Considerations
- Single RPC call per event view (cached via hook)
- Boundary calculation uses `useMemo` to avoid recalculation
- No additional queries per message
- Maintains existing pagination/virtualization

### Security
- RPC function only exposes caller's own join timestamp
- No access to other users' join times
- Existing RLS policies remain intact
- No broad permission grants

## Testing
- Playwright e2e tests cover boundary presence/absence scenarios
- Mobile-friendly layout verification
- Accessibility compliance testing
- Timezone formatting validation

## Rollback Plan
- Hide boundary rendering by removing `MessageJoinBoundary` component usage
- Revert pre-join message styling
- RPC function can remain (non-breaking) or be dropped if needed
