# Guest Event Messages — Production Visibility Audit

**Date**: 2025-01-30  
**Issue**: Guests Nick Molcsan, Connor Smith, Tom Gazzard cannot see messages in event `24caa3a8-020e-4a80-9899-35ff2797dcc0`  
**Scope**: Production data analysis, RLS policy review, message delivery investigation  

## Executive Summary

**ROOT CAUSE IDENTIFIED**: **Inconsistent `user_id` population in `message_deliveries` table** combined with **broken phone-based RLS fallback**.

**Key Finding**: This IS an RLS and data consistency bug. The guest messaging system fails when:
1. `message_deliveries.user_id` is NULL (despite guest having valid `user_id`)
2. Phone-based RLS fallback returns NULL (`auth.jwt() ->> 'phone'` = NULL in production)

**Impact**: Guests with NULL `user_id` in their delivery records cannot access messages through either access path.

## Data Analysis

### Problem Event Analysis

**Event**: `24caa3a8-020e-4a80-9899-35ff2797dcc0` - Has 30+ messages but guests can't see them

### Affected Guests Analysis

**Problem Guests** (all have valid `user_id` in `event_guests` but different `message_deliveries` patterns):

| Guest | User ID | Matching Deliveries | NULL Deliveries | Total | Access Status |
|-------|---------|-------------------|-----------------|-------|---------------|
| **Nick Molcsan** | `1431c6f7-b99a-4cec-b7cb-208e1a6fa35a` | 0 | 2 | 2 | ❌ **No Access** |
| **Connor Smith** | `9ca3626c-37be-48f8-bda5-b7a79150ece6` | 1 | 1 | 2 | ⚠️ **Partial Access** |
| **Tom Gazzard** | `bbd3b3d1-a657-44e6-85b5-e9bb12339a4f` | 2 | 0 | 2 | ✅ **Full Access** |

### Critical Data Inconsistency

```sql
-- MISMATCH: guest.user_id vs delivery.user_id
SELECT g.guest_name, g.user_id as guest_user_id, d.user_id as delivery_user_id,
       CASE WHEN g.user_id = d.user_id THEN '✅ MATCH' 
            WHEN d.user_id IS NULL THEN '❌ DELIVERY_NULL' END as status
FROM message_deliveries d
JOIN event_guests g ON g.id = d.guest_id
WHERE g.event_id = '24caa3a8-020e-4a80-9899-35ff2797dcc0'
  AND g.guest_name IN ('Nick Molcsan', 'Connor Smith', 'Tom Gazzard');
```

**Results**:
- **Nick Molcsan**: ALL deliveries have `user_id = NULL` ❌
- **Connor Smith**: MIXED - 1 correct, 1 NULL ⚠️  
- **Tom Gazzard**: ALL deliveries have correct `user_id` ✅

### Phone-Based RLS Fallback Test

```sql
-- Test: auth.jwt() ->> 'phone' in production
SELECT auth.jwt() ->> 'phone' as jwt_phone_field;
-- Result: NULL
```

**Critical Finding**: Phone-based RLS fallback is **completely broken** - `auth.jwt() ->> 'phone'` returns NULL in production, so guests with NULL `user_id` deliveries have NO access path.

## Guest Messages Read Path Analysis

### UI Flow
1. **Route**: `/guest/events/[eventId]/home` → `GuestMessaging` component
2. **Hook**: `useGuestMessagesRPC({ eventId, guestId })`
3. **Data Source**: `message_deliveries` table joined with `messages`
4. **Query**: Filters by `user_id = auth.uid()` and `event_id`

### Data Access Pattern
```typescript
// From useGuestMessagesRPC.ts:59-80
const { data: deliveries, error: deliveryError } = await supabase
  .from('message_deliveries')
  .select(`
    sms_status,
    message:messages!message_deliveries_message_id_fkey (
      id, content, created_at, message_type, event_id, sender_user_id,
      sender:users!messages_sender_user_id_fkey(full_name, avatar_url)
    )
  `)
  .eq('user_id', user.id)  // ← Key filter: user_id based
  .order('created_at', { ascending: false })
  .limit(INITIAL_WINDOW_SIZE + 1);

// Filter to specific event
const eventDeliveries = (deliveries || []).filter(d => d.message?.event_id === eventId);
```

