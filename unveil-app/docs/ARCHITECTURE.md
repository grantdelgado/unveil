# Unveil Architecture Guide

## 📋 Overview

Unveil is a modern wedding event management application built with Next.js 14, Supabase, and TypeScript. The application enables hosts to create wedding events and manage guests, while providing guests with real-time photo sharing, messaging, and RSVP capabilities.

---

## 🏗 Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **State Management**: React Query (@tanstack/react-query)
- **Real-time**: Supabase Realtime subscriptions
- **Authentication**: Supabase Auth with phone-based OTP

### Backend
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime
- **Security**: Row Level Security (RLS)
- **API**: Supabase REST API with generated TypeScript types

### Development & Deployment
- **Package Manager**: pnpm
- **Deployment**: Vercel
- **Code Quality**: ESLint, Prettier, TypeScript strict mode
- **Testing**: Vitest (unit), Playwright (E2E), MSW (mocking)

---

## 🛠️ Architecture Refactor History (v1.0.0)

As of January 2025, the codebase has undergone a comprehensive 5-phase refactor that established the current architecture standards and patterns. This refactor significantly improved code quality, maintainability, and developer experience.

### Key Architectural Improvements

**Phase 1 - Foundation Cleanup:**
- Unified error handling and retry logic across all services
- Centralized database error management with standardized patterns
- Consolidated validation logic with composable validation utilities

**Phase 2 - Component Architecture:**
- Split complex components (305+ lines) into focused, testable modules
- Migrated from direct Supabase usage to service layer abstraction
- Applied Container-Hook-View pattern for better separation of concerns

**Phase 3 - Type System Enhancement:**
- Eliminated all `any` types with strong TypeScript constraints
- Standardized service response types with `ServiceResult<T>` pattern
- Added generic constraints for type safety in reusable hooks

**Phase 4 - Performance Optimization:**
- Implemented React.memo and callback optimization for heavy components
- Added lazy loading for bundle optimization and improved initial load times
- Optimized expensive computations with proper memoization patterns

**Phase 5 - Code Quality Standards:**
- Converted 100+ console.log statements to unified logger system
- Resolved technical debt with proper documentation standards
- Established consistent naming conventions and coding patterns

### Current Architecture Benefits

- **Type Safety**: 100% TypeScript coverage with no `any` types in production code
- **Error Handling**: Unified error management with context-aware logging
- **Performance**: Optimized component rendering and bundle splitting
- **Maintainability**: Clear separation of concerns and consistent patterns
- **Developer Experience**: Comprehensive logging and debugging capabilities

→ **Full Refactor Details**: [`../00-OVERVIEW/unveil-codebase-refactor-plan.md`](../00-OVERVIEW/unveil-codebase-refactor-plan.md)

---

## 🔐 Authentication Flow

### Phone-First OTP Authentication

The application uses a unified phone-based authentication system optimized for both development and production environments.

#### Development Environment
```typescript
// Whitelisted development phones bypass OTP
const DEV_PHONE_WHITELIST = ['+15550000001', '+15550000002', '+15550000003']

// Development flow: phone → password auth → session creation
```

#### Production Environment
```typescript
// Production flow: phone → OTP → verification → session creation
await supabase.auth.signInWithOtp({ phone: normalizedPhone })
await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
```

#### Session Management
- **Rate Limiting**: 3 OTP attempts per hour with 15-minute blocks
- **Session Persistence**: localStorage with auto-refresh
- **User Creation**: Automatic profile creation in `users` table
- **RLS Compliance**: All sessions provide valid `auth.uid()` for database access

### Authentication Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Phone Input   │───▶│  OTP Generation  │───▶│ Session Creation│
│  (Normalized)   │    │ (Dev/Prod Split) │    │  (auth.uid())   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Validation    │    │  Rate Limiting   │    │ User Profile    │
│  (E.164 Format) │    │   (3/hour max)   │    │   Creation      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🗄 Database Schema & Design

### Core Tables

