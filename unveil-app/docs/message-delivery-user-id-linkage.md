# Message Delivery User ID Linkage System

## Overview

This document describes the comprehensive system for ensuring `message_deliveries.user_id` is consistently populated when resolvable, implemented to fix the issue where guests couldn't see messages due to NULL `user_id` values in their delivery records.

## Problem Statement

**Issue**: Some guests had `message_deliveries` records with `user_id = NULL` even though their `event_guests.user_id` was properly set, preventing them from seeing messages through RLS-based queries.

**Root Cause**: Timing mismatch - deliveries were created before guests were linked to users, and no backfill mechanism existed to update existing deliveries when guests got linked later.

## Solution Architecture

### 1. Delivery Creation (Existing)

**Location**: `upsert_message_delivery` RPC function  
**Trigger**: `trigger_message_deliveries_auto_link_user`  
**Function**: `auto_link_user_by_phone_trigger` → `link_user_by_phone`

**How it works**:

- When a new delivery is created, the trigger attempts to resolve `user_id`
- First tries to link via `event_guests.user_id` (preferred)
- Falls back to unique phone→user mapping if enabled
- Logs all attempts in `user_link_audit` table

### 2. Guest Linkage Backfill (New)

**Location**: Trigger on `event_guests` table  
**Trigger**: `trigger_backfill_deliveries_on_guest_link`  
**Function**: `trigger_backfill_guest_deliveries` → `backfill_guest_deliveries`

**How it works**:

- When `event_guests.user_id` changes from NULL to a value, trigger fires
- Finds all existing deliveries for that guest with `user_id = NULL`
- Updates them with the newly linked `user_id`
- Logs backfill operations in `user_link_audit` table

### 3. One-Time Historical Backfill (Completed)

**Migration**: `one_time_delivery_backfill_with_phone`  
**Purpose**: Fixed all existing inconsistencies in production

**Results**:

- **Before**: 3 inconsistent deliveries (4.23%)
- **After**: 0 inconsistent deliveries (0.00%)

## Linkage Rules

### Priority Order

1. **Guest Record Link** (Preferred)

   - Source: `event_guests.user_id`
   - Condition: Guest has `user_id` set and `removed_at IS NULL`
   - Reliability: Highest (authoritative source of truth)

2. **Phone Fallback** (Optional)
   - Source: `users.phone` matching `message_deliveries.phone_number`
   - Condition: Feature flag `LINK_USER_BY_PHONE_FALLBACK_TO_USERS` enabled
   - Requirement: Exactly one user with that phone (no ambiguity)
   - Reliability: Lower (phone numbers can change/be reused)

### Ambiguity Handling

- **Multiple guests**: If multiple active guests have the same phone in an event → `no_match`
- **Multiple users**: If multiple users have the same phone → `no_match`
- **Feature disabled**: If linking features are disabled → `skipped`

## Implementation Details

### Database Objects

#### Functions

- `public.backfill_guest_deliveries(guest_id, user_id)` - Backfills deliveries for a guest
- `public.trigger_backfill_guest_deliveries()` - Trigger function for guest updates
- `public.link_user_by_phone(event_id, phone)` - Core linking logic (existing)
- `public.auto_link_user_by_phone_trigger()` - Trigger for new deliveries (existing)

#### Triggers

- `trigger_backfill_deliveries_on_guest_link` on `event_guests` - NEW
- `trigger_message_deliveries_auto_link_user` on `message_deliveries` - Existing

#### Tables

- `user_link_audit` - Logs all linking attempts and outcomes

### Feature Flags

```sql
-- Check current status
SELECT
  get_feature_flag('LINK_USER_BY_PHONE') as main_linking,
  get_feature_flag('LINK_USER_BY_PHONE_FALLBACK_TO_USERS') as phone_fallback;
```

**Current Settings**:

- `LINK_USER_BY_PHONE`: `true` (main linking enabled)
- `LINK_USER_BY_PHONE_FALLBACK_TO_USERS`: `false` (phone fallback disabled)

## Monitoring & Maintenance

### Daily Integrity Check

**Script**: `scripts/daily-delivery-integrity-check.sql`

**Usage**:

```bash
# Run daily via cron
psql -f scripts/daily-delivery-integrity-check.sql
```

**Alerts**:

- 🚨 **Critical**: Inconsistency rate > 1.0% → Investigate immediately
- ⚠️ **Warning**: Any inconsistencies detected → Monitor closely
- ✅ **Healthy**: 0 inconsistencies

### Key Metrics

1. **Inconsistency Rate**: `(NULL user_id deliveries with linked guests) / total deliveries`
2. **Trigger Success Rate**: `successful_links / total_attempts` in last 24h
3. **Backfill Activity**: Count of automatic backfill operations

### Audit Trail

All linking operations are logged in `user_link_audit`:

```sql
-- View recent linking activity
SELECT
  table_name,
  outcome,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM user_link_audit
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY table_name, outcome
ORDER BY latest DESC;
```

## Troubleshooting

### Common Issues

1. **New deliveries still have NULL user_id**

   - Check if `trigger_message_deliveries_auto_link_user` is enabled
   - Verify feature flags are set correctly
   - Check `user_link_audit` for `no_match` or `skipped` outcomes

2. **Guest linkage doesn't trigger backfill**

   - Check if `trigger_backfill_deliveries_on_guest_link` is enabled
   - Verify the guest update changed `user_id` from NULL to non-NULL
   - Look for errors in PostgreSQL logs

3. **Inconsistencies persist**
   - Run integrity check to identify specific cases
   - Check for data corruption or race conditions
   - Consider manual backfill for specific guests

### Manual Backfill

If automatic backfill fails, you can manually fix specific guests:

```sql
-- Manual backfill for a specific guest
SELECT public.backfill_guest_deliveries(
  'guest-id-here'::uuid,
  'user-id-here'::uuid
);
```

### Debugging Queries

```sql
-- Find deliveries that should be linkable but aren't
SELECT
  d.id as delivery_id,
  g.guest_name,
  g.user_id as guest_user_id,
  d.user_id as delivery_user_id,
  g.event_id
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
WHERE d.user_id IS NULL
  AND g.user_id IS NOT NULL
  AND g.removed_at IS NULL;

-- Check recent trigger activity
SELECT * FROM user_link_audit
WHERE table_name IN ('message_deliveries', 'message_deliveries_backfill')
ORDER BY created_at DESC
LIMIT 10;
```

## Performance Considerations

### Indexes

- Existing indexes on `message_deliveries(guest_id)` and `event_guests(user_id)` support efficient lookups
- `user_link_audit` table has minimal performance impact due to low write volume

### Trigger Performance

- Backfill trigger only fires on `user_id` changes from NULL → value (rare)
- Backfill function uses single UPDATE with WHERE clause (efficient)
- Audit logging adds minimal overhead

### Scalability

- System scales with number of guests, not messages (backfill is per-guest)
- Trigger-based approach ensures consistency without batch processing
- Feature flags allow disabling if needed

## Future Enhancements

### Potential Improvements

1. **Batch Backfill**: For bulk guest imports, batch backfill operations
2. **Phone Validation**: Enhanced phone number validation before linking
3. **Conflict Resolution**: Better handling of edge cases and conflicts
4. **Performance Monitoring**: Track trigger execution times and impact

### Extensibility

- System is designed to handle additional linking sources (email, external IDs)
- Audit trail supports adding new outcome types and metadata
- Feature flag system allows gradual rollout of new linking strategies

## Rollback Plan

If issues arise, the system can be safely disabled:

```sql
-- Disable backfill trigger
ALTER TABLE event_guests DISABLE TRIGGER trigger_backfill_deliveries_on_guest_link;

-- Disable new delivery linking
ALTER TABLE message_deliveries DISABLE TRIGGER trigger_message_deliveries_auto_link_user;

-- Disable via feature flags (preferred)
-- Update feature_flags table to set LINK_USER_BY_PHONE = false
```

**Recovery**: All changes are reversible and the system maintains full audit trails for rollback scenarios.

## Summary

This comprehensive linkage system ensures `message_deliveries.user_id` is consistently populated through:

1. **Prevention**: Auto-linking new deliveries when created
2. **Correction**: Backfilling existing deliveries when guests get linked
3. **Detection**: Daily monitoring for any inconsistencies
4. **Resolution**: Tools and procedures for manual fixes

The system is production-safe, fully audited, and designed for minimal maintenance while providing maximum reliability for guest message visibility.
