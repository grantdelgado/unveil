# Unveil App Refactoring Plan

## 🚨 CRITICAL ISSUES IDENTIFIED

### 1. Component Organization Chaos

**Current State**: Components scattered across multiple directories

- `app/components/`: 6 components (GuestPhotoGallery, GuestMessaging, etc.)
- `components/ui/`: UI components
- `components/host-dashboard/`: Host-specific components
- `components/guest-import/`: Import-related components

**Problems**:

- Inconsistent import paths (`@/app/components` vs `@/components`)
- Violates rule #1 (shared components in `app/components/`)
- Makes component discovery difficult
- Breaks the principle of feature-first architecture

**Solution**: Consolidate under unified structure:

```
components/
├── ui/                    # Base UI components
├── features/
│   ├── auth/             # Authentication components
│   ├── events/           # Event management
│   ├── guests/           # Guest management & import
│   ├── media/            # Photo/video components
│   ├── messaging/        # Chat & messaging
│   └── scheduling/       # Event scheduling
└── layout/               # Layout components
```

### 2. Database Client Violations

**Current Issues in `lib/supabase.ts`**:

- 369 lines - too large, violates SRP
- All database operations mixed together
- No separation of concerns by domain
- Type definitions mixed with client logic

**Solution**: Split into domain-specific modules:

```
lib/
├── supabase/
│   ├── client.ts         # Core client setup
│   ├── types.ts          # Type exports
│   ├── auth.ts           # Authentication helpers
│   ├── events.ts         # Event operations
│   ├── guests.ts         # Guest operations
│   ├── media.ts          # Media operations
│   ├── messaging.ts      # Message operations
│   └── storage.ts        # Storage helpers
```

### 3. Hook Organization Issues

**Current State**: Only 2 hooks in `app/lib/`

- `useEvents.ts` - 95 lines, handles both host and guest events
- `useGuestEvent.ts` - 119 lines

**Problems**:

- Hooks are in `app/lib/` instead of dedicated hooks directory
- `useEvents` does too much (host + guest events)
- Missing hooks for other domains (media, messaging, etc.)

**Solution**: Create dedicated hooks structure:

```
hooks/
├── auth/
│   ├── useAuth.ts
│   └── useProfile.ts
├── events/
│   ├── useHostEvents.ts
│   ├── useGuestEvents.ts
│   └── useEventDetails.ts
├── media/
│   ├── useMediaUpload.ts
│   └── useEventMedia.ts
├── messaging/
│   ├── useMessages.ts
│   └── useRealTimeMessages.ts
└── guests/
    ├── useGuests.ts
    └── useGuestImport.ts
```

### 4. Utility Function Bloat

**Problem**: `lib/utils.ts` is 280 lines with mixed concerns

- Date formatting
- File utilities
- Validation functions
- Error handling
- URL utilities
- Local storage

**Solution**: Split into focused modules:

```
lib/utils/
├── date.ts              # Date formatting utilities
├── file.ts              # File handling utilities
├── validation.ts        # Validation functions
├── storage.ts           # Local storage utilities
├── url.ts               # URL utilities
└── index.ts             # Re-exports
```

### 5. Missing Type Safety

**Issues**:

- No central type definitions beyond Supabase generated types
- Components use inline types instead of shared interfaces
- No validation schemas for forms

**Solution**: Create comprehensive type system:

```
types/
├── api.ts               # API response types
├── forms.ts             # Form validation types
├── components.ts        # Component prop types
└── domain/
    ├── events.ts        # Event-related types
    ├── guests.ts        # Guest-related types
    ├── media.ts         # Media-related types
    └── messaging.ts     # Message-related types
```

### 6. Error Handling Inconsistencies

**Current Issues**:

- `lib/error-handling.ts` exists but inconsistent usage
- Components have mixed error handling patterns
- No global error boundary strategy

**Solution**: Implement consistent error handling:

```
lib/errors/
├── AppError.ts          # Custom error classes
├── ErrorBoundary.tsx    # Move from components/ui
├── hooks.ts             # Error handling hooks
└── utils.ts             # Error utilities
```

## 📋 REFACTORING PHASES

### Phase 1: Component Consolidation (High Priority)

1. Move all `app/components/*` to appropriate `components/features/` directories
2. Update all import paths
3. Create component index files for clean imports
4. Remove empty `app/components/` directory

### Phase 2: Database Layer Refactoring (High Priority)

1. Split `lib/supabase.ts` into domain-specific modules
2. Create proper abstractions for each domain
3. Implement consistent error handling across all database operations
4. Add proper TypeScript generics for better type safety

### Phase 3: Hook Organization (Medium Priority)

1. Move `app/lib/use*.ts` to dedicated `hooks/` directory
2. Split `useEvents` into `useHostEvents` and `useGuestEvents`
3. Create missing hooks for other domains
4. Implement proper caching and state management

### Phase 4: Utility Refactoring (Medium Priority)

1. Split `lib/utils.ts` into focused modules
2. Improve type safety for all utility functions
3. Add comprehensive tests for utilities
4. Create proper documentation

### Phase 5: Type System Enhancement (Low Priority)

1. Create comprehensive type definitions
2. Add form validation schemas using Zod
3. Implement proper API response types
4. Add component prop type definitions

## 🎯 IMMEDIATE ACTIONS REQUIRED

1. **Stop adding to `app/components/`** - use `components/features/` instead
2. **Standardize imports** - decide on import path strategy and stick to it
3. **Create component index files** for cleaner imports
4. **Split the monolithic `lib/supabase.ts` file**
5. **Move hooks to dedicated directory**

## 📊 SUCCESS METRICS

- [x] All components follow consistent organization ✅ COMPLETED
- [x] Import paths are standardized ✅ COMPLETED
- [x] Database operations are domain-separated ✅ COMPLETED
- [x] Hook organization is domain-based ✅ COMPLETED
- [x] Real-time functionality is properly implemented ✅ COMPLETED
- [x] Utility functions are properly modularized ✅ COMPLETED
- [x] Error handling is consistent across the app ✅ COMPLETED
- [x] Type safety is improved ✅ COMPLETED
- [x] Code is more maintainable and testable ✅ COMPLETED

## 🔧 RECOMMENDED TOOLS

1. **ESLint rules** for import path consistency
2. **Prettier** for consistent formatting
3. **TypeScript strict mode** (already enabled)
4. **Zod** for runtime validation
5. **React Testing Library** for component testing

## 📝 NOTES

This refactoring will significantly improve:

- Code maintainability
- Developer experience
- Type safety
- Error handling
- Performance through better code splitting
- Scalability for future features

The current codebase has grown organically but needs architectural discipline to continue scaling effectively.
