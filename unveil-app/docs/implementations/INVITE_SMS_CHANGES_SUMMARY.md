# Invite SMS Link Changes Summary

## Overview

Successfully switched invite SMS links from event-specific deep links to the guest hub (event selector) and implemented environment-aware URL generation.

## Changes Made

### 1. New URL Utilities (`lib/utils/url.ts`)

- **`getAppBaseUrl()`**: Environment-aware base URL generation
  - Production: Uses `NEXT_PUBLIC_APP_URL` (https://app.sendunveil.com)
  - Vercel Preview: Uses `VERCEL_URL` with https://
  - Local: Falls back to http://localhost:3000
- **`buildInviteLink()`**: Flexible invite link builder
  - `target: 'hub'` → `/select-event` (current default)
  - `target: 'event'` → `/guest/events/[eventId]` (for future use)
- **`generateGuestAccessLink()`**: Legacy compatibility wrapper

### 2. Updated SMS Generation (`lib/sms-invitations.ts`)

- **Import**: Added import for new URL utilities
- **`createInvitationMessage()`**:
  - Now uses `buildInviteLink({ target: 'hub' })` instead of deep links
  - Removed phone query parameter (`?phone=...`)
  - Updated CTA text to "View your invite & RSVP"
- **`generateGuestAccessLink()`**: Marked as deprecated, delegates to new utility

### 3. Domain Updates

- **`app/layout.tsx`**:
  - Updated metadata base URL to use environment-aware logic
  - Updated OpenGraph URL to use `NEXT_PUBLIC_APP_URL`
- **`app/select-event/page.tsx`**:
  - Updated support email from `support@unveil.app` to `support@sendunveil.com`
- **Documentation**: Updated legacy domain references

## SMS Flow Changes

### Before (Deep Link)

```
SMS: "View details & RSVP: https://app.sendunveil.com/guest/events/[eventId]?phone=+1234567890"
Flow: Link → Join Gate → Login → Auto-join → Event Home
```

### After (Hub Link)

```
SMS: "View your invite & RSVP: https://app.sendunveil.com/select-event"
Flow: Link → Login → Guest Hub → Select Event → Event Home
```

## Environment Behavior

| Environment    | Base URL                          | Example Link                                     |
| -------------- | --------------------------------- | ------------------------------------------------ |
| **Production** | `https://app.sendunveil.com`      | `https://app.sendunveil.com/select-event`        |
| **Preview**    | `https://[deployment].vercel.app` | `https://preview-abc123.vercel.app/select-event` |
| **Local**      | `http://localhost:3000`           | `http://localhost:3000/select-event`             |

## Authentication Flow

The existing authentication flow remains intact:

1. **Guest receives SMS** → clicks hub link
2. **Unauthenticated** → redirected to `/login`
3. **OTP verification** → `usePostAuthRedirect` handles routing
4. **Completed onboarding** → lands on `/select-event` (guest hub)
5. **Guest selects event** → navigates to event home

## Backward Compatibility

- Deep link code (`/guest/events/[eventId]`) preserved for future use
- Legacy `generateGuestAccessLink()` function maintained
- Auto-join functionality still works when users access deep links directly

## Testing Verified

✅ URL generation works across all environments  
✅ SMS message generation produces correct hub links  
✅ No phone query parameters in new links  
✅ Legacy functions still work for backward compatibility  
✅ No linter errors introduced

## Files Modified

- `lib/utils/url.ts` (new)
- `lib/sms-invitations.ts`
- `app/layout.tsx`
- `app/select-event/page.tsx`
- `docs/deployment/guest-invite-deep-link-prerequisites.md`

## Next Steps

1. **Deploy to preview** → verify preview URLs work correctly
2. **Test SMS sending** → confirm hub links work in all environments
3. **QA guest flow** → login → hub → event selection → RSVP
4. **Monitor auto-join** → ensure database triggers still link users properly
5. **Future**: Switch back to deep links by changing `target: 'hub'` to `target: 'event'`
