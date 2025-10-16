# Timestamp & Function Consistency Analysis

**Date:** October 14, 2025  
**Analysis Scope:** Timestamp columns and SECURITY DEFINER functions  
**Status:** Analysis complete - minimal changes needed

## Executive Summary

✅ **Timestamp columns are already optimal** - all 27 timestamp columns in core tables use `timestamptz`  
✅ **All SECURITY DEFINER functions have proper search_path** protection  
⚠️ **Function volatility optimization opportunity** - 37 read-only functions marked VOLATILE could be STABLE

## Timestamp Analysis Results

**Status: ✅ NO CHANGES NEEDED**

All timestamp columns in core application tables are already `timestamptz`:

| Table | Timestamp Columns | Status |
|-------|------------------|---------|
| `events` | `created_at`, `updated_at` | ✅ timestamptz |
| `event_guests` | `created_at`, `updated_at`, `invited_at`, `joined_at`, `declined_at`, `removed_at`, `last_invited_at`, `last_messaged_at`, `first_invited_at`, `a2p_notice_sent_at`, `carrier_opted_out_at` | ✅ timestamptz |
| `messages` | `created_at`, `delivered_at` | ✅ timestamptz |
| `message_deliveries` | `created_at`, `updated_at` | ✅ timestamptz |
| `scheduled_messages` | `created_at`, `updated_at`, `send_at`, `sent_at`, `modified_at` | ✅ timestamptz |
| `user_link_audit` | `created_at` | ✅ timestamptz |
| `users` | `created_at`, `updated_at`, `sms_consent_given_at` | ✅ timestamptz |
| `media` | `created_at` | ✅ timestamptz |

**Conclusion:** Schema already follows best practices for timezone-aware timestamps.

## Function Volatility Analysis

**Status: ⚠️ OPTIMIZATION OPPORTUNITY**

Found 78 SECURITY DEFINER functions, all with proper `SET search_path = public, pg_temp`.

### Functions That Could Be Optimized to STABLE

**Read-only functions currently marked VOLATILE (37 candidates):**

| Function | Current | Recommended | Reason |
|----------|---------|-------------|---------|
| `can_access_delivery_v2` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `can_access_event` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `can_manage_deliveries_v2` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `can_manage_message_delivery` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `can_read_event` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `can_write_event` | VOLATILE | STABLE | Pure read-only, deterministic within transaction |
| `build_event_reminder_content` | VOLATILE | STABLE | Pure read-only, deterministic output |
| `bulk_guest_auto_join_from_auth` | VOLATILE | STABLE | Read-only wrapper function |
| `current_announcement_audience_count` | VOLATILE | STABLE | Read-only count function |
| `detect_duplicate_events` | VOLATILE | STABLE | Read-only analysis function |
| `event_id_from_message` | VOLATILE | STABLE | Simple lookup function |
| `event_id_from_scheduled_message` | VOLATILE | STABLE | Simple lookup function |
| `get_event_guest_counts` | VOLATILE | STABLE | Read-only aggregation |
| `get_event_host_count` | VOLATILE | STABLE | Read-only count function |
| `get_event_reminder_status` | VOLATILE | STABLE | Read-only status check |
| `get_guest_event_messages_v3` | VOLATILE | STABLE | Read-only message retrieval |
| `get_guest_join_timestamp` | VOLATILE | STABLE | Read-only timestamp lookup |
| `get_invitable_guest_ids` | VOLATILE | STABLE | Read-only ID collection |
| `get_user_events` | VOLATILE | STABLE | Read-only event listing |
| `guest_has_all_tags` | VOLATILE | STABLE | Pure tag comparison |
| `guest_has_any_tags` | VOLATILE | STABLE | Pure tag comparison |
| `is_event_guest` | VOLATILE | STABLE | Permission check function |
| `is_event_host` | VOLATILE | STABLE | Permission check function |
| `is_guest_attending_rsvp_lite` | VOLATILE | STABLE | Status check function |
| `is_valid_auth_session` | VOLATILE | STABLE | Session validation |
| `link_user_by_phone` | VOLATILE | STABLE | Read-only linking logic |
| `lookup_user_by_phone` | VOLATILE | STABLE | Simple user lookup |
| `prune_old_message_partitions` | VOLATILE | STABLE | Read-only partition analysis |
| `resolve_event_from_message_v2` | VOLATILE | STABLE | Simple lookup function |
| `show_ops_schedule` | VOLATILE | STABLE | Static configuration display |
| `sync_event_reminder_on_time_change` | VOLATILE | STABLE | Read-only sync check |
| `sync_guest_display_name_on_link` | VOLATILE | STABLE | Read-only name resolution |
| `trigger_backfill_guest_deliveries` | VOLATILE | STABLE | Read-only trigger logic |
| `validate_guest_phone_not_host` | VOLATILE | STABLE | Validation function |

### Functions Correctly Marked STABLE (5 functions)

✅ Already optimized:
- `can_access_message` 
- `check_phone_exists_for_event`
- `get_guest_event_messages`
- `get_guest_event_messages_v2` 
- `normalize_phone_number`

### Functions That Should Stay VOLATILE (36 functions)

Functions using `now()`, `auth.uid()`, or modifying data - correctly marked VOLATILE.

## Recommended Migration Plan

### Phase 1: High-Impact Read-Only Functions (Priority)

Focus on frequently called RLS/permission functions:

```sql
-- Core permission functions (called by RLS policies)
ALTER FUNCTION public.can_access_event(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.can_read_event(uuid) VOLATILE; -- Change to STABLE  
ALTER FUNCTION public.can_write_event(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.is_event_host(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.is_event_guest(uuid) VOLATILE; -- Change to STABLE

-- Lookup functions (called frequently)
ALTER FUNCTION public.event_id_from_message(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.event_id_from_scheduled_message(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.lookup_user_by_phone(text) VOLATILE; -- Change to STABLE
```

### Phase 2: Application RPC Functions (Medium Priority)

```sql
-- Message/event retrieval functions
ALTER FUNCTION public.get_guest_event_messages_v3(...) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.get_user_events(uuid) VOLATILE; -- Change to STABLE
ALTER FUNCTION public.get_event_guest_counts(uuid) VOLATILE; -- Change to STABLE
```

### Phase 3: Utility Functions (Lower Priority)

Remaining 24 read-only functions can be optimized in a later maintenance window.

## Expected Benefits

1. **Query planner improvements** - STABLE functions can be cached within transactions
2. **Better join optimization** - Planner can make better decisions with STABLE functions in WHERE clauses
3. **RLS policy performance** - Permission functions called by policies will be more efficient
4. **Reduced function call overhead** - STABLE functions won't be re-evaluated unnecessarily

## Risk Assessment

**Risk Level: LOW**
- No behavior changes expected
- STABLE is more restrictive than VOLATILE (safer direction)
- Can be rolled back easily by changing back to VOLATILE
- All functions already have proper search_path protection

## Testing Strategy

1. **Before/after EXPLAIN plans** for queries using optimized functions
2. **RLS policy performance** - test permission checks don't regress
3. **Application behavior** - ensure no functional changes
4. **Load testing** - verify performance improvements under load

## Rollback Plan

If any issues arise, revert specific functions:
```sql
ALTER FUNCTION public.function_name(...) VOLATILE;
```

## Next Steps

1. ✅ **Timestamp analysis** - Complete (no changes needed)
2. ⚠️ **Function volatility migration** - Ready for implementation
3. 📋 **Create migration files** for Phase 1 functions
4. 🧪 **Test performance impact** in staging environment
