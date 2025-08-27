# Unveil App Map: Complete Architecture Overview

*Generated on: $(date)*

## Executive Summary

Unveil is a Next.js 14 wedding app using the App Router architecture with role-based access control (host/guest), real-time messaging, and comprehensive event management. The app follows a mobile-first design with Supabase as the backend, TypeScript for type safety, and Tailwind CSS for styling.

---

## 1. Page Inventory

### Authentication & Setup Routes

| Route | Purpose | Key Services/Hooks | Access Level |
|-------|---------|-------------------|--------------|
| `/` | Landing page with auth redirect logic | `useAuth`, `usePostAuthRedirect` | Public |
| `/login` | Phone-based OTP authentication | `useAuth`, `usePostAuthRedirect`, `validatePhoneNumber` | Public |
| `/reset-password` | Password reset flow | `useAuth` | Public |
| `/select-event` | Event selection hub after login | `useUserEvents`, `useAuth` | Authenticated |
| `/setup` | Initial user setup and onboarding | `useAuth` | Authenticated |
| `/profile` | User profile management | `useAuth` | Authenticated |

### Host Routes (`/host/events/[eventId]/`)

| Route | Purpose | Key Services/Hooks | RLS Protected |
|-------|---------|-------------------|---------------|
| `/dashboard` | Main host dashboard with event overview | `useUnifiedGuestCounts`, `is_event_host` RPC | ✅ |
| `/details` | Event details editing | Event CRUD operations | ✅ |
| `/edit` | Event configuration editor | Event update mutations | ✅ |
| `/guests` | Guest management interface | `useGuests`, `soft_delete_guest` RPC | ✅ |
| `/messages` | Message center with composition | `MessageCenter`, `resolve_message_recipients` RPC | ✅ |
| `/messages/compose` | Message composition interface | Messaging services | ✅ |
| `/messages/analytics` | Message delivery analytics | Analytics hooks | ✅ |
| `/schedule` | Event schedule management | Schedule CRUD operations | ✅ |

### Guest Routes (`/guest/events/[eventId]/`)

| Route | Purpose | Key Services/Hooks | RLS Protected |
|-------|---------|-------------------|---------------|
| `/home` | Guest event home with details & messaging | `useEventWithGuest`, `GuestMessaging` | ✅ |
| `/schedule` | Event schedule view for guests | Schedule queries | ✅ |
| `/` | Guest event overview | Event queries | ✅ |

### Special Routes

| Route | Purpose | Key Services/Hooks | Notes |
|-------|---------|-------------------|-------|
| `/dashboard` | Legacy dashboard redirect | Redirect logic | Deprecated |
| `/guest/home` | Guest home page | Event queries | Role-based |

---

## 2. Services & Hooks Inventory

### Core Authentication & State Management

| Service/Hook | Purpose | Used By | Supabase Operations |
|--------------|---------|---------|-------------------|
| `AuthProvider` | Centralized auth state management | App-wide | `supabase.auth.*` |
| `SubscriptionProvider` | Real-time subscription management | App-wide | `supabase.realtime.*` |
| `ReactQueryProvider` | Data fetching & caching | App-wide | Query client setup |
| `useAuth` | Auth context hook | All authenticated pages | Session management |
| `usePostAuthRedirect` | Post-login routing logic | Login flow | User role detection |

### Event Management

| Service/Hook | Purpose | Used By | Supabase Operations |
|--------------|---------|---------|-------------------|
| `useEvents` | Event CRUD operations | Event pages | `events` table queries |
| `useUserEvents` | User's events (host + guest) | Select event page | Complex joins with roles |
| `useHostEvents` | Host-specific events | Host dashboard | `events` filtered by host |
| `useGuestEvents` | Guest-specific events | Guest pages | Event-guest joins |
| `useEventDetails` | Single event details | Event detail pages | Single event queries |
| `useEventWithGuest` | Event + guest info combined | Guest home page | Complex joins |

### Guest Management

| Service/Hook | Purpose | Used By | Supabase Operations |
|--------------|---------|---------|-------------------|
| `useGuests` | Guest CRUD operations | Guest management | `event_guests` table |
| `useUnifiedGuestCounts` | Consistent guest statistics | Dashboards | Aggregation queries |
| `useGuestDecline` | Guest decline functionality | Guest pages | Guest status updates |
| `useGuestRejoin` | Guest rejoin functionality | Guest pages | Status restoration |
| `useAutoJoinGuests` | Automatic guest linking | Auth flow | `link_unlinked_guests` RPC |
| `usePhoneDuplicateCheck` | Phone number validation | Guest import | Duplicate detection |

### Messaging System

