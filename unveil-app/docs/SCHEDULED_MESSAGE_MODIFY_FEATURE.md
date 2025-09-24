# Scheduled Message Cancel & Modify Feature

## Overview

This feature enhances the scheduled message functionality with improved Cancel UX and a new Modify capability that allows hosts to edit scheduled messages before they are sent.

## Features Implemented

### 1. Enhanced Cancel Experience

**Before:**

- Basic `confirm()` dialog
- No error handling or rollback
- Limited user feedback

**After:**

- Rich modal dialog with message preview
- Shows recipient count and delivery methods
- Clear warning about irreversible action
- Proper error handling with retry options
- Optimistic updates with rollback on failure

### 2. Modify Capability

**New functionality:**

- "Modify" button on upcoming scheduled messages
- Opens composer prefilled with existing message data
- Supports editing content, timing, audience, and delivery methods
- Real-time validation of timing constraints
- Version tracking with "Modified" indicators

## Technical Implementation

### Database Changes

```sql
-- Added versioning columns to scheduled_messages table
ALTER TABLE scheduled_messages 
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN modified_at TIMESTAMPTZ,
ADD COLUMN modification_count INTEGER DEFAULT 0;

-- New RPC function for safe updates
CREATE FUNCTION update_scheduled_message(...)
RETURNS JSONB
SECURITY DEFINER;
```

### API Changes

- **New RPC:** `update_scheduled_message` - Handles message updates with validation
- **Enhanced Client:** `updateScheduledMessage()` function in messaging-client.ts
- **Validation:** Timing constraints, content limits, permission checks

### UI Components

- **CancelMessageDialog:** Rich confirmation dialog
- **MessageComposer:** Enhanced to support prefilling and editing modes
- **UpcomingMessageCard:** Added Modify button and Modified indicators
- **RecentMessages:** Integrated cancel/modify handlers

### Security & Validation

- **RLS Enforcement:** Only hosts can modify their own messages
- **Timing Constraints:** 3-minute minimum lead time + 1-minute freeze window
- **Status Validation:** Only `scheduled` messages can be modified
- **Content Validation:** Length limits and required fields

### Always-On Feature

The Modify capability is now always enabled and gated only by business rules:

- Message status must be `scheduled`
- Send time must be at least 4 minutes in the future (3min + 1min freeze window)

## Usage

### For Hosts

1. **View Upcoming Messages:** Navigate to Message History tab
2. **Modify Message:** Click "Modify" button on upcoming message cards
3. **Edit Content:** Update message text, timing, or audience in prefilled composer
4. **Save Changes:** Click "Schedule Message" to apply updates
5. **Cancel Message:** Click "Cancel" for enhanced confirmation dialog

### Timing Rules

- Messages can only be modified if `status = 'scheduled'`
- Must be at least 4 minutes before send time (3min + 1min freeze window)
- Messages within freeze window show no Modify button

### Visual Indicators

- **Modified Badge:** Shows "✏️ Modified Nx" for edited messages
- **Action Buttons:** Modify (blue) and Cancel (red) buttons
- **Status Updates:** Real-time updates via Supabase subscriptions

## Observability

### PII-Safe Telemetry

All operations log structured events without sensitive data:

```typescript
// Cancel events
logger.sms('Schedule cancel requested', {
  event_id: eventId,
  scheduled_id: messageId,
  status_before: 'scheduled',
  send_at_delta_seconds: 3600,
  content_length: 150,
});

// Modify events  
logger.sms('Schedule modify succeeded', {
  event_id: eventId,
  scheduled_id: messageId,
  send_at_delta_seconds: 7200,
  content_length: 180,
  audience_changed: false,
});
```

### Error Handling

- Network failures show user-friendly error messages
- Validation errors provide specific guidance
- Optimistic updates with automatic rollback
- Retry mechanisms for transient failures

## Testing

### Unit Tests

- `CancelMessageDialog.test.tsx` - Dialog component behavior
- Validation logic for timing constraints
- RPC function authorization and edge cases

### E2E Tests

- `scheduled-message-modify.spec.ts` - Full user workflows
- Cancel and modify flows
- Error handling scenarios
- Feature flag behavior

## Rollback Strategy

### Immediate Rollback

- Add a simple guard constant in `canModifyMessage()` returning `false` to hide Modify buttons
- Cancel functionality remains unchanged (enhanced but backward compatible)

### Database Rollback

- New columns are nullable and have defaults
- RPC function can be dropped without affecting existing functionality
- No breaking changes to existing message flow

## Guardrails Maintained

✅ **No Twilio Path Changes:** Worker processes messages normally  
✅ **Direct Messages Delivery-Only:** No changes to direct message behavior  
✅ **No Delivery Backfills:** Messages only create deliveries at send time  
✅ **PII-Safe Logging:** No message content or phone numbers in logs  
✅ **RLS Security:** All operations respect existing permission model  

## Performance Considerations

- **Optimistic Updates:** Immediate UI feedback with server confirmation
- **Real-time Sync:** Supabase subscriptions keep UI in sync
- **Minimal Queries:** Reuses existing data fetching patterns
- **Efficient Validation:** Client-side checks before server calls

## Future Enhancements

- **Bulk Operations:** Cancel/modify multiple messages
- **Advanced Scheduling:** Recurring messages, timezone-aware scheduling  
- **Approval Workflows:** Multi-step approval for sensitive messages
- **Templates:** Save and reuse message templates
- **Analytics:** Detailed metrics on modification patterns

## Acceptance Criteria ✅

- [x] Cancel flow works with improved UX and safe rollback
- [x] Modify works only for scheduled and future send times  
- [x] Prefilled composer loads correctly; changes reflected in UI
- [x] Worker continues to exclude canceled items and respect updated send_at
- [x] Guardrails remain intact (no Twilio changes, no backfills, etc.)
- [x] RLS blocks non-hosts and late edits
- [x] PII-safe telemetry implemented
- [x] Feature flag for easy rollback
