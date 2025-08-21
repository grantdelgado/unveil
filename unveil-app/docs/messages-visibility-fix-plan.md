# Guest Event Messages - Fix Plan

## Root Cause Analysis

**Primary Issue**: Client-side query filter bypasses RLS, blocking access to deliveries with NULL `user_id`

**Specific Problem**: 
- `useGuestMessagesRPC.ts:73` has hard filter: `.eq('user_id', user.id)`
- This prevents access to deliveries where `user_id = NULL` even when RLS would allow it
- RLS policy is actually correct and would grant access via `can_access_event()` function

**Data Scope**:
- 3 out of 71 deliveries (4.23%) have inconsistent `user_id`
- Affects only 2 guests in 1 event: Nick Molcsan (2 deliveries) and Connor Smith (1 delivery)

## Fix Options (Ranked by Risk/Impact)

### Option 1: Remove Client Filter (Minimal Risk - RECOMMENDED)
**Change**: Remove `.eq('user_id', user.id)` filter, let RLS handle access control
**Risk**: Very Low - RLS already enforces proper access
**Impact**: Immediate fix for all affected guests
**Effort**: 5 minutes

```typescript
// BEFORE (line 73)
.eq('user_id', user.id)

// AFTER  
// Remove this line entirely - let RLS handle access control
```

### Option 2: Data Repair Only (Higher Risk)
**Change**: Update NULL `user_id` values in `message_deliveries`
**Risk**: Medium - requires data migration
**Impact**: Fixes current cases but doesn't prevent recurrence
**Effort**: 1 hour

### Option 3: Hybrid Approach (Comprehensive)
**Change**: Both remove client filter AND repair data
**Risk**: Low - belt and suspenders approach
**Impact**: Immediate fix + prevents similar issues
**Effort**: 1 hour

## Recommended Approach: Option 1

**Why**: 
1. **Safest**: No database changes required
2. **Fastest**: Single line code change
3. **Most Correct**: Let RLS do its job instead of duplicating logic
4. **Self-Healing**: Will work for any future data inconsistencies

**Implementation**:
1. Remove client-side `user_id` filter from `useGuestMessagesRPC.ts`
2. Validate that RLS properly restricts access
3. Test with affected guests

**Validation**:
- Nick Molcsan should see 2 messages immediately
- Connor Smith should see 2 messages immediately  
- Tom Gazzard should still see 2 messages (no change)
- Other users should not gain access to messages they shouldn't see