| Service/Hook | Purpose | Used By | Supabase Operations |
|--------------|---------|---------|-------------------|
| `useMessages` | Message CRUD operations | Message pages | `messages` table |
| `useGuestMessagesRPC` | Guest message fetching | Guest messaging | `get_guest_event_messages_v2` RPC |
| `useScheduledMessages` | Scheduled message management | Host messaging | `scheduled_messages` table |
| `useMessagingRecipients` | Recipient selection logic | Message composer | `resolve_message_recipients` RPC |
| `useGuestSelection` | Guest selection for messaging | Message center | Selection state |
| `useRecipientPreview` | Message recipient preview | Message composer | Recipient calculation |

### Real-time & Performance

| Service/Hook | Purpose | Used By | Supabase Operations |
|--------------|---------|---------|-------------------|
| `useRealtimeSubscription` | Real-time data subscriptions | Message components | `supabase.channel()` |
| `useOptimizedRealtimeSubscription` | Performance-optimized subscriptions | High-traffic components | Optimized channels |
| `usePerformanceMonitor` | Performance tracking | App-wide | Metrics collection |
| `useDebounce` | Input debouncing | Search/input components | N/A |
| `usePagination` | Data pagination | List components | Pagination logic |

---

## 3. Supabase RPC Functions Used

### Authentication & Authorization
- `is_event_host(p_event_id)` - Host permission verification
- `is_event_guest(p_event_id)` - Guest permission verification

### Messaging System
- `get_guest_event_messages_v2(p_event_id, p_limit, p_before)` - Guest message fetching with pagination
- `resolve_message_recipients(p_event_id, p_filter)` - Message recipient resolution
- `update_scheduled_message(p_message_id, p_content, p_send_at)` - Scheduled message updates
- `get_scheduled_messages_for_processing()` - Cron job message processing
- `upsert_message_delivery(p_message_id, p_guest_id)` - Delivery record management

### Guest Management
- `soft_delete_guest(p_guest_id)` - Safe guest removal
- `get_invitable_guest_ids(p_event_id)` - Bulk invitation eligibility
- `update_guest_invitation_tracking_strict(p_event_id, p_guest_ids)` - Invitation tracking

### Event Reminders
- `upsert_event_reminder(p_event_id, p_timeline_id)` - Reminder management
- `get_event_reminder_status(p_event_id, p_timeline_id)` - Reminder status checks
- `sync_event_reminder_on_time_change(p_event_id, p_timeline_id)` - Time sync

### Utility Functions
- `mark_a2p_notice_sent(p_event_id, p_guest_id)` - SMS compliance tracking
- `preview_missing_announcement_deliveries(p_event_id)` - Delivery gap analysis
- `backfill_announcement_deliveries(p_event_id, p_dry_run)` - Delivery backfill

---

## 4. Navigation Flow Map

```
Authentication Flow:
/ (Landing) → /login → /select-event → Role-based routing

Host Flow:
/select-event → /host/events/[id]/dashboard → {
  ├── /details (Event editing)
  ├── /guests (Guest management)
  ├── /messages (Message center)
  ├── /schedule (Schedule management)
  └── /edit (Event configuration)
}

Guest Flow:
/select-event → /guest/events/[id]/home → {
  ├── /schedule (View schedule)
  └── Guest interactions (RSVP, messaging)
}

Profile & Settings:
Any page → /profile → User management
```

### Key Navigation Patterns

1. **Auth Guard**: All app routes require authentication
2. **Role-based Routing**: Post-auth redirect based on user role in event
3. **Event Scoping**: All functional routes are scoped to specific events
4. **Mobile-first Navigation**: Optimized for mobile with back buttons and breadcrumbs

---

## 5. Data Flow Architecture

### State Management Layers

```
┌─────────────────────────────────────────┐
│ React Query (Data Fetching & Caching)  │
├─────────────────────────────────────────┤
│ Supabase Client (Database Operations)   │
├─────────────────────────────────────────┤
│ RPC Functions (Complex Business Logic)  │
├─────────────────────────────────────────┤
│ Row Level Security (Data Protection)    │
└─────────────────────────────────────────┘
```

### Real-time Data Flow

```
Database Change → Supabase Realtime → SubscriptionManager → 
Component Subscriptions → React Query Invalidation → UI Update
```

---

## 6. Component Architecture

### Feature-based Organization

```
components/features/
├── auth/           # Authentication components
├── events/         # Event creation & management
├── guest/          # Guest-specific UI components
├── guests/         # Guest management (host side)
├── host-dashboard/ # Host dashboard components
├── messaging/      # Messaging system components
├── media/          # Photo/media components
└── scheduling/     # Event scheduling components
```

### Shared Components

