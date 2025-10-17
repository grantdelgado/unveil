# Unveil Product & Engineering Context

**Canonical Source of Truth** — Single authoritative reference for AI tools (Cursor, MCP) and engineering onboarding  
**Last Updated:** October 16, 2025  
**Status:** Active, Production-Ready Platform

---

## 🎯 Purpose

This document serves as the **single canonical reference** for understanding Unveil&apos;s architecture, schema, and engineering patterns. All AI tools, MCP servers, and new team members should reference this as the primary source of truth.

For historical documentation, see `/docs/_archive/`.

---

## 📍 Quick Navigation

### Core Documentation
- **Architecture Overview:** [`/docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md)
- **Database Schema:** [`/supabase/migrations/`](../../supabase/)
- **Security & RLS:** [`/docs/architecture/SECURITY.md`](../architecture/SECURITY.md)
- **Design System:** [`/docs/architecture/DESIGN_SYSTEM.md`](../architecture/DESIGN_SYSTEM.md)
- **Development Guide:** [`/docs/development/DEVELOPMENT_GUIDE.md`](../development/DEVELOPMENT_GUIDE.md)
- **Deployment:** [`/docs/development/DEPLOYMENT.md`](../development/DEPLOYMENT.md)

### Code References
- **Frontend Components:** `/components/features/`
- **Custom Hooks:** `/hooks/`
- **API Services:** `/lib/services/`
- **Database Layer:** `/lib/db/`
- **Type Definitions:** `/types/database.types.ts`

### Archives
- **Historical Reports (2024-2025):** `/docs/_archive/reports_2024-2025/`
- **Legacy Documentation:** `/docs/archive/project-docs-legacy/`

---

## 🏗️ System Overview

### What is Unveil?

Unveil is a **production-ready wedding event management platform** built with Next.js 15, Supabase, and TypeScript. It enables:

- **Hosts:** Create events, manage guests, send announcements, view media galleries
- **Guests:** RSVP, upload photos, send messages, view event details

### Technology Stack

**Frontend:**
- Next.js 15 (App Router) with TypeScript strict mode
- Tailwind CSS v4 for mobile-first responsive design
- React Query for server state management
- Supabase Realtime for live updates

**Backend:**
- PostgreSQL (Supabase) with Row Level Security (RLS)
- Supabase Storage for media with CDN
- Supabase Auth with phone-based OTP (Twilio)
- Generated TypeScript types from database schema

**Infrastructure:**
- Vercel Edge Network deployment
- pnpm package manager
- Capacitor for iOS native app
- ESLint + Prettier for code quality

### Architecture Principles

1. **Phone-First Authentication:** OTP-based auth with E.164 phone normalization
2. **Event-Scoped Access:** All data access gated by event membership
3. **Row Level Security:** 100% RLS coverage on all tables
4. **Type Safety:** Zero `any` types, strict TypeScript mode
5. **Mobile-First:** Optimized for touch interfaces and small screens
6. **Feature-First Organization:** Code organized by domain (messaging, media, guests)

---

## 🗄️ Database Schema Quick Reference

### Core Tables

#### `users` (Identity)
- Primary identity: `id` (UUID, references `auth.users`)
- Required: `phone` (E.164 format), `full_name`
- Optional: `email`, `avatar_url`
- Auto-populated via triggers on auth signup

#### `events` (Wedding Events)
- Core fields: `id`, `title`, `description`, `event_date`, `location`
- Ownership: `host_user_id` (foreign key to `users.id`)
- Visibility: `is_published` (controls guest access)

#### `event_guests` (Membership & RSVP)
- Membership: `event_id`, `user_id`, `role` (host/guest/admin)
- RSVP-Lite: `declined_at` (NULL = attending, timestamp = declined)
- Invitation: `guest_name`, `phone`, `invited_at`, `joined_at`
- Communication: `preferred_communication`, `sms_opt_out`

**Note:** RSVP-Lite refactor removed `rsvp_status` enum in favor of `declined_at` timestamp.

#### `media` (Photos/Videos)
- Core: `id`, `event_id`, `uploader_user_id`
- Storage: `storage_path` (Supabase Storage), `media_type` (image/video)
- Metadata: `caption`, `created_at`

#### `messages` (Host Announcements & Guest Messages)
- Core: `id`, `event_id`, `sender_user_id`, `content`
- Type: `message_type` (direct/announcement)
- Scheduling: `scheduled_for`, `sent_at` (for scheduled messages)
- Status: `is_draft`, `delivery_status`

#### `message_deliveries` (Read Receipts)
- Tracking: `message_id`, `user_id`, `delivered_at`, `read_at`
- Auto-created for event participants when message sent

### Key Relationships

```
users (1) ──< events (N)          # Host owns events
users (1) ──< event_guests (N)    # User joins events
events (1) ──< event_guests (N)   # Event has participants
events (1) ──< media (N)          # Event has media
events (1) ──< messages (N)       # Event has messages
messages (1) ──< message_deliveries (N)  # Message delivery tracking
```

### Important Indexes

All foreign keys are indexed. Key composite indexes:
- `event_guests(event_id, user_id)` — UNIQUE constraint
- `event_guests(event_id, role)` — Host/guest queries
- `media(event_id, created_at DESC)` — Gallery pagination
- `messages(event_id, scheduled_for)` — Scheduled message queue

**Reference:** See `/supabase/migrations/` for complete schema and `/docs/database/` for schema evolution.

---

## 🔐 Row Level Security (RLS) Summary

### Policy Pattern: Event-Scoped Access

**Helper Functions:**
- `is_event_host(event_id UUID)` — Returns true if current user is host
- `is_event_guest(event_id UUID)` — Returns true if current user is participant

**Policy Architecture:**
```sql
-- Example: Messages table policies
CREATE POLICY "messages_view" ON messages FOR SELECT
  TO authenticated USING (is_event_guest(event_id));

CREATE POLICY "messages_insert_guest" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    is_event_guest(event_id) AND 
    sender_user_id = auth.uid()
  );

