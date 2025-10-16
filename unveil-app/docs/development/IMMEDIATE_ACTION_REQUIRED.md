# 🚨 IMMEDIATE ACTION REQUIRED - Type Assertion Issues

**Date:** October 16, 2025  
**Status:** 🔴 CRITICAL - 21 TypeScript Errors Blocking Build  
**Priority:** P0 - Resolve before next deployment

---

## Problem Summary

After updating Supabase types to use generic RPC function signatures, **all RPC calls now return `unknown` type** instead of properly typed results. This causes:

- 21 TypeScript compilation errors
- Vercel builds failing
- `.map()`, `.length`, `.filter()` property errors

---

## Root Cause

**What changed:**
```typescript
// OLD (specific types)
Functions: {
  get_guest_event_messages: {
    Args: { ... }
    Returns: MessageType[]
  }
}

// NEW (generic)
Functions: {
  [key: string]: {
    Args: Record<string, unknown>
    Returns: unknown  // ⚠️ Everything is unknown now!
  }
}
```

**Why this happened:**
- Trying to avoid maintaining 50+ function definitions
- But TypeScript can't infer types from generic signature
- Result: All RPC calls lose type safety

---

## Immediate Fix Required

### Pattern to Apply Everywhere

**Before (broken):**
```typescript
const { data } = await supabase.rpc('some_function');
if (data.length === 0) {  // ❌ Error: Property 'length' doesn't exist
  // ...
}
```

**After (working):**
```typescript
const { data } = await supabase.rpc('some_function');
const results = data as ExpectedType[] | null;
if (!results || results.length === 0) {  // ✅ Works
  // ...
}
```

---

## Files Needing Type Assertions (21 errors)

### API Routes (6 errors)

**1. `app/api/messages/process-scheduled/route.ts`**
- Line 864: `data.map()` ❌
- Line 1007: `data.length` ❌
- Line 1009: `data.map()` ❌
- Line 1027: `data.length` ❌

**Fix:** Add type assertion for message recipients RPC

**2. `app/api/messages/send/route.ts`**
- Line 193: `data.map()` ❌

**Fix:** Add type assertion for recipient resolution RPC

---

### Hooks (10 errors)

**3. `hooks/events/useUserEvents.ts`**
- Line 9: `data[0]` ❌
- Line 101: Assignment type error ❌

**Fix:** Add type assertion for `get_user_events` RPC

**4. `hooks/guests/useGuestData.ts`**
- Line 135: `data.map()` ❌
- Line 136: implicit `any` ❌

**5. `hooks/guests/useGuests.ts`**
- Line 74: `data.map()` ❌
- Line 75: implicit `any` ❌

**6. `hooks/guests/useSimpleGuestStore.ts`**
- Line 187: `data.map()` ❌

**7. `hooks/useGuests.ts`**
- Line 248: `rsvp_status` doesn't exist ❌

---

### Services (3 errors)

**8. `lib/services/events.ts`**
- Line 70: `data.map()` ❌

**9. `lib/services/messaging-client.ts`**
- Line 81: `data.map()` ❌
- Line 87: `data.length` ❌
- Line 89: `data.filter()` ❌
- Line 92: `data.filter()` ❌

---

## Recommended Solution

### Option 1: Add Type Assertions (Quick Fix - 2-3 hours)

**Pros:**
- Fast to implement
- Unblocks deployment immediately
- Each file self-documenting

**Cons:**
- Repetitive code
- Easy to get types wrong
- No compile-time safety

**Implementation:**
- Go through each error
- Add proper type assertion
- Test locally with `pnpm tsc --noEmit`

---

### Option 2: Restore Full Function Types (Better - 4-6 hours)

**Pros:**
- Proper type safety
- Catches errors at compile time
- Better developer experience

**Cons:**
- Need to maintain 50+ function definitions
- Types can drift from database
- Requires regeneration after schema changes

**Implementation:**
1. Use full generated types from Supabase
2. Copy complete Functions object
3. Maintain in types/supabase.ts
4. Regenerate when database changes

---

### Option 3: Hybrid Approach (Recommended - 1-2 hours)

**Keep generic Functions type BUT add type helpers:**

```typescript
// types/supabase-helpers.ts
export type GetUserEventsResult = {
  id: string;
  title: string;
  event_date: string;
  // ...
}[];

export type GetGuestEventMessagesResult = {
  message_id: string;
  content: string;
  // ...
}[];

// Then use:
const { data } = await supabase.rpc('get_user_events');
const events = data as GetUserEventsResult | null;
```

**Pros:**
- Type-safe where it matters
- Centralized type definitions
- Easy to maintain
- Clear intent

**Cons:**
- Still requires manual type definitions
- Some duplication with database types

---

## Emergency Workaround (NOT RECOMMENDED)

**If you need to deploy NOW:**

```typescript
// Add @ts-expect-error with explanation
// @ts-expect-error - RPC return type not properly typed, will fix in next PR
const results = data as any;
```

**Why not recommended:**
- Bypasses type safety
- Hides real bugs
- Creates technical debt
- Can cause runtime errors

---

## Action Plan

### Immediate (Next 30 minutes)

1. ✅ Commit current working changes
2. 🔴 **Fix all 21 TypeScript errors** with type assertions
3. ✅ Run `pnpm tsc --noEmit` until 0 errors
4. ✅ Run `pnpm run lint` until clean
5. ✅ Commit fixes
6. ✅ Push to main

### Short Term (Next deployment)

1. Add comprehensive type helpers file
2. Document RPC return types
3. Create pattern library for common RPCs
4. Update pre-push script to catch these

### Long Term (Next sprint)

1. Decide: Generic vs Full function types
2. If Full: Set up auto-generation pipeline
3. If Generic: Create complete type helper library
4. Add CI/CD checks to prevent regressions

---

##Current Build Status

**Vercel:** ❌ Failing (21 TypeScript errors)  
**Local Tests:** ⚠️ 656 passing, 117 failing (unrelated)  
**TypeScript:** ❌ 21 errors  
**ESLint:** ✅ Likely passing  

**Blocker:** TypeScript errors must be fixed before Vercel will deploy

---

**Created:** October 16, 2025  
**Owner:** Development Team  
**Urgency:** 🔴 CRITICAL

