## Executive Summary
- Critical SMS abuse exposure: `/api/sms/send-bulk` and `/api/sms/send-single` are unauthenticated and can be invoked by anyone, enabling spam and cost blow-ups.
- Delivery status tracking is lossy: message deliveries do not persist Twilio SIDs, so webhook updates fall back to phone-number matching, risking misattribution on repeated sends.
- Auth gating is shallow at the edge: middleware only checks token presence, not validity/roles, increasing reliance on downstream RLS correctness.
- Cron and webhook security are inconsistent: cron processing accepts the presence of `x-vercel-cron-signature` without signature verification.
- Push-first messaging is not implemented: push pipeline is stubbed while messaging assumes it as a supported channel.
- In-memory rate limiting exists but is non-durable in serverless, reducing real protection against abuse and OTP spam.
- Observability is robust but uneven: structured logging and Sentry are present, yet PII can leak into production logs.
- Realtime stability work is strong and centralized, but legacy subscription utilities are still present and could cause drift.
- DX is mature (scripts, tests, audits), but enforcement of prod safety gates is manual and inconsistent.
- The repository includes strong prior audits; this plan focuses on closing security/reliability gaps first, then hardening and product readiness.

## Repo Map + Architecture Overview
### Top-Level Structure (key folders)
- `app/`: Next.js App Router pages and API routes (`app/api/*`).
- `components/`: UI and feature components (many client-side).
- `hooks/`: Client hooks including React Query and realtime utilities.
- `lib/`: Core services, Supabase clients, messaging, realtime manager, logging, error handling, performance.
- `supabase/`: Migrations and DB schema changes (RLS, RPCs, data model evolution).
- `scripts/`: Ops and test scripts (env validation, RLS checks, messaging validation).
- `tests/`, `__tests__/`: E2E, integration, unit, and security tests.
- `docs/`: Existing audits, architecture docs, operational guides.

### App Runtime Entry Points + Critical Execution Paths
- App shell + providers: `app/layout.tsx`, `lib/providers/LeanRootProvider.tsx`, `lib/react-query-client.tsx`
- Edge middleware gating/rate limiting: `middleware.ts`, `lib/middleware/auth-matcher.ts`
- Auth/session + onboarding: `app/(auth)/login/page.tsx`, `hooks/usePostAuthRedirect.ts`, `app/(auth)/setup/page.tsx`, `lib/auth/AuthProvider.tsx`
- Event selection routing: `components/features/event-selection/EventSelectionClient.tsx`, `hooks/events/useUserEvents.ts`
- Messaging send: `lib/services/messaging-client.ts`, `app/api/messages/send/route.ts`, `lib/sms.ts`, `lib/sms-formatter.ts`
- Scheduled messaging: `app/api/messages/process-scheduled/route.ts`, `app/api/cron/process-messages/route.ts`
- Twilio delivery callbacks: `app/api/webhooks/twilio/route.ts`, `lib/sms/twilio-verify.ts`
- Realtime: `lib/realtime/SubscriptionManager.ts`, `lib/realtime/SubscriptionProvider.tsx`
- Observability: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `app/api/rum/route.ts`

### Top 15 Files by Blast Radius (and why)
1. `app/layout.tsx` — root metadata, providers, and global HTML/head setup.
2. `middleware.ts` — request gating, rate limiting, and security headers at the edge.
3. `next.config.ts` — CSP, security headers, and production caching behavior.
4. `lib/supabase/client.ts` — client auth/session and realtime configuration.
5. `lib/supabase/server.ts` — server auth/session handling in API routes.
6. `lib/supabase/admin.ts` — service role access (RLS bypass) used by critical jobs.
7. `lib/auth/AuthProvider.tsx` — global auth state and token refresh behavior.
8. `hooks/usePostAuthRedirect.ts` — onboarding routing and user provisioning.
9. `components/features/event-selection/EventSelectionClient.tsx` — role routing to host/guest experiences.
10. `app/api/messages/send/route.ts` — primary send path for production messaging.
11. `app/api/messages/process-scheduled/route.ts` — scheduled message worker logic.
12. `app/api/webhooks/twilio/route.ts` — delivery status updates and opt-out sync.
13. `lib/sms.ts` — Twilio integration, retries, formatting pipeline entry.
14. `lib/realtime/SubscriptionManager.ts` — stability and lifecycle control for realtime.
15. `supabase/migrations/20250101000000_initial_schema.sql` — foundational tables, RLS helpers.

