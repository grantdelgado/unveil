---
title: "OTP Resend Cooldown Reduction: 60s → 30s"
status: active
lastReviewed: 2025-09-19
category: consolidated
originalLocation: "OTP_RESEND_COOLDOWN_CHANGE.md"
---

# OTP Resend Cooldown Reduction: 60s → 30s

## Summary

Reduced the OTP resend cooldown from 60 seconds to 30 seconds to make the resend flow less restrictive while maintaining all existing abuse protections.

## Changes Made

### Server-Side (`app/api/auth/otp/resend/route.ts`)

- **Updated**: `PHONE_COOLDOWN_SECONDS: 60` → `PHONE_COOLDOWN_SECONDS: 30`
- **Unchanged**: All other rate limits (3 attempts/10min phone, 10 attempts/10min IP)
- **Behavior**: API now returns `retryAfter` values ≤ 30 seconds

### UI Components

- **ResendOTPButton** (`components/features/auth/ResendOTPButton.tsx`):
  - Initial cooldown: `60` → `30` seconds
  - Success cooldown: `60` → `30` seconds
  - Countdown display automatically reflects server-driven timing
- **OTPStep** (`components/features/auth/OTPStep.tsx`):
  - Updated microcopy: "Wait 60 seconds" → "Wait 30 seconds"

### Documentation

- **Updated**: `docs/auth-otp-resend.md` to reflect 30-second cooldown throughout
- **Updated**: All references to timing in troubleshooting and testing sections

## Verification

✅ **API Test Results**:

```bash
# First request: Success
{"success":true,"message":"If your number is registered, a verification code was sent.","remaining":2}

# Second request: Rate limited with ~30s cooldown
{"error":"Please wait before requesting another code","retryAfter":26}
```

✅ **TypeScript Compilation**: No errors  
✅ **Linting**: No errors  
✅ **Rate Limits**: Unchanged (3/10min phone, 10/10min IP)  
✅ **A2P Compliance**: Unchanged (same message template)

## Future Configuration

To adjust the cooldown in the future, modify:

1. **Server**: `PHONE_COOLDOWN_SECONDS` in `app/api/auth/otp/resend/route.ts`
2. **UI Default**: `initialCooldownSeconds` in `ResendOTPButton.tsx`
3. **UI Success**: Hardcoded cooldown in success handler (line ~116)
4. **Microcopy**: Update help text in `OTPStep.tsx`
5. **Docs**: Update `docs/auth-otp-resend.md`

**Recommendation**: Consider making this configurable via environment variable:

```typescript
PHONE_COOLDOWN_SECONDS: parseInt(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || '30',
);
```

## Impact

- **User Experience**: Faster resend availability reduces friction
- **Abuse Protection**: Maintained through unchanged attempt limits
- **SMS Volume**: Potential slight increase, but rate limits prevent abuse
- **Compliance**: No changes to message templates or A2P registration