### RLS Policy Analysis

**Current RLS Policies** (from `20250129000002_optimize_rls_policies.sql`):

#### Message Deliveries RLS - The Critical Policy
```sql
CREATE POLICY "message_deliveries_select_optimized" ON public.message_deliveries
FOR SELECT TO authenticated, anon
USING (
  -- Path 1: Host access (works)
  EXISTS (SELECT 1 FROM public.scheduled_messages sm JOIN public.events e ON e.id = sm.event_id WHERE sm.id = message_deliveries.scheduled_message_id AND e.host_user_id = (SELECT auth.uid()))
  OR
  EXISTS (SELECT 1 FROM public.messages m JOIN public.events e ON e.id = m.event_id WHERE m.id = message_deliveries.message_id AND e.host_user_id = (SELECT auth.uid()))
  OR
  -- Path 2: Guest user_id access (FAILS when delivery.user_id is NULL)
  (user_id = (SELECT auth.uid()))
  OR
  -- Path 3: Guest phone access (FAILS - auth.jwt() ->> 'phone' returns NULL)
  EXISTS (SELECT 1 FROM public.event_guests eg WHERE eg.id = message_deliveries.guest_id AND eg.phone = (auth.jwt() ->> 'phone') AND (auth.jwt() ->> 'phone') IS NOT NULL)
);
```

**RLS Status**: ❌ **BROKEN** - Both guest access paths fail:
- **Path 2**: Fails when `delivery.user_id` is NULL (data inconsistency)
- **Path 3**: Fails when `auth.jwt() ->> 'phone'` is NULL (broken phone extraction)

## Edge Cases Analysis

### ✅ User↔Guest Linkage
- **Nick Molcsan**: `user_id` properly linked in both events
- **Auto-join process**: `useAutoJoinGuests` hook handles linking invited guests to user accounts
- **Phone normalization**: Consistent E.164 format (`+14157128721`)

### ✅ Message Delivery Access Patterns
- **user_id-based**: `d.user_id = (SELECT auth.uid())` ← Primary access method
- **phone-based**: `eg.phone = (auth.jwt() ->> 'phone')` ← Fallback for unlinked guests
- **Mixed scenarios**: Some deliveries have `user_id = NULL` but guest record has `user_id` ← Works via phone fallback

### ✅ Message Visibility Flags
```sql
-- No visibility flags found
SELECT table_name, column_name FROM information_schema.columns 
WHERE table_name IN ('messages', 'scheduled_messages')
  AND column_name ILIKE '%visible%' OR column_name ILIKE '%hide%' OR column_name ILIKE '%sms_only%';
-- Result: No columns found
```

### ✅ Scheduled vs Sent Messages
- **Scheduled messages**: Stored in `scheduled_messages` table, NOT visible to guests
- **Sent messages**: Copied to `messages` table with delivery records, visible to guests
- **RLS separation**: Guests have `USING (FALSE)` policy for `scheduled_messages`

### ✅ Realtime Subscriptions
- **Channel setup**: Event-scoped subscriptions (`event_id=eq.${eventId}`)
- **Table subscriptions**: Both `messages` and `message_deliveries` tables
- **Pooling**: Optimized subscription pooling prevents duplicate connections

## Repro Script

```bash
# 1. Sign in as Nick Molcsan (user_id: 1431c6f7-b99a-4cec-b7cb-208e1a6fa35a)
# 2. Navigate to: /guest/events/4b2994fe-cec0-48e9-951b-65709d273953/home
# 3. Observe: "No messages" empty state
# 4. Check Network tab: 
#    - Query to message_deliveries returns empty array []
#    - No errors in console
#    - RLS policies allow the query
# 5. Navigate to: /guest/events/24caa3a8-020e-4a80-9899-35ff2797dcc0/home  
# 6. Observe: 30+ messages display correctly
```

**Expected vs Actual**:
- ✅ **Expected**: Empty state for event with no messages
- ✅ **Actual**: Empty state showing correctly
- ❌ **User Expectation**: Messages should appear for "newly invited" guests

