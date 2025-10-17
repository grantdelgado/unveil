# Test Coverage & Execution Summary

**Review Date**: October 16, 2025  
**Scope**: Smoke test recommendations + test infrastructure review  
**Status**: Read-only analysis (tests not executed during audit)

---

## Test Infrastructure Overview

### Existing Test Frameworks

**Vitest** (Unit & Integration Tests):
```json
// From package.json
"test": "vitest run --reporter=default",
"test:core": "vitest run --reporter=dot -t @core",
"test:unit": "vitest run --reporter=dot",
"test:watch": "vitest --watch",
"test:messaging-hooks": "vitest run --config vitest.messaging-hooks.config.ts"
```

**Playwright** (E2E Tests):
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:mobile": "node scripts/mobile-test.js"
```

**Test Projects** (from `playwright.config.ts`):
- `chromium` — Desktop Chrome
- `firefox` — Desktop Firefox  
- `webkit` — Desktop Safari
- `mobile-guest-auth` — iPhone 12 with guest auth
- `mobile-host-auth` — Pixel 5 with host auth
- `chromium-mobile` — Pixel 7
- `webkit-mobile` — iPhone 14 Pro

**Status**: ✅ **Comprehensive test infrastructure exists**

---

## Test Files Identified

### E2E Tests (Playwright)

```
tests/
├── e2e/
│   ├── email-optional.smoke.spec.ts          # Smoke test for email-optional flow
│   ├── messaging-guest-flow.spec.ts          # Guest messaging flow
│   ├── messaging-host-flow.spec.ts           # Host messaging flow
│   ├── messaging-error-scenarios.spec.ts     # Error handling
│   ├── messaging-join-boundary.spec.ts       # Join/leave messaging
│   ├── guest-messages-timezone-chips.spec.ts # Timezone display
│   ├── message-history-refresh.spec.ts       # Message refresh
│   └── rsvp-lite.spec.ts                     # RSVP decline/rejoin
├── responsive.spec.ts                         # Responsive layout tests
├── mobile-authenticated.spec.ts               # Mobile auth flows
├── security/
│   ├── guest-isolation.spec.ts               # Guest data isolation
│   └── cross-event-access-validation.spec.ts # Cross-event access checks
├── performance/
│   └── messaging-load.spec.ts                # Messaging performance
├── realtime/
│   └── subscription-stability.spec.ts        # Realtime stability
└── messaging/
    └── routing.spec.ts                       # Messaging route tests
```

**Total**: 15 E2E test files identified

---

### Unit Tests (Vitest)

```
__tests__/
├── api/                    # API route tests (2 files)
├── components/             # Component tests (7 files)
├── database/               # DB function tests (5 *.ts, 2 *.sql)
├── features/               # Feature tests (3 *.ts, 1 *.tsx)
├── hooks/                  # Hook tests (8 *.ts, 2 *.tsx)
├── integration/            # Integration tests (14 *.ts, 1 *.tsx)
├── lib/                    # Utility tests (19 *.ts, 1 *.tsx)
├── unit/                   # Pure unit tests (11 *.ts)
└── validation/             # Validation tests (1 *.ts)
```

**Total**: ~80+ unit/integration test files

---

## Recommended Smoke Tests

### Critical Path Tests (Execute for Audit Validation)

#### 1. Auth Flow Smoke Test

```bash
# Test: Login with phone OTP → user creation → event selection
pnpm test:e2e -- tests/e2e/email-optional.smoke.spec.ts \
  --project=webkit-mobile --project=chromium-mobile
```

**What it validates**:
- ✅ Phone number normalization
- ✅ OTP send/verify flow
- ✅ User creation in `users` table
- ✅ Redirect to `/select-event` after auth

**Expected Duration**: ~2 minutes

---

#### 2. Guest Messaging Flow

```bash
# Test: Guest views messages, pagination, realtime updates
pnpm test:e2e -- tests/e2e/messaging-guest-flow.spec.ts \
  --project=mobile-guest-auth
```

**What it validates**:
- ✅ `get_guest_event_messages` RPC call
- ✅ Message list rendering
- ✅ Pagination (fetch older messages)
- ✅ Realtime message insertion

**Expected Duration**: ~3 minutes

---

#### 3. Responsive Layout Test

```bash
# Test: Mobile viewport handling, safe-area, keyboard
pnpm test:e2e -- tests/responsive.spec.ts \
  --project=webkit-mobile --project=chromium-mobile
