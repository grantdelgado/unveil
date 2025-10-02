# Route Inventory - Unveil Wedding App
**Date:** October 1, 2025  
**Purpose:** Complete mapping of user-facing routes for iOS deep linking strategy  

## Authentication & Onboarding Routes

| Route | Title | Purpose | Auth Required | Deep Link Priority |
|-------|-------|---------|---------------|-------------------|
| `/` | Landing Page | Entry point with auto-redirect logic | No | High |
| `/login` | Login | Phone + OTP authentication | No | High |
| `/setup` | Account Setup | User profile creation and SMS consent | Yes | Medium |
| `/profile` | User Profile | Profile management and settings | Yes | Low |
| `/reset-password` | Reset Password | Password reset flow (future) | No | Low |

**Code References:**
- Landing: `app/page.tsx`
- Login: `app/(auth)/login/page.tsx`
- Setup: `app/(auth)/setup/page.tsx`
- Profile: `app/(auth)/profile/page.tsx`

## Core App Routes

| Route | Title | Purpose | Auth Required | Deep Link Priority |
|-------|-------|---------|---------------|-------------------|
| `/select-event` | Event Selection | Choose event to participate in | Yes | High |
| `/dashboard` | Dashboard (Legacy) | Redirects to `/select-event` | Yes | N/A |

**Code References:**
- Event selection: `app/(auth)/select-event/page.tsx`
- Redirect logic: `middleware.ts` lines 105-111

## Host Routes

| Route | Title | Purpose | Auth Required | Deep Link Priority |
|-------|-------|---------|---------------|-------------------|
| `/host/events/create` | Create Event | New event creation form | Yes (Host) | Medium |
| `/host/events/[eventId]/dashboard` | Host Dashboard | Event overview and management | Yes (Host) | High |
| `/host/events/[eventId]/details` | Event Details | View and edit event information | Yes (Host) | Medium |
| `/host/events/[eventId]/edit` | Edit Event | Event modification form | Yes (Host) | Medium |
| `/host/events/[eventId]/guests` | Guest Management | Invite and manage event participants | Yes (Host) | High |
| `/host/events/[eventId]/messages` | Messages Hub | View all event messages | Yes (Host) | High |
| `/host/events/[eventId]/messages/compose` | Compose Message | Send messages to guests | Yes (Host) | Medium |
| `/host/events/[eventId]/messages/analytics` | Message Analytics | Message delivery and engagement stats | Yes (Host) | Low |
| `/host/events/[eventId]/schedule` | Schedule Management | Event timeline and schedule | Yes (Host) | Medium |

**Code References:**
- Host layout: `app/host/layout.tsx`
- Event creation: `app/host/events/create/page.tsx`
- Dashboard: `app/host/events/[eventId]/dashboard/page.tsx`
- Guest management: `app/host/events/[eventId]/guests/page.tsx`
- Messages: `app/host/events/[eventId]/messages/page.tsx`

## Guest Routes

| Route | Title | Purpose | Auth Required | Deep Link Priority |
|-------|-------|---------|---------------|-------------------|
| `/guest/events/[eventId]` | Event Home | Guest view of event details and RSVP | Yes (Guest) | High |
| `/guest/events/[eventId]/home` | Event Home (Alt) | Alternative path to event home | Yes (Guest) | High |
| `/guest/events/[eventId]/schedule` | Event Schedule | View event timeline and activities | Yes (Guest) | Medium |

**Code References:**
- Guest layout: `app/guest/layout.tsx`
- Event home: `app/guest/events/[eventId]/page.tsx`
- Schedule: `app/guest/events/[eventId]/schedule/page.tsx`

## API Routes (Not User-Facing)

| Route Category | Purpose | Deep Link Relevant |
|----------------|---------|-------------------|
| `/api/auth/*` | Authentication endpoints | No |
| `/api/messages/*` | Message processing | No |
| `/api/sms/*` | SMS delivery | No |
| `/api/guests/*` | Guest management | No |
| `/api/webhooks/*` | External service webhooks | No |

## Legacy/Redirect Routes

| Route | Redirects To | Purpose |
|-------|-------------|---------|
| `/dashboard` | `/select-event` | Legacy route cleanup |
| `/guest/home` | `/select-event` | Legacy guest home |

**Code References:**
- Middleware redirects: `middleware.ts` lines 104-111

## Route Analysis for Deep Linking

### High Priority Routes (Universal Links)
These routes should be configured for Universal Links as they represent primary user entry points:

1. **`/select-event`** - Main app entry after authentication
2. **`/guest/events/[eventId]`** - Direct guest access to events
3. **`/host/events/[eventId]/dashboard`** - Direct host access to events
4. **`/host/events/[eventId]/guests`** - Guest management (common host task)
5. **`/host/events/[eventId]/messages`** - Message management (common host task)
6. **`/`** - Landing page (handles auth redirect logic)
7. **`/login`** - Authentication entry point

### Medium Priority Routes
These routes benefit from deep linking but are secondary entry points:

1. **`/host/events/create`** - New event creation
2. **`/host/events/[eventId]/details`** - Event details management
3. **`/host/events/[eventId]/edit`** - Event editing
4. **`/host/events/[eventId]/schedule`** - Schedule management
5. **`/guest/events/[eventId]/schedule`** - Guest schedule viewing
6. **`/setup`** - Account setup (typically reached via auth flow)

### Low Priority Routes
These routes are typically reached through app navigation rather than external links:

1. **`/profile`** - User profile management
2. **`/host/events/[eventId]/messages/analytics`** - Message analytics
3. **`/host/events/[eventId]/messages/compose`** - Message composition
4. **`/reset-password`** - Password reset (future feature)

## Route Patterns for Universal Links

### Dynamic Segments
The app uses dynamic segments that need special handling in Universal Links:

- **`[eventId]`** - UUID format event identifiers
- Pattern: `/guest/events/123e4567-e89b-12d3-a456-426614174000`
- Pattern: `/host/events/123e4567-e89b-12d3-a456-426614174000/dashboard`

### Authentication Requirements
Most routes require authentication, which affects deep linking strategy:

- **Public routes:** `/`, `/login`, `/reset-password`
- **Authenticated routes:** All others require valid session
- **Role-specific routes:** Host routes require host permissions for specific events

## Recommendations for iOS Implementation

### Universal Links Configuration
1. Configure `applinks:app.sendunveil.com` for all high and medium priority routes
2. Handle dynamic segments with pattern matching
3. Implement fallback handling for unauthenticated deep link access

### Custom URL Scheme Fallback
1. Use `unveil://` scheme for fallback scenarios
2. Map all routes to custom scheme equivalents
3. Handle scheme-based routing in native app

### Authentication Flow Integration
1. Store intended destination during auth flow
2. Redirect to original deep link target after successful authentication
3. Handle expired sessions gracefully with re-authentication

---

**Total Routes:** 23 user-facing routes  
**High Priority for Deep Linking:** 7 routes  
**Medium Priority:** 8 routes  
**Low Priority:** 5 routes  
**Legacy/Redirects:** 3 routes
