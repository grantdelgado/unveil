# UX Snapshot Pack — October 2025

**Status**: 🟡 **Pending Screenshot Generation**

This directory will contain automated Playwright screenshots for:

## Auth Flow
- `auth-phone-entry-iphone14pro.png` — Phone number entry screen
- `auth-phone-entry-pixel7.png` — Phone number entry (Android)
- `auth-otp-verify-iphone14pro.png` — OTP verification screen
- `auth-otp-verify-pixel7.png` — OTP verification (Android)
- `auth-otp-error-iphone14pro.png` — OTP error state
- `auth-loading-iphone14pro.png` — Auth loading state

## Event Selection
- `select-event-host-guest-iphone14pro.png` — User with both host and guest events
- `select-event-host-guest-pixel7.png` — Same view on Android
- `select-event-guest-only-iphone14pro.png` — Guest-only user
- `select-event-empty-iphone14pro.png` — Empty state (no events)
- `select-event-loading-pixel7.png` — Loading skeleton

## Guest Messaging
- `guest-messages-list-iphone14pro.png` — Message list with date groups (Today/Yesterday)
- `guest-messages-list-pixel7.png` — Same view on Android
- `guest-messages-empty-iphone14pro.png` — Empty state (no messages)
- `guest-composer-keyboard-closed-iphone14pro.png` — Composer without keyboard
- `guest-composer-keyboard-open-iphone14pro.png` — Composer with keyboard visible
- `guest-composer-keyboard-open-pixel7.png` — Keyboard on Android
- `guest-messages-error-iphone14pro.png` — Error state (network failure)

## Host Dashboard
- `host-dashboard-iphone14pro.png` — Quick actions and stats
- `host-dashboard-pixel7.png` — Same view on Android
- `host-quick-actions-iphone14pro.png` — Quick actions grid zoomed

## Media & Schedule
- `media-upload-flow-iphone14pro.png` — Media upload screen
- `media-gallery-iphone14pro.png` — Photo gallery view
- `schedule-view-populated-pixel7.png` — Event schedule with items
- `schedule-view-empty-iphone14pro.png` — Empty schedule state

## Screenshot Generation Script

To generate these screenshots, run:

```bash
# Create Playwright test for screenshots
pnpm test:e2e -- tests/screenshots/ux-snapshot-pack.spec.ts \
  --project=webkit-mobile --project=chromium-mobile

# Or run dedicated script (to be created)
pnpm screenshots:generate
```

## Screenshot Requirements

- **Devices**: iPhone 14 Pro (390×844) + Pixel 7 (412×915)
- **Format**: PNG, optimized for web
- **Naming**: `{route}-{state}-{device}.png`
- **States to Capture**:
  - Loading
  - Populated (happy path)
  - Empty
  - Error
  - With/without keyboard (for forms)

## Note on Test Data

Screenshots should use sanitized test data:
- **Phone numbers**: `+1 (555) xxx-xxxx` format
- **Names**: "Test User", "Sample Guest", etc.
- **Events**: "Sample Wedding 2026", "Test Event"
- **Messages**: Generic content, no PII

---

**Next Steps**: Create Playwright screenshot test suite (~3.5 hours effort)

