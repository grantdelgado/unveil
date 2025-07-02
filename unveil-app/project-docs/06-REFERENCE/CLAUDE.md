# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server (runs on http://localhost:3000)
- `pnpm build` - Build for production 
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint checks
- `pnpm lint:fix` - Fix auto-fixable ESLint issues
- `pnpm format` - Format code with Prettier

### Testing
- `pnpm test` - Run unit tests with Vitest
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Generate test coverage reports
- `pnpm test:ui` - Open Vitest UI
- `pnpm test:e2e` - Run Playwright E2E tests
- `pnpm test:e2e:ui` - Run E2E tests with UI
- `pnpm test:all` - Run all test suites (unit, E2E, mobile, lighthouse)
- `pnpm test:rls` - Test Row Level Security policies

### Database & Setup
- `pnpm dev-setup` - Initialize development environment with test data
- `pnpm dev-reset` - Reset development environment
- `pnpm dev-demo` - Set up demo data
- `pnpm db:test` - Reset local Supabase database and run dev setup
- `supabase gen types typescript --local > app/reference/supabase.types.ts` - Generate TypeScript types from database

### Schema Management
- `pnpm schema:sync` - Synchronize database schema
- `pnpm schema:validate` - Validate schema consistency
- `pnpm schema:watch` - Watch for schema changes
- `pnpm schema:test` - Test schema awareness

### Test User Management
- `pnpm test-users:create` - Create test users
- `pnpm test-users:scenario` - Set up test scenarios
- `pnpm test-users:list` - List existing test users
- `pnpm test-users:cleanup` - Clean up test users
- `pnpm test-users:cleanup-all` - Clean up all test data

## Architecture Overview

Unveil is a modern wedding communication platform built with Next.js 15, Supabase, and TypeScript. The app serves both hosts (wedding couples) and guests with role-based interfaces for event management, messaging, and media sharing.

### Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with custom design system
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: TanStack React Query for server state
- **Testing**: Vitest (unit), Playwright (E2E), MSW (mocking)
- **Development**: pnpm, Vercel deployment
- **Monitoring**: Sentry for error tracking

### Key Features
- **Phone-first Authentication**: OTP-based auth optimized for mobile
- **Multi-event Management**: Support for rehearsal, ceremony, reception events
- **Advanced Messaging**: Scheduled messages with multi-channel delivery (SMS/Push/Email)
- **Guest Management**: Bulk operations, CSV import, RSVP tracking
- **Real-time Features**: Live messaging, media uploads, RSVP updates
- **Media Gallery**: Photo/video sharing with Supabase Storage
- **Mobile-first Design**: PWA-ready with responsive layouts

### Directory Structure

```
app/                    # Next.js App Router
├── api/               # API routes
├── host/              # Host-specific pages
├── guest/             # Guest-specific pages
├── (auth)/            # Authentication routes
└── reference/         # Schema and type definitions

components/
├── features/          # Domain-specific components
│   ├── auth/         # Authentication components
│   ├── events/       # Event management
│   ├── messaging/    # Real-time messaging
│   └── guests/       # Guest management
└── ui/               # Reusable UI components

hooks/                 # Custom React hooks
├── auth/             # Authentication hooks
├── events/           # Event data hooks
├── messaging/        # Messaging hooks
└── realtime/         # Real-time subscriptions

services/             # Data layer services
├── auth.ts
├── events.ts
├── messaging.ts
└── guests.ts

lib/                  # Utility libraries
├── supabase/         # Supabase client and helpers
├── types/            # TypeScript type definitions
└── utils/            # General utilities
```

### Database Schema

Core tables with Row Level Security (RLS):
- `users` - User profiles and authentication
- `events` - Main wedding events
- `sub_events` - Individual event types (rehearsal, ceremony, etc.)
- `event_guests` - Guest list with RSVP tracking
- `guest_sub_event_assignments` - Guest assignments to specific events
- `messages` - Real-time messaging
- `scheduled_messages` - Advanced message scheduling
- `message_deliveries` - Delivery tracking (SMS/Push/Email)
- `media` - Photo/video uploads
- `guest_tags` - Guest categorization and targeting