#### 1. Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. Events Table
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. Event Participants Table
```sql
CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

#### 4. Media Table
```sql
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'direct' CHECK (message_type IN ('direct', 'announcement')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Database Security (RLS Policies)

#### Event Access Control
```sql
-- Events: Hosts can manage, participants can view
CREATE POLICY "events_view" ON events FOR SELECT 
  TO authenticated USING (
    is_event_host(id) OR is_event_guest(id)
  );

CREATE POLICY "events_manage_insert" ON events FOR INSERT 
  TO authenticated WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "events_manage_update" ON events FOR UPDATE 
  TO authenticated USING (is_event_host(id));
```

#### Participant Access Control
```sql
-- Participants: Event hosts can manage, participants can view
CREATE POLICY "participants_view" ON event_participants FOR SELECT 
  TO authenticated USING (
    is_event_host(event_id) OR is_event_guest(event_id)
  );
```

#### Media & Messages Access
```sql
-- Media: Event participants can upload and view
CREATE POLICY "media_participant_access" ON media FOR ALL 
  TO authenticated USING (is_event_guest(event_id));

-- Messages: Event participants can send and view
CREATE POLICY "messages_participant_access" ON messages FOR ALL 
  TO authenticated USING (is_event_guest(event_id));
```

---

## 🔄 Real-Time Features

### Subscription Management

The application uses a centralized subscription manager for real-time features:

```typescript
// lib/realtime/SubscriptionManager.ts
class RealtimeSubscriptionManager {
  private subscriptions = new Map<string, RealtimeChannel>()
  
  subscribe(eventId: string, table: string, callback: Function) {
    const channel = supabase.channel(`${table}:${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table,
        filter: `event_id=eq.${eventId}`
      }, callback)
      .subscribe()
    
    this.subscriptions.set(`${table}:${eventId}`, channel)
    return channel
  }
}
```

### Real-Time Events

#### 1. Message Broadcasting
- **Trigger**: New message creation
- **Scope**: Event participants only
- **Implementation**: PostgreSQL triggers with Supabase Realtime

#### 2. Media Upload Notifications
- **Trigger**: New media uploads
- **Scope**: Event participants
- **Implementation**: Real-time `INSERT` events on media table

#### 3. RSVP Updates
- **Trigger**: Participant RSVP status changes
- **Scope**: Event hosts and participants
- **Implementation**: Real-time `UPDATE` events on event_participants table

---

## 🧩 Component Architecture

### Directory Structure

```
app/
├── (auth)/                 # Authentication routes
│   ├── login/             # Phone input and OTP verification
│   └── select-event/      # Event selection after auth
├── host/                  # Host-specific routes
│   ├── dashboard/         # Host overview
│   └── events/           # Event management
│       ├── create/       # Event creation
│       └── [eventId]/    # Event-specific host views
└── guest/                # Guest-specific routes
    └── events/           # Guest event views
        └── [eventId]/    # Event-specific guest views

components/
├── features/             # Domain-specific components
│   ├── auth/            # Authentication components
│   ├── events/          # Event management
│   ├── guests/          # Guest/participant management
│   ├── media/           # Photo/video gallery
│   ├── messaging/       # Real-time messaging
│   └── navigation/      # App navigation
└── ui/                  # Reusable UI components
    ├── Button.tsx
    ├── Input.tsx
    └── LoadingSpinner.tsx
```

### Component Patterns

#### 1. Feature-First Organization
```typescript
// components/features/messaging/
├── GuestMessaging.tsx      # Main messaging interface
├── MessageComposer.tsx     # Message input component
├── MessageThread.tsx       # Message list display
└── index.ts               # Feature exports
```

#### 2. Custom Hooks Pattern
```typescript
// hooks/messaging/
├── useMessages.ts          # Message data fetching
├── useMessagesCached.ts    # Cached message queries
└── useRealtimeMessages.ts  # Real-time subscriptions
```

#### 3. Service Layer Pattern
```typescript
// services/messaging.ts
export const sendMessage = async (data: MessageInsert) => {
  // Validation, database operation, error handling
}
```

---

## 📱 User Experience Flow

### Host Journey
```
Authentication → Dashboard → Create Event → Manage Participants → 
View Gallery → Send Announcements → Monitor RSVPs
```

### Guest Journey
```
Authentication → Select Event → View Details → Update RSVP → 
Upload Photos → Send Messages → View Gallery
```

### Navigation System

#### Role-Based Routing
```typescript
// Middleware determines user role and redirects appropriately
const userRole = await getUserEventRole(eventId, userId)
if (userRole === 'host') {
  redirect(`/host/events/${eventId}/dashboard`)
} else {
  redirect(`/guest/events/${eventId}/home`)
}
```

#### Bottom Navigation (Mobile-First)
```typescript
// components/features/navigation/BottomNavigation.tsx
const navItems = [
  { label: 'Home', icon: HomeIcon, href: `/guest/events/${eventId}/home` },
  { label: 'Gallery', icon: PhotoIcon, href: `/guest/events/${eventId}/gallery` },
  { label: 'Messages', icon: ChatIcon, href: `/guest/events/${eventId}/messages` },
  { label: 'RSVP', icon: CheckIcon, href: `/guest/events/${eventId}/rsvp` }
]
```

---

## ⚡ Performance Optimizations

### Caching Strategy

#### React Query Implementation
```typescript
// hooks/events/useEventsCached.ts
export const useEventsCached = (userId: string) => {
  return useQuery({
    queryKey: ['user-events', userId],
    queryFn: () => getEventsByUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  })
}
```

#### Query Key Strategy
```typescript
// lib/react-query.tsx
export const queryKeys = {
  events: {
    all: ['events'] as const,
    user: (userId: string) => ['events', 'user', userId] as const,
    detail: (eventId: string) => ['events', eventId] as const,
    participants: (eventId: string) => ['events', eventId, 'participants'] as const,
  },
  media: {
    all: ['media'] as const,
    event: (eventId: string) => ['media', 'event', eventId] as const,
    recent: (userId: string) => ['media', 'recent', userId] as const,
  }
}
```

### Code Splitting & Lazy Loading

```typescript
// components/ui/LazyWrapper.tsx
const LazyComponent = lazy(() => import('./HeavyComponent'))