CREATE POLICY "messages_host_manage" ON messages FOR ALL
  TO authenticated USING (is_event_host(event_id));
```

### Security Principles

1. **All tables have RLS enabled** — No exceptions
2. **Authenticated-only access** — No anonymous reads
3. **Event-scoped visibility** — Users only see their permitted events
4. **Role-based permissions:**
   - Hosts: Full CRUD on their events
   - Guests: Read event data, create media/messages, update own RSVP
5. **User-scoped writes** — Can only insert with own `user_id`

### Common RLS Patterns

**Read Access:**
```sql
USING (is_event_guest(event_id) OR is_event_host(event_id))
```

**Write Access (Host only):**
```sql
WITH CHECK (is_event_host(event_id))
```

**Write Access (User-scoped):**
```sql
WITH CHECK (is_event_guest(event_id) AND uploader_user_id = auth.uid())
```

**Reference:** See [`/docs/architecture/SECURITY.md`](../architecture/SECURITY.md) for complete policy documentation.

---

## 🎨 Frontend Architecture

### Directory Structure

```
app/
├── (auth)/           # Auth routes (login, OTP verification)
├── (core)/           # Shared layouts
├── host/             # Host-specific routes
│   ├── dashboard/   # Host overview
│   └── events/      # Event management
│       ├── create/  # Event creation flow
│       └── [eventId]/  # Event-specific host views
└── guest/           # Guest-specific routes
    └── events/
        └── [eventId]/  # Event-specific guest views
            ├── home/
            ├── gallery/
            ├── messages/
            └── rsvp/

components/
├── features/        # Domain-specific components
│   ├── auth/       # Authentication UI
│   ├── events/     # Event management
│   ├── guests/     # Guest management
│   ├── media/      # Photo/video gallery
│   ├── messaging/  # Real-time messaging
│   └── navigation/ # App navigation
└── ui/             # Reusable UI primitives
    ├── Button.tsx
    ├── Input.tsx
    └── LoadingSpinner.tsx

hooks/
├── auth/           # useAuth, useSession
├── events/         # useEvent, useEventsCached
├── guests/         # useGuests, useGuestManagement
├── media/          # useMedia, useMediaUpload
└── messaging/      # useMessages, useScheduledMessages