```

**What it validates**:
- ✅ Safe-area padding (iOS notch, home indicator)
- ✅ Viewport height fixes (100svh/100dvh)
- ✅ Keyboard overlay handling
- ✅ Touch target sizes ≥44px

**Expected Duration**: ~2 minutes

---

#### 4. Security Isolation Test

```bash
# Test: Guest cannot access other guests' data
pnpm test:e2e -- tests/security/guest-isolation.spec.ts
```

**What it validates**:
- ✅ RLS policies enforce guest isolation
- ✅ Direct messages only visible to recipients
- ✅ Removed guests cannot access event data

**Expected Duration**: ~2 minutes

---

### Total Smoke Test Duration

**Estimated**: 9-10 minutes for 4 critical tests

---

## Test Execution Results (Placeholder)

### Status: 🟡 Not Executed During Audit

Per review guidelines, this audit was read-only. Tests were not executed to avoid:
- Database state modifications (test data creation)
- Network requests to production/staging
- File system writes (screenshots, logs)

### Recommended Next Steps

1. **Execute smoke tests** in staging environment
2. **Capture results** (pass/fail counts, flaky tests)
3. **Generate screenshots** for UX snapshot pack
4. **Document any failures** for follow-up

---

## Test Coverage Gaps (Based on Code Review)

### Areas with Good Coverage ✅

1. **Auth Flow**
   - Phone validation: ✅ `lib/utils/phone.ts` has tests
   - OTP flow: ✅ E2E smoke test covers end-to-end
   - Session management: ✅ AuthProvider logic tested

2. **Messaging**
   - Guest messaging hook: ✅ Dedicated test config (`vitest.messaging-hooks.config.ts`)
   - RPC functions: ✅ Database tests cover `get_guest_event_messages`
   - Realtime subscriptions: ✅ Stability tests exist

3. **Security**
   - RLS policies: ✅ `pnpm test:rls` command exists
   - Guest isolation: ✅ E2E security tests
   - Cross-event access: ✅ Validation tests

---

### Areas with Limited Coverage ⚠️

1. **Event Creation Flow**
   - No dedicated E2E test for host creating new event
   - Event form validation tests may be missing
   - Recommendation: Add `tests/e2e/event-creation-flow.spec.ts`

2. **Media Upload**
   - No E2E test for file upload flow
   - Error handling (file too large, wrong format) not tested
   - Recommendation: Add `tests/e2e/media-upload-flow.spec.ts`

3. **Schedule Management**
   - No E2E test for creating/editing schedule items
   - Timezone handling not thoroughly tested
   - Recommendation: Add `tests/e2e/schedule-management.spec.ts`

4. **RSVP Decline/Rejoin**
   - Test exists (`rsvp-lite.spec.ts`) but may need expansion
   - Boundary cases (decline → rejoin → decline again) not fully covered
   - Recommendation: Expand `tests/e2e/rsvp-lite.spec.ts`

5. **Error States & Empty States**
   - No systematic test for all error/empty state UIs
   - Recommendation: Add `tests/e2e/error-states.spec.ts`

---

## Playwright Screenshot Generation Plan

### Target Routes & States

**Auth Flow**:
```typescript
// tests/screenshots/auth-flow.spec.ts
test.describe('Auth Flow Screenshots', () => {
  test('capture phone entry screen', async ({ page }) => {
    await page.goto('/login');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/auth-phone-entry-iphone14pro.png' });
  });
  
  test('capture OTP verification screen', async ({ page }) => {
    // Simulate OTP sent state
    await page.goto('/login?step=otp&phone=%2B15551234567');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/auth-otp-verify-iphone14pro.png' });
  });
  
  test('capture OTP error state', async ({ page }) => {
    await page.goto('/login?step=otp&phone=%2B15551234567');
    await page.fill('[data-testid="otp-input"]', '000000');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.error-message');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/auth-otp-error-pixel7.png' });
  });
});
```

**Event Selection**:
```typescript
test.describe('Event Selection Screenshots', () => {
  test('capture host + guest events', async ({ page }) => {
    await page.goto('/select-event');
    await page.waitForSelector('[data-testid="event-card"]');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/select-event-host-guest-iphone14pro.png' });
  });
  
  test('capture empty state', async ({ page }) => {
    // Use test user with no events
    await page.goto('/select-event');
    await page.waitForSelector('text=No events yet');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/select-event-empty-iphone14pro.png' });
  });
});
```

**Guest Messaging**:
```typescript
test.describe('Messaging Screenshots', () => {
  test('capture message list with date groups', async ({ page }) => {
    await page.goto('/guest/events/[testEventId]/home');
    await page.waitForSelector('[data-testid="message-bubble"]');
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/guest-messages-list-iphone14pro.png' });
  });
  
  test('capture composer with keyboard', async ({ page }) => {
    await page.goto('/guest/events/[testEventId]/home');
    await page.click('[data-testid="message-input"]');
    await page.keyboard.type('Test message');
    await page.waitForTimeout(500); // Wait for keyboard animation
    await page.screenshot({ path: 'docs/reviews/assets/2025-10/guest-composer-keyboard-open-iphone14pro.png' });
  });
});
```

### Estimated Effort

- **Setup screenshot tests**: 2 hours
- **Capture all routes & states**: 1 hour
- **Organize & document**: 30 minutes

**Total**: 3.5 hours

---

## Test Quality Recommendations

### Best Practices to Enforce

1. **Stable Selectors**
   - ✅ Use `data-testid` attributes (already in use)
   - ✅ Avoid brittle CSS selectors (e.g., `.class-name:nth-child(3)`)
   - ⚠️ Ensure all interactive elements have `data-testid`

2. **Test Independence**
   - ✅ Each test should set up its own data
   - ✅ Clean up after test completion
   - ⚠️ Avoid dependencies between tests

3. **Retry Logic**
   - ✅ Playwright retries configured (2 retries on CI)
   - ✅ Use `waitFor` instead of fixed timeouts
   - ⚠️ Identify flaky tests and fix root cause

4. **Test Data Management**
   - ✅ Use dedicated test database/branch
   - ⚠️ Create seed data scripts for consistent test state
   - ⚠️ Document test user credentials

---

## Integration with CI/CD

### Current CI Gates (from package.json)

```json
"test:ci-gates": "node scripts/test-ci-gates.js",
"ci:full": "pnpm typecheck && pnpm lint --max-warnings=0 && pnpm test && pnpm check:email && pnpm e2e"
```

**Status**: ✅ CI pipeline includes E2E tests

### Recommended CI Improvements

1. **Split Test Stages**
   ```yaml
   # Example GitHub Actions workflow
   jobs:
     unit-tests:
       runs-on: ubuntu-latest
       steps:
         - run: pnpm test:unit
     
     e2e-smoke:
       runs-on: ubuntu-latest
       needs: unit-tests
       steps:
         - run: pnpm test:e2e -- tests/e2e/email-optional.smoke.spec.ts
     
     e2e-full:
       runs-on: ubuntu-latest
       needs: e2e-smoke
       steps:
         - run: pnpm test:e2e
   ```

2. **Parallel Test Execution**
   - Run Playwright projects in parallel (iPhone + Pixel simultaneously)
   - Use `--workers=2` flag for faster execution

3. **Test Result Reporting**
   - Upload test artifacts (screenshots, videos) on failure
   - Generate HTML report for E2E results
   - Post test summary to PR comments

---

## Appendix: Test Command Reference

### Vitest Commands

```bash
# Run all unit tests
pnpm test