export const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </Suspense>
)
```

### Image Optimization

```typescript
// components/ui/OptimizedImage.tsx
export const OptimizedImage = ({ src, alt, ...props }) => {
  const [loadTime, setLoadTime] = useState<number>()
  
  return (
    <Image
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoadTime(performance.now())}
      {...props}
    />
  )
}
```

---

## 🛡 Security Considerations

### Input Validation & Sanitization

#### File Upload Security
```typescript
// services/media.ts
const validateFileType = async (file: File) => {
  // 1. MIME type validation
  // 2. File extension verification
  // 3. Magic number validation
  // 4. Size limits (25MB images, 50MB videos)
  // 5. Dangerous file type rejection
}
```

#### Content Sanitization
```typescript
// All user inputs are validated before database operations
const validateMessage = (content: string) => {
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Message too long')
  }
  // Additional sanitization logic
}
```

### Access Control

#### Row Level Security (RLS)
- All tables have RLS enabled
- Policies enforce event-based access control
- Helper functions: `is_event_host()`, `is_event_guest()`

#### API Security
- All routes require authentication
- Session validation on every request
- Rate limiting on OTP endpoints

---

## 🔄 Development Workflow

### Local Development Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Set up Supabase
supabase start
supabase db reset

# 3. Generate types
pnpm supabase:types

# 4. Start development server
pnpm dev
```

### Testing Strategy

#### Unit Tests (Vitest)
```typescript
// lib/validations.test.ts
describe('validatePhoneNumber', () => {
  it('should validate US phone numbers', () => {
    expect(validatePhoneNumber('(555) 123-4567')).toBe(true)
  })
})
```

#### E2E Tests (Playwright)
```typescript
// playwright-tests/basic.spec.ts
test('host can create event', async ({ page }) => {
  await page.goto('/host/events/create')
  await page.fill('[data-testid=event-title]', 'Test Wedding')
  await page.click('[data-testid=create-event-button]')
  // Test event creation flow
})
```

#### RLS Testing
```typescript
// scripts/test-rls-policies.ts
const testEventAccess = async () => {
  // Test host can access their events
  // Test guests cannot access other events
  // Test proper policy enforcement
}
```

---

## 📊 Monitoring & Analytics

### Performance Monitoring
```typescript
// hooks/performance/usePerformanceMonitor.ts
export const usePerformanceMonitor = () => {
  useEffect(() => {
    // Track Core Web Vitals
    // Monitor component render times
    // Log performance budgets
  }, [])
}
```

### Error Tracking
```typescript
// lib/logger.ts
export const logger = {
  auth: (message: string, data?: any) => {
    console.log('🔐', message, data)
    // Send to analytics service in production
  },
  error: (message: string, error?: any) => {
    console.error('❌', message, error)
    // Send to error tracking service
  }
}
```

---

## 🚀 Deployment Architecture

### Vercel Deployment
- **Frontend**: Vercel Edge Network
- **API Routes**: Vercel Serverless Functions
- **Environment**: Production/Preview/Development branches

### Supabase Infrastructure
- **Database**: PostgreSQL with automatic backups
- **Storage**: CDN-backed file storage
- **Real-time**: WebSocket connections
- **Auth**: JWT-based authentication

### Environment Configuration
```typescript
// Environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
TWILIO_ACCOUNT_SID=your-twilio-sid (for SMS)
TWILIO_AUTH_TOKEN=your-twilio-token
```

---

## 📈 Scalability Considerations

### Database Optimization
- **Indexes**: Optimized for common query patterns
- **Partitioning**: Events can be partitioned by date if needed
- **Connection Pooling**: Managed by Supabase

### Real-time Scalability
- **Channel Limits**: Supabase handles up to 100 concurrent connections per channel
- **Event Filtering**: Server-side filtering reduces client-side processing
- **Subscription Management**: Automatic cleanup prevents memory leaks

### Frontend Performance
- **Bundle Splitting**: Lazy-loaded components reduce initial bundle size
- **Image Optimization**: Next.js Image component with Supabase CDN
- **Caching**: React Query provides intelligent data caching

---

## 🔄 Future Architecture Considerations

### Microservices Migration
If the application grows beyond current scope:
- **Event Service**: Event management and scheduling
- **Media Service**: File upload and processing
- **Notification Service**: Real-time notifications and SMS
- **User Service**: Authentication and profile management

### Advanced Features
- **Video Processing**: Server-side video compression and thumbnails
- **Push Notifications**: Web push for real-time alerts
- **Analytics Dashboard**: Event insights and participant engagement
- **Multi-tenancy**: Support for wedding planners managing multiple events

---

*This architecture guide reflects the current state of the Unveil application as of Phase 6 completion. The architecture prioritizes security, performance, and developer experience while maintaining simplicity and maintainability.* 