```
components/
├── ui/            # Base UI components (buttons, inputs, etc.)
├── shared/        # Cross-feature shared components
└── layout/        # Layout and navigation components
```

---

## 7. API Routes & Webhooks

### Internal API Routes (`/api/`)

| Route | Purpose | Authentication | Key Operations |
|-------|---------|----------------|----------------|
| `/api/messages/send` | Send immediate messages | Required | Message creation & SMS dispatch |
| `/api/messages/process-scheduled` | Cron job for scheduled messages | System | Batch message processing |
| `/api/guests/invite-bulk` | Bulk guest invitations | Host only | Batch SMS invitations |
| `/api/guests/invite-single` | Single guest invitation | Host only | Individual SMS invitation |
| `/api/sms/send-*` | Various SMS operations | Host only | SMS dispatch via Twilio |
| `/api/webhooks/twilio` | Twilio webhook handler | Webhook auth | SMS delivery status updates |

### Cron Jobs

- **Message Processing**: `/api/cron/process-messages` - Processes scheduled messages
- **Reminder System**: Event reminder dispatch (via scheduled messages)

---

## 8. Security & Access Control

### Row Level Security (RLS) Policies

All tables implement RLS with the following patterns:
- **Events**: Host can read/write their events, guests can read events they're invited to
- **Messages**: Scoped to event participants only
- **Guests**: Host can manage guests, guests can read their own records
- **Media**: Event-scoped access control

### Authentication Flow

1. **Phone-based OTP**: Primary authentication method
2. **Session Management**: Supabase Auth with automatic token refresh
3. **Role Detection**: Dynamic role assignment based on event participation
4. **Auto-join**: Automatic guest linking for existing phone numbers

---

## 9. Performance Optimizations

### Data Fetching

- **React Query**: Intelligent caching with stale-while-revalidate
- **Optimistic Updates**: Immediate UI updates with rollback on failure
- **Pagination**: Implemented for large datasets (guests, messages)
- **Real-time Subscriptions**: Selective subscriptions to reduce overhead

### Code Splitting

- **Lazy Loading**: Heavy components loaded on demand
- **Route-based Splitting**: Automatic code splitting by Next.js App Router
- **Feature Modules**: Self-contained feature bundles

### Mobile Optimizations

- **Image Optimization**: Next.js Image component with Supabase CDN
- **Touch Interactions**: Optimized for mobile gestures
- **Offline Handling**: Service worker for basic offline functionality

---

## 10. Observations & Technical Debt

### Strengths

1. **Consistent Architecture**: Well-structured feature-based organization
2. **Type Safety**: Comprehensive TypeScript usage with generated Supabase types
3. **Real-time Features**: Robust real-time messaging and updates
4. **Security**: Comprehensive RLS implementation
5. **Performance**: Optimized data fetching and caching strategies

### Areas for Improvement

1. **RPC Function Proliferation**: Many complex operations moved to RPC functions
2. **Message System Complexity**: Multiple messaging hooks with overlapping concerns
3. **Guest Management**: Complex state management across multiple hooks
4. **Error Handling**: Inconsistent error handling patterns across components
5. **Testing Coverage**: Limited test coverage for complex business logic

### Potential Risks

1. **RPC Dependency**: Heavy reliance on custom RPC functions may impact portability
2. **Real-time Overhead**: Complex subscription management may impact performance
3. **Mobile Performance**: Large bundle size for mobile users
4. **Data Consistency**: Complex real-time updates may cause race conditions

---

## 11. Development Workflow

### Code Standards

- **TypeScript Strict Mode**: Enforced throughout the codebase
- **ESLint + Prettier**: Automated code formatting and linting
- **Conventional Commits**: Standardized commit message format
- **Feature Branch Workflow**: All changes via pull requests

### Testing Strategy

- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing
- **Integration Tests**: Database and API integration testing
- **Manual Testing**: Comprehensive manual testing checklist

### Deployment

- **Vercel**: Production deployment platform
- **Preview Branches**: Automatic preview deployments
- **Environment Management**: Separate staging and production environments

---

## 12. Future Scalability Considerations

### Technical Scaling

1. **Database Optimization**: Query optimization and indexing strategies
2. **CDN Integration**: Enhanced media delivery via CDN
3. **Caching Layer**: Redis or similar for high-frequency data
4. **Microservices**: Potential extraction of messaging system

### Feature Scaling

1. **Multi-event Support**: Enhanced support for users with multiple events
2. **Vendor Integration**: Wedding vendor management features
3. **Advanced Analytics**: Comprehensive event analytics dashboard
4. **International Support**: Multi-language and timezone support

---

*This document serves as a living reference for the Unveil application architecture. Update as the system evolves.*
