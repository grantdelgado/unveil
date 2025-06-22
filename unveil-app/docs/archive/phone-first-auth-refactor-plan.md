# Phone-First Authentication Refactoring Plan

## 🎯 **Overview**

This document outlines the comprehensive refactoring to simplify Unveil's authentication model:

1. **Phone-first authentication** - SMS OTP only, no email/password
2. **Per-event roles** - Users are simply users, roles assigned per event
3. **Simplified login flow** - Event selection → role-based routing
4. **Better dev experience** - Easy test user creation with dummy phones

---

## 📊 **New Schema Design**

### **Updated `users` Table**

```sql
CREATE TABLE public.users (
  id UUID DEFAULT auth.uid() NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Primary identity fields
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,

  -- Optional secondary fields (for completeness)
  email TEXT, -- Optional, for notifications only

  -- Remove global role column - roles are now per-event

  CONSTRAINT users_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);
```

### **Updated `event_guests` Table**

```sql
CREATE TABLE public.event_guests (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- NEW: Per-event role assignment
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest', 'admin')),

  -- Existing guest fields
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  guest_tags TEXT[],
  notes TEXT,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(event_id, user_id)
);
```

### **Updated RLS Helper Functions**

```sql
-- Enhanced function to check event host role
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
    WHERE e.id = p_event_id
    AND (e.host_user_id = auth.uid() OR eg.role = 'host')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to check event guest access
CREATE OR REPLACE FUNCTION public.is_event_participant(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
    WHERE e.id = p_event_id
    AND (e.host_user_id = auth.uid() OR eg.user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role for specific event
CREATE OR REPLACE FUNCTION public.get_user_event_role(p_event_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Check if user is the primary host
  IF EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND host_user_id = auth.uid()
  ) THEN
    RETURN 'host';
  END IF;

  -- Check role from event_guests table
  RETURN (
    SELECT eg.role FROM public.event_guests eg
    WHERE eg.event_id = p_event_id AND eg.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔐 **Updated RLS Policies**

### **Users Table Policies**

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

-- Event participants can view each other's profiles
CREATE POLICY "Event participants can view related profiles"
ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg1 ON eg1.event_id = e.id AND eg1.user_id = auth.uid()
    LEFT JOIN public.event_guests eg2 ON eg2.event_id = e.id AND eg2.user_id = users.id
    WHERE (e.host_user_id = auth.uid() OR eg1.user_id = auth.uid())
    AND (e.host_user_id = users.id OR eg2.user_id = users.id)
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
```

### **Events Table Policies**

```sql
-- Users can view events they participate in
CREATE POLICY "Users can view events they participate in"
ON public.events FOR SELECT TO authenticated
USING (
  is_public = true OR
  host_user_id = auth.uid() OR
  is_event_participant(id)
);

-- Event hosts can manage their events
CREATE POLICY "Event hosts can manage their events"
ON public.events FOR ALL TO authenticated
USING (is_event_host(id))
WITH CHECK (is_event_host(id));
```

---

## 🔄 **Authentication Flow Changes**

### **1. Login Flow Simplification**

```typescript
// New login flow:
// 1. Enter phone number
// 2. Receive SMS OTP
// 3. Verify OTP → authenticated
// 4. Redirect to /select-event
// 5. Choose event → determine role → route to /host/[eventId] or /guest/[eventId]
```

### **2. Event Selection Page** _(New)_

```typescript
// app/select-event/page.tsx
// - Show all events user participates in
// - Display user's role for each event
// - Navigate based on role selection
```

### **3. Role-Based Routing**

```typescript
// Updated routing logic:
const determineUserRole = async (eventId: string) => {
  const { data, error } = await supabase.rpc('get_user_event_role', {
    p_event_id: eventId,
  });
  return data; // 'host' | 'guest' | null
};

// Route based on role:
// host → /host/[eventId]/dashboard
// guest → /guest/[eventId]/home
```

---

## 🛠 **Development Experience Improvements**

### **1. Phone-First Test Users**

```typescript
// Updated test user creation with dummy phones
const DEV_PHONE_PATTERNS = {
  host: '+1555000100X', // X = incrementing number
  guest: '+1555000200X',
  admin: '+1555000300X',
};

// Bypass SMS in development mode
if (process.env.NODE_ENV === 'development' && phone.startsWith('+1555000')) {
  // Skip SMS, auto-verify
  return { success: true, bypassSMS: true };
}
```

### **2. Enhanced Test User Manager**

```typescript
// Support for per-event role assignments
await createTestUser({
  phone: '+15550001001',
  name: 'Sarah Host',
  events: [
    { eventId: 'event-1', role: 'host' },
    { eventId: 'event-2', role: 'guest' },
  ],
});
```

---

## 📝 **Implementation Steps**

### **Phase 1: Schema Migration**

1. Create migration for phone-first schema
2. Update user table structure
3. Enhance event_guests with role column
4. Update RLS functions and policies

### **Phase 2: Authentication Refactor**

1. Update login page for phone-only flow
2. Modify AuthSessionWatcher routing
3. Create event selection page
4. Update role determination logic

### **Phase 3: Role-Based Access**

1. Update all host/guest route access checks
2. Modify RLS policies for per-event roles
3. Update UI components for role display
4. Test role transitions

### **Phase 4: Development Tools**

1. Refactor test user management
2. Update dev personas for phone auth
3. Enhance admin API for test users
4. Update documentation

### **Phase 5: Testing & Validation**

1. Update RLS test suite
2. Test authentication flows
3. Validate role-based access
4. Performance testing

---

## 🔍 **Key Benefits**

1. **Simplified UX**: Single phone number entry, no passwords
2. **Flexible Roles**: Users can be hosts and guests for different events
3. **Better Security**: Phone-based identity with SMS verification
4. **Easier Development**: Dummy phone numbers bypass SMS in dev
5. **Cleaner Architecture**: Remove global role concepts
6. **Scalable**: Easy to add new event types and role variations

---

## ⚠️ **Considerations**

1. **SMS Costs**: Monitor SMS usage in production
2. **International Support**: Handle international phone formats
3. **Fallback Auth**: Consider backup authentication methods
4. **Rate Limiting**: Implement SMS rate limiting
5. **Phone Verification**: Handle phone number changes
6. **Data Migration**: Plan for existing user migration

---

## 🧪 **Testing Strategy**

1. **Unit Tests**: Role determination functions
2. **Integration Tests**: Authentication flows
3. **E2E Tests**: Complete user journeys
4. **Security Tests**: RLS policy validation
5. **Performance Tests**: Query optimization
6. **Manual Tests**: Cross-device SMS verification
