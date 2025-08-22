# 🧭 Complete Mental Model: Event Creation in Unveil

A comprehensive guide to understanding how event creation works in the Unveil app, from UI interaction to database consistency.

## Table of Contents

- [Overview](#overview)
- [1. Event Creation Logic](#-1-event-creation-logic)
- [2. Guest Requirements](#-2-guest-requirements)
- [3. Adding Guests After Creation](#-3-adding-guests-after-creation)
- [4. Security & Ownership](#-4-security--ownership)
- [5. Real-Time Validation & Rollback](#-5-real-time-validation--rollback)
- [Complete Flow Summary](#-complete-flow-summary)
- [Key Files Reference](#-key-files-reference)

---

## Overview

The Unveil event creation system uses a sophisticated **two-path atomic approach** with comprehensive rollback mechanisms to ensure data consistency. Events are always created with the host automatically added as a guest, and additional guests can be added later through a robust import system.

---

## 🧱 1. Event Creation Logic

### The Journey Starts: User Clicks "Create Wedding Hub"

**📍 Entry Point:** `components/features/events/CreateEventWizard.tsx` (lines 187-190)

When you click submit, here's **exactly** what happens:

```typescript
// 1. Wizard packages your form data
const eventInput: EventCreationInput = {
  title: formData.title,
  event_date: formData.event_date,
  location: formData.location || undefined,
  description: formData.description || undefined,
  is_public: formData.is_public,
  header_image: headerImage || undefined,
};

// 2. Calls the centralized service
const result = await EventCreationService.createEventWithHost(
  eventInput,
  session.user.id,
);
```

### The Service Layer: Where The Magic Happens

**📍 Main Logic:** `lib/services/eventCreation.ts` - `createEventWithHost()` method

The service follows a **3-step process**:

#### Step 1: Authentication Validation

```typescript
// Validates that the user session is still valid
const sessionValidation = await this.validateUserSession(userId);
```

#### Step 2: Image Upload (if provided)

```typescript
// Uploads header image to Supabase Storage
if (input.header_image) {
  const imageResult = await this.uploadEventImage(input.header_image, userId);
  headerImageUrl = imageResult.url; // e.g., "user123/1754099505262.jpg"
}
```

#### Step 3: Atomic Event + Host Creation

```typescript
// This is where the database magic happens!
const creationResult = await this.createEventAtomic(
  input,
  userId,
  headerImageUrl,
);
```

### Database Operations: The Two-Path Strategy

**📍 Atomic Logic:** `lib/services/eventCreation.ts` - `createEventAtomic()` method (lines 251-264)

The system uses a **smart fallback approach**:

#### 🚀 Path 1: True Database Atomicity (Preferred)

```sql
-- Calls our PostgreSQL function
SELECT * FROM create_event_with_host_atomic({
  "title": "Providence & Grant's Wedding",
  "event_date": "2024-12-25",
  "host_user_id": "39144252-24fc-44f2-8889-ac473208910f",
  -- ... other fields
});
```

**What this single function does:**

1. **Creates 1 record in `events` table** with all your event details
2. **Fetches your phone number** from `users` table (`+13109474467`)
3. **Creates 1 record in `event_guests` table** with you as the host
4. **Does it ALL in a single database transaction** (true atomicity!)

#### 🔄 Path 2: Client-Side Simulation (Fallback)

If the database function fails, it falls back to:

```typescript
// Step 1: Insert into events table
const { data: newEvent } = await supabase
  .from('events')
  .insert(eventData)
  .select('id, title, host_user_id, created_at')
  .single();

// Step 2: Insert host into event_guests table
const hostProfile = await this.getHostProfile(userId);
const hostGuestResult = await this.createHostGuestEntry(
  newEvent.id,
  userId,
  hostProfile,
);

// Step 3: If anything fails, rollback everything
if (!hostGuestResult.success) {
  await this.rollbackEventCreation(newEvent.id); // Deletes the event
}
```

---

## 👥 2. Guest Requirements

### Are Guests Required During Creation? NO

**📍 Evidence:** `components/features/events/GuestImportStep.tsx` (line 30)

```typescript
eventId = { undefined }; // No import during wizard - guests added after creation
```

**Here's what happens:**

- **✅ Event Creation**: Always succeeds regardless of guest step
- **✅ Host Auto-Addition**: You (the host) are automatically added to `event_guests` table
- **✅ Skip Guest Step**: Perfectly valid - creates event with just you as the host

### System Behavior When Skipping Guests

1. **Event Record Created**: ✅ Full event in `events` table
2. **Host Guest Record**: ✅ You're added to `event_guests` with `role='host'`
3. **Next Steps**: You're redirected to `/host/events/{eventId}/dashboard`
4. **Guest Count**: Shows "0 guests" until you add them later

---

## ➕ 3. Adding Guests After Creation

### Post-Creation Guest Management

**📍 Main Hook:** `hooks/useGuests.ts` - Handles all guest operations  
**📍 Import UI:** `components/features/guests/GuestImportWizard.tsx`  
**📍 Service Logic:** `lib/services/eventCreation.ts` - `importGuests()` method

### How It Works

#### Route Access

- From event dashboard: `/host/events/{eventId}/dashboard`
- Guest management section or "Add Guests" button
- Opens `GuestImportWizard` component

#### Import Process

```typescript
// 1. Uses the same EventCreationService for consistency
const result = await EventCreationService.importGuests(eventId, guests, userId);

// 2. Validates permissions (only event host can add guests)
await this.validateGuestImportPermission(eventId, userId);

// 3. Batch inserts to event_guests table (100 guests per batch)
const { data, error } = await supabase
  .from('event_guests')
  .insert(guestInserts)
  .select('id');
```

### Database Constraints to Know

1. **Unique Phone Per Event**: `UNIQUE (event_id, phone)` - prevents duplicate guests
2. **Phone Format**: Must match `^\\+[1-9]\\d{1,14}$` (E.164 format)
3. **Role Validation**: `CHECK (role IN ('guest', 'host', 'admin'))`
4. **Tag Limits**: Maximum 10 tags per guest
5. **Required Fields**: `event_id`, `phone`, `role` are mandatory

---

## 🔒 4. Security & Ownership

### RLS Policy Enforcement

**📍 Database Policies:** Applied automatically on every operation

#### For `events` Table

```sql
-- events_unified_access policy
((host_user_id = auth.uid()) OR (is_event_guest(id) AND can_access_event(id)))
```

**Translation:** You can only access events if:

- You're the host (`host_user_id = your_user_id`), OR
- You're a guest of that event AND the event allows access

#### For `event_guests` Table

```sql
-- event_guests_host_management policy
is_event_host(event_id)

-- event_guests_self_access policy
(user_id = auth.uid())
```

**Translation:** You can manage guests if:

- You're the host of that event, OR
- You're managing your own guest record

### How Security Works During Creation

1. **Event Insert**: ✅ Allowed because `host_user_id = auth.uid()`
2. **Host Guest Insert**: ✅ Allowed because you're inserting yourself as host
3. **Future Guest Imports**: ✅ Checked via `validateGuestImportPermission()`:

   ```typescript
   // Validates you're the host before allowing guest imports
   const { data: hostCheck } = await supabase
     .from('events')
     .select('host_user_id')
     .eq('id', eventId)
     .eq('host_user_id', userId)
     .single();
   ```

---

## 🧪 5. Real-Time Validation & Rollback

### Atomicity: Database vs Client-Side

#### 🚀 Database Atomicity (create_event_with_host_atomic)

- **✅ True ACID Transaction**: Everything succeeds or nothing does
- **✅ No Partial States**: Impossible to have an event without a host
- **✅ Automatic Rollback**: Database handles it natively

#### 🔄 Client-Side Simulation

- **⚠️ Potential Race Conditions**: Brief moment where event exists without host
- **✅ Explicit Rollback**: Code manually deletes event if host creation fails
- **✅ Image Cleanup**: Removes uploaded images on failure

### Rollback Mechanisms

**📍 Implementation:** `lib/services/eventCreation.ts` - `rollbackEventCreation()` (lines 465-476)

```typescript
// If host guest creation fails:
if (!hostGuestResult.success) {
  // 1. Delete the event record
  await this.rollbackEventCreation(newEvent.id);

  // 2. Clean up uploaded image
  if (headerImageUrl) {
    await this.cleanupImage(headerImageUrl);
  }

  // 3. Return user-friendly error
  return {
    success: false,
    error: {
      message: 'Failed to create host guest entry. Event creation rolled back.',
    },
  };
}
```

### Error Recovery

The system logs everything for debugging:

```typescript
logger.info('🔧 Event creation rolled back successfully', { eventId });
logger.info('🔧 Cleaned up uploaded image', { filePath });
```

---

## 🎯 Complete Flow Summary

### When You Click "Create Wedding Hub"

1. **🔐 Authentication Check** → Validates session
2. **📸 Image Upload** → Stores in Supabase Storage (optional)
3. **🚀 Database Transaction** → Creates event + adds you as host
4. **✅ Success Redirect** → Takes you to `/host/events/{eventId}/dashboard`

### Database State After Creation

```sql
-- events table: 1 new record
INSERT INTO events (title, event_date, host_user_id, ...)
VALUES ('Your Wedding', '2024-12-25', 'your-user-id', ...);

-- event_guests table: 1 new record (you as host)
INSERT INTO event_guests (event_id, user_id, phone, role, rsvp_status)
VALUES ('new-event-id', 'your-user-id', '+13109474467', 'host', 'attending');
```

### Future Guest Operations

- **Add Guests**: Via dashboard → `EventCreationService.importGuests()`
- **Manage Guests**: Via `useGuests()` hook → Direct table operations
- **Security**: All protected by RLS policies checking host status

---

## 🧭 Key Files Reference

| Component             | Purpose                  | File Path                                               |
| --------------------- | ------------------------ | ------------------------------------------------------- |
| **UI Flow**           | Event creation wizard    | `components/features/events/CreateEventWizard.tsx`      |
| **Business Logic**    | Event + guest operations | `lib/services/eventCreation.ts`                         |
| **Database Function** | Atomic transactions      | `create_event_with_host_atomic()`                       |
| **Guest Management**  | Post-creation operations | `hooks/useGuests.ts`                                    |
| **Import UI**         | CSV/manual guest entry   | `components/features/guests/GuestImportWizard.tsx`      |
| **Security**          | RLS policies             | `event_guests_host_management`, `events_unified_access` |

---

## 🔧 Debugging Tips

### Common Issues

1. **400 Bad Request on guest creation**: Check phone number format (must be E.164: `+1234567890`)
2. **RPC function not available**: Falls back to client-side simulation automatically
3. **Permission denied**: Verify user is authenticated and is the event host
4. **Partial creation states**: Check logs for rollback operations

### Key Log Messages

```typescript
'🔧 Starting event creation'; // Operation begins
'🔧 RPC method not available'; // Fallback triggered
'🔧 Event creation rolled back successfully'; // Cleanup completed
'🔧 Event creation completed successfully'; // Full success
```

### Database Inspection

```sql
-- Check event creation
SELECT * FROM events WHERE host_user_id = 'your-user-id';

-- Check host guest entry
SELECT * FROM event_guests WHERE user_id = 'your-user-id' AND role = 'host';

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('events', 'event_guests');
```

---

_This guide provides a complete mental model for understanding, debugging, and extending the event creation system in Unveil._