lib/
├── services/       # Database operations
├── db/            # Supabase client
├── validations/   # Input validation
└── utils/         # Shared utilities
```

### Component Patterns

**1. Feature-First Organization:**
```typescript
// components/features/messaging/
├── GuestMessaging.tsx      # Main container
├── MessageComposer.tsx     # Input component
├── MessageThread.tsx       # List display
└── index.ts               # Clean exports
```

**2. Custom Hooks (React Query):**
```typescript
// hooks/messaging/useMessages.ts
export const useMessages = (eventId: string) => {
  return useQuery({
    queryKey: ['messages', eventId],
    queryFn: () => getEventMessages(eventId),
    staleTime: 30_000, // 30 seconds
  });
};
```

**3. Service Layer:**
```typescript
// lib/services/messaging.ts
export const sendMessage = async (data: MessageInsert) => {
  const supabase = createClient();
  const { data: message, error } = await supabase
    .from('messages')
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return message;
};
```

**4. Type Safety:**
```typescript
import type { Database } from '@/types/database.types';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];
```

### State Management

- **Server State:** React Query (`@tanstack/react-query`)
- **Local UI State:** React useState/useReducer
- **Real-time:** Supabase Realtime subscriptions
- **Auth State:** Supabase Auth session

**Query Key Strategy:**
```typescript
// lib/react-query.tsx
export const queryKeys = {
  events: {
    all: ['events'] as const,
    user: (userId: string) => ['events', 'user', userId] as const,
    detail: (eventId: string) => ['events', eventId] as const,
  },
  messages: {
    event: (eventId: string) => ['messages', eventId] as const,
  },
};
```

**Reference:** See [`/docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) for detailed patterns.

---

## 🔄 Real-Time Features

### Subscription Management

**Centralized Manager:**
```typescript
// lib/realtime/SubscriptionManager.ts
class RealtimeSubscriptionManager {
  subscribe(eventId: string, table: string, callback: Function) {
    const channel = supabase
      .channel(`${table}:${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table,
        filter: `event_id=eq.${eventId}`,
      }, callback)
      .subscribe();
    
    return channel;
  }
}
```

### Real-Time Use Cases

1. **Message Broadcasting:** New messages appear instantly for all participants
2. **Media Upload Notifications:** Gallery updates when photos uploaded
3. **RSVP Updates:** Hosts see guest responses in real-time
4. **Event Updates:** Changes to event details propagate immediately

**Important:** Always clean up subscriptions in `useEffect` cleanup functions to prevent memory leaks.

---

## 🚀 Common Development Workflows

### 1. Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Create database migration if needed
supabase migration new my_feature_schema

# 3. Write migration SQL
# Edit: supabase/migrations/[timestamp]_my_feature_schema.sql

# 4. Apply migration locally
supabase db reset

# 5. Regenerate types
pnpm supabase:types

# 6. Implement feature
# - Create service layer: lib/services/myFeature.ts
# - Create hooks: hooks/myFeature/useMyFeature.ts
# - Create components: components/features/myFeature/

# 7. Test locally
pnpm dev

# 8. Run tests
pnpm test
pnpm test:e2e

# 9. Commit and push
git add .
git commit -m "feat(myFeature): add new feature"
git push origin feature/my-feature
```

### 2. Database Schema Changes

```sql
-- Pattern: Add column with default
ALTER TABLE events ADD COLUMN new_field TEXT DEFAULT 'default_value';

-- Pattern: Add foreign key with index
ALTER TABLE new_table ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_new_table_user_id ON new_table(user_id);

-- Pattern: Add RLS policies
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "new_table_view" ON new_table FOR SELECT
  TO authenticated USING (is_event_guest(event_id));
```

### 3. Type-Safe Database Queries

```typescript
// ✅ GOOD: Type-safe service layer
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type Event = Database['public']['Tables']['events']['Row'];

export async function getEvent(eventId: string): Promise<Event | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  
  if (error) throw error;
  return data;
}

// ❌ BAD: Direct Supabase usage in components
// Avoid using supabase.from() directly in React components
```