## Root Cause Summary

**Primary Issue**: **Inconsistent `user_id` population in `message_deliveries` table**

**Contributing Factors**:
1. **Data Inconsistency**: Some deliveries created with NULL `user_id` despite guest having valid `user_id`
2. **Broken Phone Fallback**: `auth.jwt() ->> 'phone'` returns NULL, disabling phone-based RLS access
3. **Timing Issue**: Deliveries created before or during user linking process

**Technical Status**: ❌ Multiple systems broken
- RLS policies: ❌ Phone-based access path non-functional
- Data consistency: ❌ Inconsistent `user_id` population in deliveries
- User linkage: ✅ Proper `user_id` associations in `event_guests`  
- UI rendering: ✅ Correctly shows empty state (no accessible messages)

## Fix Options

### Option 1: **Data Repair + Phone Fallback Fix** (Immediate - Critical)
**Scope**: Database repair + RLS policy fix  
**Risk**: Low - targeted data fix  
**Effort**: 2-4 hours

**Implementation**:
```sql
-- Step 1: Repair inconsistent user_id in message_deliveries
UPDATE message_deliveries 
SET user_id = g.user_id
FROM event_guests g 
WHERE message_deliveries.guest_id = g.id 
  AND message_deliveries.user_id IS NULL 
  AND g.user_id IS NOT NULL;

-- Step 2: Fix phone-based RLS to use safe phone extraction
ALTER POLICY "message_deliveries_select_optimized" ON message_deliveries
USING (
  -- Existing paths...
  OR
  -- Fixed phone access using get_user_phone_safe()
  EXISTS (
    SELECT 1 FROM public.event_guests eg 
    WHERE eg.id = message_deliveries.guest_id 
    AND eg.phone = get_user_phone_safe()
    AND get_user_phone_safe() IS NOT NULL
  )
);
```

**Pros**: 
- Immediately fixes affected guests
- Addresses both root causes
- Minimal code changes

**Cons**:
- Requires database migration
- Need to prevent future inconsistencies

### Option 2: **Delivery Creation Process Fix** (Preventive - Important)
**Scope**: Fix message delivery creation to always populate `user_id`  
**Risk**: Medium - affects message sending flow  
**Effort**: 1-2 days

**Implementation**:
- Update message delivery creation logic to always lookup and populate `user_id` from `event_guests`
- Add database constraints to prevent NULL `user_id` when guest has valid `user_id`
- Add monitoring for delivery creation inconsistencies

**Pros**:
- Prevents future occurrences
- Ensures data consistency
- Better system reliability

**Cons**:
- Requires careful testing of message sending flow
- May need backfill of existing inconsistent data

### Option 3: **Comprehensive RLS Overhaul** (Robust - Long-term)
**Scope**: Redesign RLS to be more resilient to data inconsistencies  
**Risk**: High - affects all message access  
**Effort**: 1-2 weeks

**Implementation**:
- Create unified guest access function that handles both `user_id` and phone scenarios
- Implement fallback logic in RLS policies
- Add comprehensive RLS testing
- Update all messaging-related RLS policies

**Pros**:
- Most resilient to future data issues
- Better separation of concerns
- Comprehensive solution

**Cons**:
- High risk of breaking existing functionality
- Requires extensive testing
- Longer implementation timeline

## Recommendations

**Priority 1 - Immediate Fix** (Option 1): 
- Execute data repair migration to fix NULL `user_id` in `message_deliveries`
- Update RLS policy to use `get_user_phone_safe()` function
- **Result**: Nick Molcsan and Connor Smith will immediately see their messages

**Priority 2 - Prevent Recurrence** (Option 2):
- Fix message delivery creation process to always populate `user_id`
- Add data consistency checks and monitoring
- **Result**: Prevents future guests from experiencing this issue

**Priority 3 - Long-term Resilience** (Option 3):
- Consider RLS overhaul for better error handling
- Implement comprehensive testing for RLS policies
- **Result**: More robust system overall

**Critical technical fixes required** - this is a production data consistency and RLS bug affecting guest message access.