## System Diagrams (ASCII)
### Auth + Onboarding Flow
```
Login (OTP) -> Supabase Auth (sms) -> AuthProvider session
   -> usePostAuthRedirect:
        - users table lookup
        - create user if missing
        - route to /setup or /select-event or returnUrl
   -> /setup writes onboarding + SMS consent
```

### Messaging Flow (Send Now)
```
Client (MessageComposer) -> lib/services/messaging-client.ts
   -> POST /api/messages/send
       -> host check -> resolve recipients -> create message record
       -> sendBulkSMS (Twilio)
       -> upsert_message_delivery (RPC)
       -> Twilio webhook later updates delivery status
```

### Webhook + Cron Flow
```
Vercel Cron -> /api/cron/process-messages
   -> /api/messages/process-scheduled (auth via CRON_SECRET or vercel header)
       -> get_scheduled_messages_for_processing (RPC)
       -> create message record -> sendBulkSMS -> upsert_message_delivery

Twilio -> /api/webhooks/twilio
   -> verify signature -> update message_deliveries
   -> handle_sms_delivery_error / handle_sms_delivery_success (RPC)
```

## Deep Dives
### Auth / Session / Onboarding
- Current implementation: OTP login in `app/(auth)/login/page.tsx` uses `supabase.auth.signInWithOtp` and `verifyOtp`, then `hooks/usePostAuthRedirect.ts` creates or checks `users` row and routes to `/setup` or `/select-event`.
- Session handling: client-managed in `lib/auth/AuthProvider.tsx` via `supabase.auth.getSession()` and single auth subscription.
- Middleware gating: `middleware.ts` checks token presence via `lib/middleware/auth-matcher.ts` and redirects to `/login`.
- Risks: token presence check does not validate token freshness or role; potential for stale/invalid tokens to pass the edge gate and rely entirely on RLS.
- Opportunities: server-side auth gating for role-restricted routes and API calls; centralize auth for API routes with `createApiSupabaseClient` and verify user/role for all writes.

### Event Selection + Dual-Role Routing
- `components/features/event-selection/EventSelectionClient.tsx` uses `hooks/events/useUserEvents.ts` (RPC `get_user_events`) and routes to host/guest dashboards.
- Host dashboard (`app/host/events/[eventId]/dashboard/page.tsx`) uses `supabase.rpc('is_event_host')` for access validation.
- Guest join flow (`app/guest/events/[eventId]/page.tsx`) auto-joins by phone via `lib/services/guestAutoJoin`.
- Risks: routing is client-side; server-side page access control is inconsistent, relying on client checks + RLS.
- Opportunities: server components for role-based gating, consolidate access checks via shared server utility.

### Messaging Send Pipeline (Queueing/Scheduling, Push vs SMS)
- Immediate send: `lib/services/messaging-client.ts` -> `app/api/messages/send/route.ts` -> `lib/sms.ts`.
- Scheduling: `app/api/messages/process-scheduled/route.ts` processes scheduled messages via RPC, creates new `messages` entries and sends SMS.
- Push pipeline: `lib/push-notifications.ts` exists but is a placeholder; scheduled processing logs a TODO for push.
- Risks: idempotency is missing for immediate send; push is not actually delivered despite API support for `sendVia.push`.
- Opportunities: introduce idempotency keys for immediate sends and implement push delivery or remove from UX until ready.

### Twilio Webhooks + Cron Endpoints
- Twilio webhook: `app/api/webhooks/twilio/route.ts` verifies signatures via `lib/sms/twilio-verify.ts` and updates delivery records.
- Cron: `app/api/cron/process-messages/route.ts` validates `CRON_SECRET` and forwards to `/api/messages/process-scheduled`.
- Risks: `/api/messages/process-scheduled` treats the presence of `x-vercel-cron-signature` as valid without verification; spoofing risk.
- Opportunities: verify Vercel cron signature or enforce `CRON_SECRET` only.