### Authentication System

The app uses phone-first OTP authentication with development shortcuts:

**Development Environment**:
- Whitelisted phones (`+15550000001`, `+15550000002`, `+15550000003`) bypass OTP
- Uses password authentication for faster development cycles

**Production Environment**:
- Full OTP flow via Twilio SMS integration
- Rate limiting: 3 attempts per hour with 15-minute blocks

### Real-time Features

Managed through centralized subscription system:
- Message broadcasting to event participants
- Media upload notifications
- RSVP status updates
- Live analytics updates

### Role-Based Access

**Hosts**: Create/manage events, bulk guest operations, send targeted messages, view analytics
**Guests**: Join events, receive updates, upload media, manage RSVP status

All access controlled through Supabase RLS policies with helper functions:
- `is_event_host(event_id)` - Check if user is event host
- `is_event_guest(event_id)` - Check if user is event participant

## Development Guidelines

### Code Style
- TypeScript strict mode with `noUncheckedIndexedAccess`
- ESLint + Prettier configuration enforced
- Feature-first component organization
- Custom hooks for data fetching with React Query
- Service layer pattern for database operations

### Component Patterns
- Use custom hooks for data operations (e.g., `useMessages`, `useEvents`)
- Implement loading states and error boundaries
- Follow mobile-first responsive design
- Use React Query for caching and background updates
- Real-time subscriptions through centralized `SubscriptionManager`

### Testing Strategy
- Unit tests for utilities and validation logic
- Integration tests with MSW for API mocking
- E2E tests for critical user flows
- RLS policy testing with dedicated scripts
- Performance testing with Lighthouse

### Security Considerations
- All user inputs validated with Zod schemas
- File uploads restricted by type, size, and magic number validation
- RLS policies enforce event-based access control
- Content Security Policy configured in Next.js
- Rate limiting on authentication endpoints

### Performance Optimizations
- React Query caching with strategic invalidation
- Lazy loading for heavy components
- Next.js Image optimization with Supabase CDN
- Bundle splitting and code optimization
- Performance monitoring with Core Web Vitals

## Common Tasks

### Adding New Features
1. Create service functions in `/services` with proper error handling
2. Create custom hooks in `/hooks` with React Query integration
3. Build components in `/components/features` following existing patterns
4. Add API routes in `/app/api` if needed
5. Update TypeScript types and run tests

### Database Changes
1. Create migration in `supabase/migrations/`
2. Apply RLS policies with appropriate helper functions
3. Regenerate types: `supabase gen types typescript --local > app/reference/supabase.types.ts`
4. Update service functions to use new schema
5. Test RLS policies with `pnpm test:rls`

### Real-time Features
- Use `SubscriptionManager` for centralized subscription handling
- Always clean up subscriptions in component cleanup
- Filter events server-side for performance
- Handle reconnection scenarios gracefully

### Mobile Optimization
- Test on actual devices using `pnpm test:mobile`
- Use Tailwind responsive classes (xs, sm, md, lg)
- Implement touch gestures and haptic feedback
- Optimize images and lazy load heavy content

### Error Handling
- Use centralized error handling in service layer
- Implement user-friendly error messages
- Log errors with context for debugging
- Provide fallback UI states for error scenarios

## Environment Setup

Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Optional for SMS features
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

For local development with Supabase CLI:
1. Run `supabase start` to start local stack
2. Use `supabase db reset` to apply latest migrations
3. Generate types with the command above
4. Access local dashboard at http://localhost:54323

## Important Notes

- Always run `pnpm lint` and `pnpm test` before committing
- Use the test user management scripts for consistent development data
- Schema changes require both migration files and type regeneration
- RLS policies are critical - test thoroughly with `pnpm test:rls`
- Mobile-first design is enforced throughout the application
- Real-time features require careful subscription management to prevent memory leaks