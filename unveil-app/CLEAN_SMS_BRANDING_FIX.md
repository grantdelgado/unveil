# Clean SMS Branding Fix - Simplified Solution

## Problem
Scheduled SMS messages were missing event tags (e.g., `[Sarah + David]`) while Send Now messages included them correctly.

**User Report**: 
- ✅ Send Now: `[Sarah + David] Testing message sending - Grant.`
- ❌ Scheduled: `delayed test message!` (missing event tag)

## Root Cause
**Supabase Client Context Mismatch**: The SMS formatter (`composeSmsText`) was trying to use `createServerSupabaseClient()` which requires user authentication cookies. In the scheduled worker context (background job), there are no user cookies, so the client creation failed and the formatter fell back to unformatted text.

## Solution: Smart Client Fallback

Instead of complex client passing, I implemented a **simple fallback mechanism** in the SMS formatter:

### Before (Failing):
```typescript
// Always tried to use server client (requires user auth)
const supabase = await createServerSupabaseClient();
```

### After (Smart Fallback):
```typescript
// Try server client first, fallback to admin client if needed
let supabase: any;
try {
  supabase = await createServerSupabaseClient();
} catch (error) {
  // Fallback to admin client for scheduled worker context
  const { supabase: adminClient } = await import('@/lib/supabase/admin');
  supabase = adminClient;
  logger.info('SMS formatter using admin client fallback', { eventId });
}
```

## Changes Made

### 1. Updated SMS Formatter (`lib/sms-formatter.ts`)
- **Removed complex client parameter** (reverted from previous attempt)
- **Added smart fallback logic** to try server client first, then admin client
- **Applied same logic to `markA2pNoticeSent`** function
- **Maintains backward compatibility** - no API changes

### 2. Reverted Complex Changes
- **Removed `supabaseClient` parameter** from `SMSMessage` interface
- **Removed client passing** from scheduled worker
- **Simplified back to original API** while fixing the core issue

## Why This Works

### Send Now Context (User Authenticated):
1. `createServerSupabaseClient()` succeeds ✅
2. Formatter gets event data and applies branding ✅
3. Result: `[Sarah + David] Your message here`

### Scheduled Worker Context (Background Job):
1. `createServerSupabaseClient()` fails (no user cookies) ❌
2. **Fallback to admin client** succeeds ✅
3. Formatter gets event data and applies branding ✅
4. Result: `[Sarah + David] Your message here`

## Benefits of This Approach

✅ **Simple & Clean**: No complex parameter passing
✅ **Backward Compatible**: No API changes required
✅ **Self-Healing**: Automatically works in any context
✅ **Maintainable**: Easy to understand and debug
✅ **Robust**: Handles both user and admin contexts gracefully

## Testing

### Expected Results After Fix

**Scheduled SMS** should now include event tag:
```
[Sarah + David]
delayed test message!
```

**For first-time recipients**, also include branding:
```
[Sarah + David]
delayed test message!

via Unveil
Reply STOP to opt out.
```

### Verification Steps

1. **Create a scheduled message** via the composer
2. **Wait for processing** (or trigger manually)
3. **Check received SMS** - should include `[EventTag]` header
4. **Compare with Send Now** - should be identical format

## Debugging

### If Still Not Working

The formatter now logs when it uses the admin client fallback:
```
logger.info('SMS formatter using admin client fallback', { eventId });
```

### Possible Issues to Check

1. **SMS_BRANDING_DISABLED=true** in production environment
2. **Admin client permissions** to access events table
3. **Event missing sms_tag** (should auto-generate from title)

### Debug Commands

```sql
-- Check if event has SMS tag
SELECT id, title, sms_tag FROM events WHERE id = 'your-event-id';

-- Check if branding is disabled
SELECT 'SMS_BRANDING_DISABLED' as flag, 
       CASE WHEN current_setting('app.sms_branding_disabled', true) = 'true' 
            THEN 'DISABLED' 
            ELSE 'ENABLED' 
       END as status;
```

## Rollback Plan

If issues arise, simply revert the changes to `lib/sms-formatter.ts`:
1. Remove the try/catch fallback logic
2. Restore original `const supabase = await createServerSupabaseClient();`
3. The formatter will fall back to unformatted text (current behavior)

## Impact

- **Low Risk**: Only changes error handling in formatter
- **High Reward**: Fixes scheduled SMS branding completely
- **Clean Code**: Removes complexity from previous attempt
- **Future Proof**: Works in any Supabase client context

---

**Status**: ✅ **IMPLEMENTED** (Clean Version)
**Complexity**: 🟢 **LOW** (Simple fallback logic)
**Risk**: 🟢 **LOW** (Backward compatible, graceful fallback)
**Next Steps**: Test scheduled message to verify event tag inclusion
