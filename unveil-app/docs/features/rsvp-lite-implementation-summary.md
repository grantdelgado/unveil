# RSVP-Lite Implementation Summary

**📅 Completed**: January 2025  
**🎯 Goal**: Replace complex RSVP system with minimal "decline-only" flow  
**📊 Status**: ✅ Complete - Ready for Production  

---

## 📘 Overview

RSVP-Lite transforms Unveil's RSVP system from a complex 4-option flow (Attending/Maybe/Declined/Pending) to a streamlined approach where **guests are attending by default unless they explicitly decline**.

### Key Benefits

- **Reduced Friction**: No mandatory RSVP step - guests can focus on event content
- **Cleaner Messaging**: Hosts target "attending" guests by default (excludes declined)
- **Mobile-First**: Simple 2-tap decline flow with optional reason
- **Host Control**: Hosts can clear guest declines and include declined guests in messages

---

## 🛠 Implementation Details

### Database Changes (Additive & Non-Destructive)

**New Fields in `event_guests`:**
```sql
declined_at TIMESTAMPTZ NULL     -- When guest declined
decline_reason TEXT NULL         -- Optional reason (max ~200 chars)
```

**New RPCs:**
- `guest_decline_event(event_id, reason?)` - Guest declines with optional reason
- `host_clear_guest_decline(event_id, guest_user_id)` - Host clears decline
- `is_guest_attending_rsvp_lite(event_id, user_id)` - Check if attending (not declined)

### UI Components

**Guest Experience:**
- `CantMakeItButton` - Subtle link to decline flow
- `DeclineEventModal` - 2-step decline with optional reason
- `DeclineBanner` - Post-decline status with contact host option

**Host Experience:**
- Decline indicators in guest list with reasons
- "Clear decline" button for hosts
- "Include declined guests" toggle in messaging
- Default messaging filter: "Attending" (excludes declined)

### Feature Flag System

```typescript
// lib/constants/features.ts
FEATURE_FLAGS = {
  RSVP_LITE: true,      // New decline-only system
  LEGACY_RSVP: false,   // Old 4-option system
}
```

---

## 🎯 User Flows

### Guest Decline Flow

1. **Entry Point**: "Can't make it?" link on event home (non-primary)
2. **Confirmation**: Modal with event context and optional reason field
3. **Success**: Toast notification + persistent banner
4. **Post-Decline**: Banner with "contact host" option, dismissible

### Host Management Flow

1. **Visibility**: Declined guests show amber warning in guest list
2. **Details**: Decline reason displayed if provided
3. **Action**: "Clear decline" button with confirmation
4. **Messaging**: "Attending" filter excludes declined by default

### Messaging Segmentation

- **Default**: "Attending" (excludes declined guests)
- **Option**: "Include declined guests" toggle for special messages
- **Legacy**: "All Guests" and "Pending RSVPs" still available

---

## 🔧 Technical Architecture

### Database Schema (RSVP-Lite Fields)

```sql
-- event_guests table additions
ALTER TABLE event_guests 
ADD COLUMN declined_at timestamptz NULL,
ADD COLUMN decline_reason text NULL;

-- Index for efficient queries
CREATE INDEX idx_event_guests_declined_at 
ON event_guests (event_id, declined_at) 
WHERE declined_at IS NOT NULL;
```

### RLS Security

- Guest decline RPC: Only allows guests to decline their own invitations
- Host clear RPC: Requires `is_event_host()` check
- All operations are idempotent and audit-logged

### Messaging Integration

```typescript
// Updated messaging filter
type RecipientFilter = {
  type: 'all' | 'tags' | 'rsvp_status' | 'individual';
  includeDeclined?: boolean; // Default: false
  // ... other filters
}
```

---

## 📊 Analytics Impact

### Updated Definitions

- **Attending**: `declined_at IS NULL` (RSVP-Lite definition)
- **Declined**: `declined_at IS NOT NULL`
- **Response Rate**: Not applicable (no required response)

### Preserved Metrics

- Total guest count
- Message delivery stats
- Media engagement
- Event participation

---

## 🧪 Testing & Validation

### Acceptance Criteria ✅

- [x] Guests can decline with 2-tap flow and optional reason
- [x] Success toast and dismissible banner appear post-decline
- [x] Hosts see decline indicators with reasons
- [x] Hosts can clear guest declines with confirmation
- [x] Messaging defaults to "Attending" (excludes declined)
- [x] "Include declined" toggle works for special messages
- [x] RPCs are RLS-safe and idempotent
- [x] No regressions to messaging, realtime, or onboarding
- [x] UI respects safe areas and mobile ergonomics (≥44px touch targets)
- [x] Legacy RSVP system feature-flagged off

### Test Coverage

- **Unit Tests**: RPC validation, UI state management
- **Integration Tests**: Decline flow, host controls, messaging filters
- **E2E Tests**: Complete guest decline → host clear → messaging workflow

---

## 🚀 Deployment & Rollback

### Rollout Strategy

1. **Feature Flag**: `RSVP_LITE=true` enables new system
2. **Gradual**: Can be toggled per environment
3. **Monitoring**: Track decline rates and user feedback

### Rollback Plan

- **UI Rollback**: Set `RSVP_LITE=false, LEGACY_RSVP=true`
- **Data Safety**: All new fields are nullable, no data loss
- **RPC Safety**: Functions can be disabled via RLS if needed

---

## 📋 Copy & Messaging

### Guest-Facing Copy

- **Link**: "Can't make it?"
- **Modal Title**: "Can't make it to this event?"
- **Modal Body**: "You'll stop receiving day-of logistics unless the host includes you."
- **Reason Placeholder**: "Optional: Share a brief reason (private to hosts)"
- **Success Toast**: "Marked as not attending"
- **Banner**: "You've marked that you can't make it. You can contact the host if this changed."

### Host-Facing Copy

- **Filter**: "✅ Attending (excludes declined)"
- **Toggle**: "Include declined guests"
- **Indicator**: "⚠️ Can't make it"
- **Action**: "Clear decline"

---

## 🔄 Migration Notes

### Backward Compatibility

- Existing `rsvp_status` field preserved
- Legacy RSVP components still available via feature flag
- All analytics and reporting continue to work
- No breaking changes to existing APIs

### Data Migration

No migration required - system is purely additive:
- New installs get RSVP-Lite by default
- Existing events continue with current RSVP data
- Hosts can use either system via feature flags

---

## 📈 Success Metrics

### Primary KPIs

- **Decline Rate**: % of guests who explicitly decline
- **Host Adoption**: % of hosts using new messaging filters
- **User Satisfaction**: Feedback on simplified flow

### Secondary Metrics

- **Time to Decline**: Speed of decline flow completion
- **Reason Completion**: % of declines that include reasons
- **Clear Actions**: Host usage of decline clearing

---

## 🎉 Conclusion

RSVP-Lite successfully transforms Unveil's RSVP system from a complex, friction-heavy process to a streamlined, mobile-first experience. The implementation preserves all existing functionality while providing a cleaner default experience for both guests and hosts.

**Key Achievements:**
- ✅ Zero-friction default experience (attending by default)
- ✅ Simple decline flow with host communication channel
- ✅ Improved messaging targeting with smart defaults
- ✅ Full backward compatibility and safe rollout
- ✅ Mobile-optimized UI with accessibility compliance

The system is ready for production deployment with comprehensive testing, feature flag controls, and a clear rollback strategy.
