# 🔍 Database Schema & Auth Flow Simplification Audit

## **Current State Analysis**

### **❌ Complexity Issues Identified**

1. **Over-engineered Tables**: 11+ tables with complex relationships
2. **Mixed Auth Patterns**: Phone + email authentication causing confusion
3. **Complex RLS**: Overly complex policies making development difficult
4. **Poor Dev Experience**: Complex test user setup and debugging
5. **Messaging Overkill**: 3 separate messaging tables for MVP needs
6. **Unused Features**: Sub-events, communication preferences may be premature

### **✅ What Works Well**

- Phone-first authentication concept
- Per-event role assignment
- Basic RLS structure
- Supabase Auth integration

---

## 🎯 **SIMPLIFIED SCHEMA PROPOSAL**

### **Core Tables (5 Only)**

```sql
-- 1. USERS (Simplified)
CREATE TABLE public.users (
  id UUID DEFAULT auth.uid() NOT NULL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT, -- Optional for notifications only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

-- 2. EVENTS (Simplified)
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  header_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EVENT_PARTICIPANTS (Replaces event_guests - cleaner name)
CREATE TABLE public.event_participants (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  notes TEXT,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(event_id, user_id)
);

-- 4. MEDIA (Simplified)
CREATE TABLE public.media (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. MESSAGES (Simplified - Single table)
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'direct' CHECK (message_type IN ('direct', 'announcement')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **🗑️ Tables to REMOVE**

- `communication_preferences` (premature optimization)
- `guest_sub_event_assignments` (over-engineering)
- `message_deliveries` (complex messaging overkill)
- `scheduled_messages` (can be external service later)
- `sub_events` (feature creep for MVP)

### **📊 Complexity Reduction**

- **From 11 tables → 5 tables** (55% reduction)
- **From 50+ columns → 30 columns** (40% reduction)
- **From 8 RLS functions → 3 RLS functions** (62% reduction)

---

## 🔐 **SIMPLIFIED RLS FUNCTIONS**

```sql
-- 1. Check if user can access event (host or participant)
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id
    WHERE e.id = p_event_id
    AND (e.host_user_id = auth.uid() OR ep.user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Check if user is host of event
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
    WHERE e.id = p_event_id
    AND (e.host_user_id = auth.uid() OR ep.role = 'host')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get user events with roles (for event selection)
CREATE OR REPLACE FUNCTION public.get_user_events()
RETURNS TABLE (
  event_id UUID,
  title TEXT,
  event_date DATE,
  location TEXT,
  user_role TEXT,
  rsvp_status TEXT,
  is_primary_host BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE
      WHEN e.host_user_id = auth.uid() THEN 'host'::TEXT
      ELSE COALESCE(ep.role, 'guest'::TEXT)
    END,
    ep.rsvp_status,
    (e.host_user_id = auth.uid())
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
  WHERE e.host_user_id = auth.uid() OR ep.user_id = auth.uid()
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📱 **SIMPLIFIED AUTHENTICATION FLOW**

### **Phase 1: Phone-Only Login**

```typescript
// Simplified login - ONLY phone number
const loginFlow = {
  step1: 'Enter phone number',
  step2: 'SMS OTP sent automatically',
  step3: 'Verify OTP',
  step4: 'Redirect to /select-event',
  step5: 'Choose event → role-based routing',
};
```

### **Phase 2: Development Bypass**

```typescript
// Simple dev phone patterns
const DEV_PHONES = {
  '+15550000001': { name: 'Test Host', role: 'host' },
  '+15550000002': { name: 'Test Guest', role: 'guest' },
  '+15550000003': { name: 'Test Admin', role: 'admin' },
};

// In dev mode: Skip SMS, auto-verify these numbers
const isDevelopment = process.env.NODE_ENV === 'development';
const isDevPhone = (phone) => phone.startsWith('+1555000000');
```

### **Phase 3: Clean Session Management**

```typescript
// Simplified auth watcher
const authFlow = {
  unauthenticated: '→ /login',
  authenticated_no_event: '→ /select-event',
  authenticated_with_event: '→ /host/[id] or /guest/[id]',
};
```

---

## 🛠️ **SIMPLIFIED DEVELOPER EXPERIENCE**

### **Easy Test User Creation**

```bash
# Simple commands
npm run create-test-users      # Creates basic test scenario
npm run dev-login-host        # Auto-login as host
npm run dev-login-guest       # Auto-login as guest
npm run cleanup-test-data     # Clean slate
```

### **Environment-Based Config**

```env
# .env.local
NODE_ENV=development
SKIP_SMS_IN_DEV=true
AUTO_VERIFY_DEV_PHONES=true
```

### **One-Command Setup**

```bash
npm run dev-setup  # Creates test event + users automatically
```

---

## 🚀 **MIGRATION PLAN**

### **Step 1: Schema Migration**

1. Create new simplified tables
2. Migrate essential data only
3. Drop complex tables
4. Update RLS policies

### **Step 2: Auth Simplification** ✅ COMPLETED

1. ✅ Update login flow to phone-only
2. ✅ Implement dev phone bypass
3. ✅ Simplify session management

### **Step 3: Application Code Refactor** ✅ COMPLETED

1. ✅ Update components to use `event_participants` instead of `event_guests`
2. ✅ Refactor components using complex tables (`MessageComposer`, `GuestManagement`, etc.)
3. ✅ Update API routes to use simplified schema
4. ✅ Remove references to `sub_events`, `scheduled_messages`, `communication_preferences`

#### **Components Refactored:**

- `MessageComposer.tsx` - Simplified to use basic messaging with `messages_new` and `event_participants`
- `GuestManagement.tsx` - Updated to use `event_participants` with simplified participant management
- `EventAnalytics.tsx` - Removed sub-events analytics, focus on basic event metrics
- `SubEventManagement.tsx` - **DELETED** (no longer needed)
- `WelcomeBanner.tsx` - Removed sub-events setup requirements
- `GuestImportWizard.tsx` - Updated to create `users_new` and `event_participants` records
- `RoleSwitcher.tsx` - Updated to use `event_participants` for role detection
- `BottomNavigation.tsx` - Simplified navigation with new schema
- `QuickActions.tsx` - Updated to use simplified metrics and removed complex functionality
- `Dashboard page` - Removed sub-events tab, updated to use simplified components

4. Update event selection page

### **Step 3: Dev Experience**

1. Create simplified test user scripts
2. Add one-command dev setup
3. Implement auto-login for development
4. Add cleanup utilities

### **Step 4: Code Cleanup**

1. Remove unused components
2. Simplify API routes
3. Update type definitions
4. Clean up documentation

---

## 📈 **BENEFITS SUMMARY**

### **Complexity Reduction**

- ✅ 55% fewer database tables
- ✅ 40% fewer columns to manage
- ✅ 62% fewer RLS functions
- ✅ Single authentication pattern
- ✅ Simplified test data creation

### **Developer Velocity**

- ✅ Faster local development setup
- ✅ Easier debugging with simplified schema
- ✅ No SMS dependency in development
- ✅ One-command test scenarios
- ✅ Cleaner codebase maintenance

### **Production Readiness**

- ✅ Secure phone-first authentication
- ✅ Proper RLS at database layer
- ✅ Scalable architecture foundation
- ✅ A2P 10DLC ready when approved
- ✅ Multi-event support maintained

---

## ⚠️ **MIGRATION RISKS & MITIGATION**

### **Data Loss Risk**

- 🔴 **Risk**: Complex messaging data loss
- 🟢 **Mitigation**: Export important messages before migration

### **Feature Regression Risk**

- 🔴 **Risk**: Sub-events, scheduled messages removed
- 🟢 **Mitigation**: Document removed features for future implementation

### **Authentication Risk**

- 🔴 **Risk**: Existing sessions may break
- 🟢 **Mitigation**: Plan maintenance window, notify users

---

## 📋 **IMPLEMENTATION PROGRESS TRACKING**

### **✅ STEP 1: CREATE MISSING BASE SCHEMA MIGRATION** (COMPLETED)

- [x] ✅ Created `20250101000000_initial_schema.sql` with core tables
- [x] ✅ Fixed migration dependency chain
- [x] ✅ Resolved function drop dependencies with CASCADE
- [x] ✅ Verified complete migration flow works (`supabase db reset` passes)
- [x] ✅ Generated updated TypeScript types
- [x] ✅ Confirmed simplified tables exist: `users_new`, `events_new`, `event_participants`, `messages_new`, `media_new`
- [x] ✅ Verified simplified RLS functions work: `can_access_event()`, `get_user_events()`

**Result:** Database foundation ready for simplification

### **✅ STEP 2: ACTIVATE SIMPLIFIED AUTHENTICATION FLOW** (COMPLETED)

- [x] ✅ Replace login page with phone-first simplified version
- [x] ✅ Replace event selection page with simplified version
- [x] ✅ Update AuthSessionWatcher for new flow (`users_new` table)
- [x] ✅ Test complete authentication journey
- [x] ✅ Verify dev phone bypass works (3 test users created)
- [x] ✅ Test role-based routing (login → select-event → host/guest routes)

**Result:** ✅ Users can now login with simplified phone-first flow and use dev phone bypass

### **✅ STEP 3: REFACTOR APPLICATION CODE** (COMPLETED)

- [x] ✅ Update components to use `event_participants` instead of `event_guests`
- [x] ✅ Refactor components using complex tables (`MessageComposer`, `GuestManagement`, etc.)
- [x] ✅ Update API routes to use simplified schema
- [x] ✅ Remove references to `sub_events`, `scheduled_messages`, `communication_preferences`

**Result:** ✅ All application components successfully refactored to use simplified schema

### **✅ STEP 4: CLEANUP & FINALIZATION** (COMPLETED)

- [x] ✅ Removed obsolete API routes (`process-scheduled/route.ts`)
- [x] ✅ Cleaned up old migration files (enhance_messaging_system, fix_user_profile_access, etc.)
- [x] ✅ Removed complex test data scripts (`comprehensive-test-data.sql`, `enhanced-seed-test-data.ts`)
- [x] ✅ Updated TypeScript types and schema reference files
- [x] ✅ Fixed package.json scripts to use simplified dev-setup
- [x] ✅ Application builds successfully with simplified schema
- [x] ✅ Removed SubEventManagement component references
- [x] ✅ Verified database migration chain works correctly

**Result:** ✅ Codebase fully cleaned up and simplified, ready for development with minimal complexity

---

_This audit provides a clear path to reduce technical debt while maintaining core functionality and improving developer experience._