---

## ⚠️ Common Pitfalls & Solutions

### 1. RLS Policy Issues

**Problem:** Query returns empty array even though data exists
```typescript
// User is authenticated but not in event_guests table
const { data } = await supabase.from('events').select('*');
console.log(data); // []
```

**Solution:** Ensure user has event membership
```sql
-- Check membership
SELECT * FROM event_guests WHERE user_id = auth.uid();

-- Add user to event if missing
INSERT INTO event_guests (event_id, user_id, role)
VALUES ('event-uuid', 'user-uuid', 'guest');
```

### 2. Type Assertion with RPC Functions

**Problem:** RPC functions return `unknown` type after Supabase type updates
```typescript
const { data } = await supabase.rpc('get_guest_event_messages', { p_event_id: eventId });
// data is unknown, causes .map() errors
```

**Solution:** Use type assertions with proper typing
```typescript
const { data } = await supabase.rpc('get_guest_event_messages', { 
  p_event_id: eventId 
}) as { data: MessageRow[] | null, error: PostgrestError | null };

const messages = (data ?? []) as MessageRow[];
```

**Reference:** See [`/docs/development/IMMEDIATE_ACTION_REQUIRED.md`](../development/IMMEDIATE_ACTION_REQUIRED.md) for current type assertion patterns.

### 3. Real-Time Memory Leaks

**Problem:** Component unmounts but subscription continues
```typescript
// ❌ BAD
useEffect(() => {
  const channel = supabase.channel('messages').subscribe();
  // No cleanup!
}, []);
```

**Solution:** Always return cleanup function
```typescript
// ✅ GOOD
useEffect(() => {
  const channel = supabase
    .channel('messages')
    .on('postgres_changes', { /* ... */ }, callback)
    .subscribe();
  
  return () => {
    channel.unsubscribe();
  };
}, [eventId]);
```

### 4. Phone Number Formatting

**Problem:** Phone numbers not matching due to inconsistent formatting
```typescript
// User enters: (555) 123-4567
// Database has: +15551234567
// Comparison fails!
```

**Solution:** Always normalize to E.164 format
```typescript
import { normalizePhoneNumber } from '@/lib/utils/phoneUtils';

const normalized = normalizePhoneNumber('(555) 123-4567');
// Returns: '+15551234567'
```

### 5. RSVP Status Migration

**Problem:** Code references old `rsvp_status` column
```typescript
// ❌ OLD (removed in RSVP-Lite refactor)
await supabase
  .from('event_guests')
  .update({ rsvp_status: 'attending' });
```

**Solution:** Use `declined_at` timestamp pattern
```typescript
// ✅ NEW (RSVP-Lite)
// Attending: declined_at IS NULL
// Declined: declined_at IS NOT NULL

// To mark attending:
await supabase
  .from('event_guests')
  .update({ declined_at: null });

// To mark declined:
await supabase
  .from('event_guests')
  .update({ declined_at: new Date().toISOString() });
```

---

## 📝 Code Style & Standards

### TypeScript

```typescript
// ✅ Use strict types, avoid 'any'
type MessageRow = Database['public']['Tables']['messages']['Row'];

// ✅ Use explicit return types
export async function getMessages(eventId: string): Promise<MessageRow[]> {
  // ...
}

// ✅ Use optional chaining and nullish coalescing
const userName = user?.full_name ?? 'Unknown User';

// ❌ Don't use 'any'
function processData(data: any) { /* ... */ }
```

### React Components

```typescript
// ✅ Functional components with TypeScript
interface MessageThreadProps {
  eventId: string;
  onMessageSent?: () => void;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ 
  eventId, 
  onMessageSent 
}) => {
  // ...
};

// ✅ Use React.memo for expensive components
export const MessageThread = React.memo(MessageThreadInner);

// ✅ Use useCallback for event handlers passed as props
const handleSend = useCallback(() => {
  sendMessage(content);
}, [content]);
```

### Styling