### Supabase Admin vs Client Usage Patterns
- Client: `lib/supabase/client.ts` used in UI and some API routes.
- Server: `lib/supabase/server.ts` for authenticated SSR/API.
- Admin: `lib/supabase/admin.ts` for RLS bypass in cron and webhook paths.
- Risks: `app/api/sms/send-announcement/route.ts` uses browser client in API context; user auth token is not bound to queries, risking unexpected access behavior.
- Opportunities: standardize API routes to use `createApiSupabaseClient` (user-scoped) or `supabaseAdmin` (privileged) with explicit authorization.

### Realtime Subscription Manager
- `lib/realtime/SubscriptionManager.ts` provides robust lifecycle, reconnection, and telemetry.
- `lib/realtime/SubscriptionProvider.tsx` owns token refresh and manager lifecycle.
- Risks: legacy `lib/realtime/subscriptions.ts` exists and can bypass the manager.
- Opportunities: remove or quarantine legacy helper usage to avoid inconsistent behavior.

### Error Handling + Logging
- Central logger: `lib/logger.ts` (structured logging in prod).
- Error helpers: `lib/error-handling.ts` and `lib/error-handling/database.ts`.
- Sentry: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`.
- Risks: several auth and SMS flows log raw phone numbers; structured logs may contain PII.
- Opportunities: add log redaction utility, enforce safe logging patterns.

### Config/Environment Variables
- Feature flags: `config/flags.ts` (SMS branding kill switch).
- Scheduling: `config/schedule.ts` (lead time).
- Env validation: `scripts/validate-production-env.ts`.
- Performance/RUM: `app/api/rum/route.ts` writes to DB with service role.
- Risks: RUM ingestion endpoint is unauthenticated and lacks rate limiting; can be abused for database write amplification.

## Findings
### Findings Table
| Severity | Category | Finding | Evidence | Impact | Fix Approach |
|---|---|---|---|---|---|
| P0 | Security | Unauthenticated SMS send endpoints | `app/api/sms/send-bulk/route.ts`, `app/api/sms/send-single/route.ts` | Anyone can trigger SMS sends, cost/abuse risk | Require auth + host role; add rate limiting and audit logs |
| P1 | Security | Cron auth allows header presence without verification | `app/api/messages/process-scheduled/route.ts` | Spoofed cron requests can trigger sends | Require `CRON_SECRET` or verify signature fully |
| P1 | Reliability | Delivery status tracking can misattribute Twilio callbacks | `app/api/messages/send/route.ts`, `lib/sms.ts`, `app/api/webhooks/twilio/route.ts` | Incorrect delivery status; hard to debug disputes | Persist Twilio SID per recipient at send time |
| P1 | Security | In-memory rate limiting is non-durable in serverless | `middleware.ts`, `app/api/auth/otp/resend/route.ts` | Bypassable limits, OTP spam potential | Move to Redis/Upstash or Supabase edge KV |
| P1 | Security | CSP allows `unsafe-inline`/`unsafe-eval` | `next.config.ts` | XSS surface area increased | Tighten CSP, use nonces/hashes |
| P2 | Correctness | API route uses browser Supabase client | `app/api/sms/send-announcement/route.ts` | Auth context not applied to DB calls | Use `createApiSupabaseClient` + explicit auth |
| P2 | Reliability | Push delivery is stubbed | `lib/push-notifications.ts`, `app/api/messages/process-scheduled/route.ts` | User expectations mismatch, false “push” success | Implement push or remove from UX/config |
| P2 | Privacy | PII (phone) appears in production logs | `app/(auth)/login/page.tsx`, `lib/sms.ts`, `lib/logger.ts` | Compliance risk, log leakage | Redact phone numbers before logging |
| P2 | Performance | Client-only pages dominate routing | `app/host/events/[eventId]/dashboard/page.tsx`, `app/guest/events/[eventId]/page.tsx` | Larger bundles, slower initial render | Move access checks and data fetch to server |
| P3 | Maintainability | Legacy realtime helper remains | `lib/realtime/subscriptions.ts` | Drift from SubscriptionManager | Remove or clearly deprecate, enforce usage |
| P3 | DX | RUM ingestion lacks rate limiting | `app/api/rum/route.ts` | Metrics spam, database noise | Add rate limit + sampling gate |

### Detailed Writeups
#### P0 — Unauthenticated SMS send endpoints
- Evidence: `app/api/sms/send-bulk/route.ts` and `app/api/sms/send-single/route.ts` accept POST payloads without any auth or host checks.
- Impact: External actors can send SMS at scale, causing abuse, brand harm, and direct Twilio costs.
- Fix approach: enforce `createApiSupabaseClient` auth, verify host privileges, add request-level rate limiting, and log audit entries.

#### P1 — Cron auth accepts unverified Vercel header
- Evidence: `app/api/messages/process-scheduled/route.ts` checks `x-vercel-cron-signature` presence only.
- Impact: Spoofed requests can trigger scheduled sends or overload processing.
- Fix approach: verify signature cryptographically or require `CRON_SECRET` for all processing requests.

#### P1 — Delivery status may be misattributed
- Evidence: `app/api/messages/send/route.ts` never stores Twilio SIDs on delivery records; webhook falls back to phone-number update in `app/api/webhooks/twilio/route.ts`.
- Impact: Concurrent messages to the same number can overwrite delivery status, losing accuracy and harming auditability.
- Fix approach: capture Twilio SID per recipient and write into `message_deliveries` at send time; use SID for webhook update.

#### P1 — In-memory rate limits are ineffective at scale
- Evidence: `middleware.ts` and `app/api/auth/otp/resend/route.ts` use local `Map` storage.
- Impact: Limits reset across serverless instances; attackers can bypass OTP throttles and API limits.
- Fix approach: move to centralized storage (Redis/Upstash) with fixed windows and per-IP/phone controls.

#### P1 — CSP includes `unsafe-eval` and `unsafe-inline`
- Evidence: `next.config.ts` CSP in `headers()` includes both directives.
- Impact: Increases XSS risk; harder to pass security reviews.
- Fix approach: migrate to nonces/hashes and remove unsafe directives.

#### P2 — API route uses browser Supabase client
- Evidence: `app/api/sms/send-announcement/route.ts` imports `supabase` from `lib/supabase` (browser client).
- Impact: Auth token from header is not bound to DB calls; relies on anonymous RLS behavior.
- Fix approach: use `createApiSupabaseClient` or admin client + explicit authorization.

#### P2 — Push delivery is stubbed
- Evidence: `lib/push-notifications.ts` and `app/api/messages/process-scheduled/route.ts` note TODOs and placeholder logic.
- Impact: UX suggests push support without actual delivery; creates false confidence.
- Fix approach: implement device token storage + actual delivery, or remove option until ready.

#### P2 — PII in logs
- Evidence: `app/(auth)/login/page.tsx` logs phone numbers; `lib/sms.ts` logs phone digits; `lib/logger.ts` emits structured logs in production.
- Impact: Compliance risk and unnecessary exposure in log pipelines.
- Fix approach: add redaction utilities and ban full phone logging in production.

#### P2 — Client-only routing for critical pages
- Evidence: `app/host/events/[eventId]/dashboard/page.tsx` and `app/guest/events/[eventId]/page.tsx` are client components and fetch data in `useEffect`.
- Impact: Larger bundles and slower first contentful render; server-side access control is deferred.
- Fix approach: move data fetch and access gating to server components or route handlers.

#### P3 — Legacy realtime helper remains
- Evidence: `lib/realtime/subscriptions.ts` exists while `SubscriptionManager` is the primary path.
- Impact: Risk of inconsistent subscription lifecycles if used later.
- Fix approach: remove or lock behind explicit deprecation and lint rule.

#### P3 — RUM ingestion lacks rate limiting
- Evidence: `app/api/rum/route.ts` accepts unauthenticated POST and writes with service role.
- Impact: Metrics noise and cost risk; possible abuse.
- Fix approach: add rate limit and sampling, validate payload size and frequency.

## 30/60/90 Day Execution Plan
### Now (1–2 days) — highest leverage, lowest risk
1) **Secure SMS send endpoints**
   - Goal: Prevent external abuse and unauthorized messaging.
   - Scope: `app/api/sms/send-bulk/route.ts`, `app/api/sms/send-single/route.ts`, `lib/supabase/server.ts`
   - Acceptance criteria: requests without auth or host role fail with 401/403; authorized host sends succeed.
   - Risk/rollback: low; revert to previous behavior only in emergency and behind feature flag.
   - Effort: S
   - Owner profile: solo dev

2) **Fix cron auth verification**
   - Goal: Ensure scheduled messaging only runs with verified credentials.
   - Scope: `app/api/messages/process-scheduled/route.ts`, `app/api/cron/process-messages/route.ts`
   - Acceptance criteria: unauthorized calls are rejected; Vercel cron or `CRON_SECRET` works consistently.
   - Risk/rollback: medium (could break cron if misconfigured); add dry-run endpoint for validation.
   - Effort: S
   - Owner profile: solo dev + quick review

3) **Persist Twilio SID per delivery**
   - Goal: Correct delivery status attribution.
   - Scope: `app/api/messages/send/route.ts`, `lib/sms.ts`, `app/api/webhooks/twilio/route.ts`
   - Acceptance criteria: `message_deliveries.sms_provider_id` set for each recipient; webhook updates by SID only.
   - Risk/rollback: medium (schema dependency); roll back to phone-number fallback if needed.
   - Effort: S/M
   - Owner profile: needs review

### Next (1–2 weeks) — structural improvements + high ROI
1) **Replace in-memory rate limiting with centralized store**
   - Goal: Durable throttling across serverless instances.
   - Scope: `middleware.ts`, `app/api/auth/otp/resend/route.ts`, shared rate-limit utility
   - Acceptance criteria: consistent limits across instances; OTP resend limits enforced.
   - Risk/rollback: medium; fallback to current in-memory if Redis unavailable.
   - Effort: M
   - Owner profile: needs review

2) **Standardize API auth clients**
   - Goal: Ensure API routes use proper Supabase context.
   - Scope: `app/api/sms/send-announcement/route.ts` and other routes using browser client.
   - Acceptance criteria: all API routes use `createApiSupabaseClient` or admin client with explicit authorization.
   - Risk/rollback: low; change is localized.
   - Effort: S
   - Owner profile: solo dev

3) **Tighten CSP and logging hygiene**
   - Goal: Reduce XSS risk and PII leakage.
   - Scope: `next.config.ts`, `lib/logger.ts`, auth + SMS flows
   - Acceptance criteria: CSP no longer includes `unsafe-inline`/`unsafe-eval`; phone numbers redacted in prod logs.
   - Risk/rollback: medium; CSP changes must be validated in staging.
   - Effort: M
   - Owner profile: needs review

### Later (1–2 months) — deeper refactors, scalability, product expansion
1) **Push delivery implementation**
   - Goal: Real push notifications with device tokens and delivery tracking.
   - Scope: `lib/push-notifications.ts`, DB schema (device_tokens), message pipeline.
   - Acceptance criteria: push send works end-to-end; delivery tracked; opt-out respected.
   - Risk/rollback: medium; gated via feature flag.
   - Effort: L
   - Owner profile: needs review

2) **Server-first rendering for role gates**
   - Goal: improve security and performance for critical pages.
   - Scope: `app/host/events/[eventId]/dashboard/page.tsx`, `app/guest/events/[eventId]/page.tsx`, shared access checks.
   - Acceptance criteria: server-side access decisions; reduced client bundle size and improved LCP.
   - Risk/rollback: medium; ensure SSR data fetching works with auth.
   - Effort: L
   - Owner profile: needs review

3) **Realtime usage consolidation**
   - Goal: eliminate legacy realtime helpers and enforce manager usage.
   - Scope: `lib/realtime/subscriptions.ts`, linting rules, hook updates.
   - Acceptance criteria: no direct `supabase.channel` usage outside manager; stability metrics unchanged or improved.
   - Risk/rollback: low
   - Effort: M
   - Owner profile: solo dev

## Feature Direction (Next 3–5 Features)
1) **Push Notifications MVP**
   - Why: Messaging currently assumes push support but delivery is stubbed; this unlocks “push-first” strategy.
   - Dependencies: new `device_tokens` table + RLS, `lib/push-notifications.ts`, message delivery pipeline.
   - MVP: register device token on login, send push for “announcement” only, capture delivery success/failure.

2) **Delivery Status Dashboard (Host)**
   - Why: Current delivery tracking is in DB but not surfaced; hosts need visibility for trust and support.
   - Dependencies: `message_deliveries` read model, UI in host dashboard, analytics hooks.
   - MVP: per-message summary (sent/delivered/failed) and top error codes.

3) **Guest Notification Preferences Center**
   - Why: SMS opt-out and push preferences need a single, self-service surface to reduce support load.
   - Dependencies: `event_guests.sms_opt_out`, future push preferences table, UI in guest settings.
   - MVP: toggle SMS + push opt-in, surface confirmation and audit timestamp.

4) **Event Onboarding Checklist**
   - Why: Improve host activation and reduce messaging mistakes with guided steps.
   - Dependencies: feature flags, analytics events, host dashboard UI.
   - MVP: checklist with “Invite guests”, “Send announcement”, “Upload media”.

5) **Message Templates + Scheduled Reminders**
   - Why: The scheduling pipeline exists; templates reduce friction and errors.
   - Dependencies: templates table, UI in message composer, analytics events.
   - MVP: 3 built-in templates and “save as template”.

## Do Not Do List
- Do not add new API routes that use the browser Supabase client or bypass auth.
- Do not ship features that imply push delivery until device token storage and sending are implemented.
- Do not add more in-memory rate limits; use a shared store to avoid false safety.
- Do not log raw phone numbers or user identifiers in production logs.
- Do not introduce new SECURITY DEFINER functions without `SET search_path` hardening.

## Quick Wins Checklist
- Add auth + host role checks to `/api/sms/send-bulk` and `/api/sms/send-single`.
- Require `CRON_SECRET` or verified Vercel signature for scheduled processing.
- Persist Twilio SID into `message_deliveries` on send.
- Add a log redaction helper for phone numbers and integrate with logger.
- Gate RUM ingestion with basic rate limiting/sampling.

## Appendix: File Inventory + Repro Commands
### Files Reviewed (non-exhaustive)
- `app/layout.tsx`, `middleware.ts`, `next.config.ts`
- Auth/onboarding: `app/(auth)/login/page.tsx`, `app/(auth)/setup/page.tsx`, `hooks/usePostAuthRedirect.ts`, `lib/auth/AuthProvider.tsx`
- Messaging: `lib/services/messaging-client.ts`, `app/api/messages/send/route.ts`, `app/api/messages/process-scheduled/route.ts`, `app/api/cron/process-messages/route.ts`
- Webhooks/SMS: `app/api/webhooks/twilio/route.ts`, `lib/sms.ts`, `lib/sms-formatter.ts`, `lib/sms/twilio-verify.ts`
- Realtime: `lib/realtime/SubscriptionManager.ts`, `lib/realtime/SubscriptionProvider.tsx`, `lib/realtime/subscriptions.ts`
- Supabase: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- Observability: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `app/api/rum/route.ts`
- Config: `config/flags.ts`, `config/schedule.ts`, `scripts/validate-production-env.ts`
- Migrations: `supabase/migrations/20250101000000_initial_schema.sql`, `20250112000000_simplify_schema.sql`, `20250130000001_fix_is_event_guest_removed_at.sql`, `20250130000030_secure_search_path_functions.sql`, `20250135000000_safe_jwt_claim_extraction.sql`

### Repro Commands (using `rg`)
- `rg "api/sms/send" app/api`
- `rg "process-scheduled" app/api`
- `rg "webhooks/twilio" app/api`
- `rg "is_event_host|is_event_guest" supabase/migrations`
- `rg "supabase.rpc\\(" lib app`
- `rg "sendBulkSMS|sendSMS" lib app`
- `rg "CRON_SECRET|x-vercel-cron-signature" app/api`
- `rg "AuthProvider|usePostAuthRedirect" app lib`