# Run core tests only
pnpm test:core

# Run with coverage
pnpm test:coverage

# Run messaging hooks tests
pnpm test:messaging-hooks

# Watch mode for development
pnpm test:watch
```

### Playwright Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e -- tests/e2e/messaging-guest-flow.spec.ts

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run on specific device
pnpm test:e2e -- --project=webkit-mobile

# Generate test report
pnpm test:e2e -- --reporter=html
```

### Database Tests

```bash
# Test RLS policies
pnpm test:rls

# Test auth flow
pnpm test:auth-flow

# Reset test database
pnpm db:test
```

---

## Conclusion

The Unveil test infrastructure is **comprehensive and well-organized**, with:
- ✅ 15+ E2E test files covering critical paths
- ✅ 80+ unit/integration tests
- ✅ Mobile device projects (iPhone, Pixel)
- ✅ Security & performance test suites

**Recommended Next Actions**:
1. Execute smoke tests (4 critical tests, ~10 minutes)
2. Generate Playwright screenshots for UX snapshot pack (~3.5 hours)
3. Address test coverage gaps (event creation, media upload, schedule)
4. Improve CI pipeline with parallel execution and better reporting

**No test execution was performed during this read-only audit**. All recommendations are based on code review and test file analysis.

---

**End of Test Summary**

