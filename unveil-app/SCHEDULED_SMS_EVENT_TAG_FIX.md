# Scheduled SMS Event Tag Fix - Root Cause & Solution

## Problem Identified

**Issue**: Scheduled SMS messages were missing the event tag header (e.g., `[Sarah + David]`) while Send Now messages included it correctly.

**User Report**: 
- ✅ Send Now: `[Sarah + David] Testing message sending - Grant.`
- ❌ Scheduled: `Testing scheduled message (also Grant)` (missing event tag)

## Root Cause Analysis

### The Real Issue: Supabase Client Mismatch

**Discovery**: The scheduled worker and SMS formatter were using **incompatible Supabase clients**:

1. **Scheduled Worker**: Uses `supabase` from `@/lib/supabase/admin` (service role, bypasses RLS)
2. **SMS Formatter**: Uses `createServerSupabaseClient()` (user context, requires auth cookies)

**Failure Mode**: When `composeSmsText()` runs in the scheduled worker context:
1. `createServerSupabaseClient()` fails because there are no user cookies/auth
2. Event data fetch fails with authentication error
3. Formatter falls back to **unformatted text** (lines 76-90 in `sms-formatter.ts`)
4. Result: Plain message without `[EventTag]` header

### Why Send Now Worked

Send Now messages work because they run in **API route context** with user authentication, so `createServerSupabaseClient()` succeeds and can fetch event data for formatting.

## Solution Implemented

### 1. Made SMS Formatter Client-Agnostic

**File**: `lib/sms-formatter.ts`
```typescript
// Before:
export async function composeSmsText(
  eventId: string,
  guestId: string | undefined,
  body: string,
  options: SmsFormatOptions = {}
): Promise<SmsFormatResult>

// After:
export async function composeSmsText(
  eventId: string,
  guestId: string | undefined,
  body: string,
  options: SmsFormatOptions = {},
  supabaseClient?: any // Optional Supabase client (for admin contexts)
): Promise<SmsFormatResult>
```

**Logic**: Use provided client or fall back to server client:
```typescript
const supabase = supabaseClient || await createServerSupabaseClient();
```

### 2. Updated SMS Message Interface

**File**: `lib/sms.ts`
```typescript
export interface SMSMessage {
  to: string;
  message: string;
  eventId: string;
  guestId?: string;
  messageType?: 'rsvp_reminder' | 'announcement' | 'welcome' | 'custom';
  supabaseClient?: any; // NEW: Optional Supabase client for admin contexts
}
```

### 3. Updated sendSMS Function

**File**: `lib/sms.ts`
- Added `supabaseClient` parameter to function signature
- Pass client to `composeSmsText()` and `markA2pNoticeSent()`
- Maintains backward compatibility (client is optional)

### 4. Fixed Scheduled Worker

**File**: `app/api/messages/process-scheduled/route.ts`
```typescript
const smsMessages = resolvedRecipients.map((guest) => ({
  to: guest.phone,
  message: message.content,
  eventId: message.event_id,
  guestId: guest.id,
  messageType: /* ... */,
  supabaseClient: supabase, // Pass admin client for formatting
}));
```

### 5. Updated A2P Notice Function

**File**: `lib/sms-formatter.ts`
- Added optional `supabaseClient` parameter to `markA2pNoticeSent()`
- Ensures A2P tracking works in both contexts

## Verification

### Expected Results After Fix

**Scheduled SMS** should now include event tag:
```
[Sarah + David]
Testing scheduled message (also Grant)
```

**For first-time recipients**, also include branding:
```
[Sarah + David]
Testing scheduled message (also Grant)

via Unveil
Reply STOP to opt out.
```

### Backward Compatibility

✅ **Send Now messages**: Continue working unchanged (no supabaseClient passed)
✅ **Existing SMS calls**: All optional parameters maintain compatibility
✅ **Tests**: Unit tests work without modification

## Testing

### Updated Integration Tests

**File**: `__tests__/integration/scheduled-sms-branding-parity.test.ts`
- Updated to pass supabase client to formatter calls
- Tests verify event tag inclusion for both first-time and subsequent messages

### Manual Testing Steps

1. **Create scheduled message** via composer
2. **Wait for processing** or trigger manually
3. **Verify SMS includes** `[EventTag]` header
4. **Compare with Send Now** message for same event (should be identical)

## Rollback Plan

If issues arise, revert these changes:

1. **Remove supabaseClient parameter** from `SMSMessage` interface
2. **Revert composeSmsText signature** to original (4 parameters)
3. **Remove supabaseClient passing** in scheduled worker
4. **Revert markA2pNoticeSent signature** to original

Core SMS pipeline remains unchanged - rollback is low-risk.

## Monitoring

### Debug Logging Added

**Development Environment**:
- Logs SMS formatting parameters in scheduled worker
- Tracks `smsBrandingDisabled` flag state
- Monitors first-time recipient detection

**Production Ready**:
- All debug logging is behind `NODE_ENV !== 'production'` checks
- No PII logged, only counts and boolean flags

### Error Detection

**Formatter Fallback Logging**:
```typescript
if (eventResult.error) {
  logger.warn('Failed to fetch event for SMS formatting', {
    eventId,
    error: eventResult.error.message,
  });
  // Falls back to unformatted message
}
```

This will now log if there are still client issues, making debugging easier.

## Impact Assessment

### ✅ Benefits
- **Scheduled SMS now includes event tags** (parity with Send Now)
- **Unified SMS formatting** across all contexts
- **Better error visibility** for debugging
- **Backward compatible** changes

### 🔍 Risks
- **Low risk**: Changes are additive, core pipeline unchanged
- **Fallback preserved**: Still works if client not provided
- **Tested**: Integration tests verify functionality

---

**Status**: ✅ **IMPLEMENTED**
**Risk Level**: 🟢 **LOW** (Backward compatible, additive changes)
**Next Steps**: Deploy and verify scheduled messages include event tags