```typescript
// ✅ Tailwind utility classes, mobile-first
<button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all">
  Send Message
</button>

// ✅ Use &apos; for apostrophes in JSX
<p>Don&apos;t forget to RSVP!</p>

// ❌ Don't use inline styles (except for dynamic values)
<div style={{ color: 'blue' }}>Bad</div>
```

### Error Handling

```typescript
// ✅ Use try/catch with proper error types
import { PostgrestError } from '@supabase/supabase-js';

try {
  const data = await getMessages(eventId);
  return data;
} catch (error) {
  if (error instanceof PostgrestError) {
    logger.error('Database error:', error.message);
  }
  throw error;
}

// ✅ Use unified logger
import { logger } from '@/lib/logger';

logger.auth('User logged in:', userId);
logger.error('Failed to fetch data:', error);
```

---

## 🧪 Testing Guidelines

### Unit Tests (Vitest)

```typescript
// __tests__/services/messaging.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sendMessage } from '@/lib/services/messaging';

describe('sendMessage', () => {
  it('should send message successfully', async () => {
    const message = await sendMessage({
      event_id: 'test-event',
      sender_user_id: 'test-user',
      content: 'Test message',
    });
    
    expect(message).toBeDefined();
    expect(message.content).toBe('Test message');
  });
});
```

### E2E Tests (Playwright)

```typescript
// playwright-tests/messaging.spec.ts
import { test, expect } from '@playwright/test';

test('guest can send message', async ({ page }) => {
  await page.goto('/guest/events/test-event-id/messages');
  await page.fill('[data-testid=message-input]', 'Hello!');
  await page.click('[data-testid=send-button]');
  
  await expect(page.locator('text=Hello!')).toBeVisible();
});
```

**Reference:** See [`/docs/development/DEVELOPMENT_GUIDE.md`](../development/DEVELOPMENT_GUIDE.md) for complete testing strategy.

---

## 🚢 Deployment

### Pre-Deployment Checklist

- [ ] TypeScript build passes: `pnpm build`
- [ ] Tests pass: `pnpm test && pnpm test:e2e`
- [ ] Linting clean: `pnpm lint`
- [ ] Database migrations applied: `supabase db push`
- [ ] Environment variables configured in Vercel
- [ ] Bundle size within budget: `pnpm build:budget`

### Deployment Flow

```bash
# 1. Merge to main (triggers Vercel deployment)
git checkout main
git merge feature/my-feature
git push origin main

# 2. Apply database migrations (Supabase)
supabase db push --linked

# 3. Verify deployment
# - Check Vercel deployment logs
# - Test production URL
# - Monitor error tracking

# 4. Monitor
# - Check Sentry for errors
# - Review Vercel analytics
# - Monitor Supabase logs
```

**Reference:** See [`/docs/development/DEPLOYMENT.md`](../development/DEPLOYMENT.md) for complete deployment guide.

---

## 📚 Additional Resources

### Documentation Index
- **Main Docs:** [`/docs/README.md`](../README.md)
- **Project Overview:** [`/docs/project/SYSTEM_OVERVIEW.md`](../project/SYSTEM_OVERVIEW.md)
- **MVP Features:** [`/docs/project/MVP_FEATURES.md`](../project/MVP_FEATURES.md)
- **Guest Management:** [`/docs/guest-management/`](../guest-management/)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Historical Context
- **Reports Archive:** [`/docs/_archive/reports_2024-2025/`](../_archive/reports_2024-2025/)
- **Legacy Docs:** [`/docs/archive/project-docs-legacy/`](../archive/project-docs-legacy/)

---

## 🔄 Maintaining This Document

### When to Update
- Database schema changes (new tables, columns, relationships)
- New architectural patterns established
- Major refactoring initiatives completed
- Common pitfalls discovered
- Breaking changes to APIs or services

### Update Process
1. Edit this document with changes
2. Update "Last Updated" date at top
3. Notify team via commit message
4. Update related documentation if needed

### Archive Policy
- Historical reports → `/docs/_archive/reports_2024-2025/`
- Completed audits → `/docs/_archive/audits_2024-2025/`
- Superseded guides → `/docs/_archive/` with appropriate subdirectory

---

**This is the canonical source of truth. All other documentation should link here for context.**

