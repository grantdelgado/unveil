# Wedding Hub "Publish Now" Toggle Investigation

**Date:** October 16, 2025  
**Status:** ✅ Complete  
**Investigator:** AI Assistant  

---

## Executive Summary

The **"Publish your wedding hub now?"** checkbox in Step 1 of event creation is a **critical visibility toggle** that controls whether invited guests can see and access the event after signing in. This investigation reveals that the toggle is **necessary and actively used** throughout the system.

### Key Finding
**The toggle is NOT redundant.** It serves as a master visibility switch with significant downstream impact on:
- Guest event discovery (RLS policies)
- Event listing visibility (application queries)
- Guest auto-join logic (implicit behavior)

---

## Component Investigation

### 1. UI Component Location

**File:** `components/features/events/EventBasicsStep.tsx`  
**Lines:** 146-173

```tsx
{/* Privacy Setting */}
<div className="bg-gray-50 rounded-lg p-4">
  <div className="flex items-start space-x-3">
    <input
      type="checkbox"
      id="is_public"
      checked={formData.is_public}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onUpdate('is_public', e.target.checked)
      }
      className="h-5 w-5 text-pink-500 focus:ring-pink-300 border-gray-300 rounded mt-0.5"
      disabled={disabled}
    />
    <div className="space-y-1">
      <label
        htmlFor="is_public"
        className="text-base font-medium text-gray-700"
      >
        Publish your wedding hub now?
      </label>
      <MicroCopy>
        Guests will be able to see your wedding hub as soon as they log in
        with their invited phone number. You can also choose to add guests
        before publishing.
      </MicroCopy>
    </div>
  </div>
</div>
```

**Field Mapping:**
- UI Label: "Publish your wedding hub now?"
- Database Column: `events.is_public` (BOOLEAN)
- Default Value: `true` (checked by default in `CreateEventWizard.tsx:43`)

---

## Database Schema

### `events` Table Structure

```sql
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  header_image_url TEXT,
  is_public BOOLEAN DEFAULT false,  -- ⚠️ Visibility Toggle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Source:** `supabase/migrations/20250616044000_recreate_core_schema.sql:7-18`

### Sample Production Data

Query executed on production database:

```sql
SELECT id, title, is_public, created_at 
FROM events 
ORDER BY created_at DESC 
LIMIT 3;
```

**Results:**
- All 3 recent events have `is_public = true`
- Events: "Nick and Kate's Wedding", "David Banner's Wedding", "Providence & Grant"

---

## Event Creation Flow

### `CreateEventWizard.tsx`

```tsx
const [formData, setFormData] = useState<EventFormData>({
  title: '',
  event_date: '',
  event_time: '15:00',
  location: '',
  is_public: true,  // ✅ Default: Published
  sms_tag: '',
});
```

**Line:** 38-45

### `EventCreationService.createEventWithHost()`

The `is_public` flag is passed directly to both:

1. **RPC Function** (`create_event_with_host_atomic`):
   ```typescript
   const eventData = {
     title: input.title.trim(),
     event_date: input.event_date,
     location: input.location?.trim() || null,
     header_image_url: headerImageUrl,
     host_user_id: userId,
     is_public: input.is_public,  // ⚠️ Passed to database
     creation_key: creationKey,
     sms_tag: input.sms_tag.trim(),
   };
   ```
   **Line:** `lib/services/eventCreation.ts:310-319`

2. **Direct Insert** (fallback if RPC unavailable):
   ```typescript
   const eventData: EventInsert = {
     title: input.title.trim(),
     event_date: input.event_date,
     location: input.location?.trim() || null,
     header_image_url: headerImageUrl,
     host_user_id: userId,
     is_public: input.is_public,  // ⚠️ Stored in DB
     sms_tag: input.sms_tag.trim(),
   };
   ```
   **Line:** `lib/services/eventCreation.ts:396-404`

---

## Downstream Impact Analysis

### 🔒 RLS Policies (Database Level)

#### Policy: `events_select_accessible`

```sql
CREATE POLICY "events_select_accessible" ON public.events 
  FOR SELECT 
  TO authenticated 
  USING (is_public = true OR can_access_event(id));
```

**File:** `supabase/migrations/20250616045000_fix_events_rls_policies.sql:19-22`

**Impact:**
- If `is_public = false`, guests **cannot** see the event via RLS unless they already have access via `can_access_event(id)`
- This is the **first line of defense** for event visibility

#### Optimized Policy Version

```sql
CREATE POLICY "events_select_optimized" ON public.events
FOR SELECT TO authenticated
USING (
  (is_public = true) 
  OR 
  can_access_event(id)
  OR
  (host_user_id = (SELECT auth.uid()))
);
```

**File:** `supabase/migrations/20250129000002_optimize_rls_policies.sql:172-180`

---

### 📱 Guest Event Queries (Application Level)

#### Hook: `useGuestEvents`

**File:** `hooks/events/useGuestEvents.ts`

```typescript
// Fetch guest events - only show events with visibility enabled (is_public=true)
const { data: guestData, error: guestError } = await supabase
  .from('event_guests')
  .select(
    `
    *,
    events:events(*)
  `,
  )
  .eq('user_id', userId)
  .eq('events.is_public', true); // ⚠️ Only show visible events
```

**Lines:** 33-43

**Comment on Line 33:** *"Fetch guest events - only show events with visibility enabled (is_public=true)"*

**Impact:**
- Guests **cannot** see events with `is_public = false` in their event list
- Even if they have an `event_guests` record, the application filters unpublished events

---

### 🔗 Guest Auto-Join Service

#### Function: `getVisibleEventsForUser`

**File:** `lib/services/guestAutoJoin.ts`

```typescript
/**
 * Get events that should be visible to a user based on their phone/user_id
 * This respects the is_public setting (visibility toggle)
 */
export async function getVisibleEventsForUser(
  userId: string,
): Promise<{ success: boolean; events: Event[]; error?: string }> {
  try {
    // Get events where:
    // 1. User is linked as a guest (user_id match)
    // 2. User's phone matches AND event is_public=true (visible)
    const { data: visibleEvents, error } = await supabase
      .from('event_guests')
      .select(
        `
        event_id,
        events!inner (
          id,
          title,
          event_date,
          location,
          is_public,
          allow_open_signup
        )
      `,
      )
      .eq('user_id', userId)
      .eq('events.is_public', true); // ⚠️ Only show events with visibility enabled
```

**Lines:** 363-389

**Comment on Line 364:** *"This respects the is_public setting (visibility toggle)"*

**Impact:**
- Auto-join logic respects the publish toggle
- Guests are only shown events they can actually access

---

### 📝 Event Editing (Host View)

#### Component: `EventDetailsEditor`

**File:** `components/features/host-dashboard/EventDetailsEditor.tsx`

The toggle appears in the host's event editing interface as:

```tsx
<label
  htmlFor="is_public"
  className="text-base font-medium text-gray-700"
>
  Show event to invited guests
</label>
<MicroCopy>
  Invited guests who sign in with their phone number can find
  this event and will be added automatically.
</MicroCopy>
```

**Lines:** 431-440

**Label Variation:** "Show event to invited guests" (different from creation flow)

---

## Technical Behavior Summary

### What Happens When `is_public = true` (Published)?

1. ✅ **RLS allows SELECT**: Guests can query the event via database policies
2. ✅ **Application shows event**: `useGuestEvents` includes the event in the guest's list
3. ✅ **Auto-join works**: `getVisibleEventsForUser` returns the event
4. ✅ **Guest dashboard displays**: Event appears in `/guest/events/[eventId]` routes

### What Happens When `is_public = false` (Unpublished)?

1. ❌ **RLS blocks SELECT**: Unless `can_access_event(id)` is true via other means
2. ❌ **Application hides event**: `useGuestEvents` filters out the event
3. ❌ **Auto-join excludes**: Event won't appear in visible events list
4. ❌ **Guest dashboard inaccessible**: Guest cannot navigate to event pages

---

## SMS Delivery Impact

### Finding: **SMS delivery is NOT affected by `is_public`**

The toggle does **not** prevent hosts from:
- Adding guests to the event (`add_or_restore_guest` RPC)
- Sending invitations via SMS (`sendGuestInviteCore`)
- Sending announcements or messages

**Rationale:**
- The `is_public` flag controls **visibility**, not **communication**
- Hosts can prepare guest lists and send invitations before making the event visible
- This supports the "add guests before publishing" workflow mentioned in the UI copy

---

## UX Flow Analysis

### Intended Workflow

1. **Create Event** → Host fills in details (Step 1)
2. **Publish Toggle** → Host decides:
   - ✅ **Checked (default):** Guests see event immediately when they log in
   - ❌ **Unchecked:** Host can add guests first, then publish later
3. **Add Guests** → Host imports/adds guest list (Step 2/3 or post-creation)
4. **Send Invitations** → Host sends SMS invites (optional, independent of `is_public`)
5. **Guest Login** → Guests sign in with phone number
6. **Auto-Join** → If `is_public = true`, guest sees event in their dashboard

### Edge Cases

#### Scenario: Host unchecks "Publish now" but sends invitations

**Result:**
- Guests receive SMS invitations
- Guests can sign in
- **Guests cannot see the event** (because `is_public = false`)
- Guests must wait for host to toggle `is_public = true` in event settings

**Verdict:** This is **confusing UX** but matches the technical implementation

---

## Recommendations

### ✅ Keep the Toggle (Do Not Remove)

**Reasoning:**
1. **Multi-layer enforcement**: Both RLS and application code rely on it
2. **Privacy control**: Hosts need ability to hide incomplete events
3. **Workflow flexibility**: Supports "prepare then publish" pattern
4. **No redundancy**: No other mechanism provides this visibility control

### 🔧 Improve UX Clarity

#### 1. **Rename the Toggle** (Minor)

Current label is slightly misleading. Suggestion:

```diff
- Publish your wedding hub now?
+ Make your wedding hub visible to invited guests?
```

**Rationale:** The word "publish" implies permanence, but this is a reversible toggle

#### 2. **Add Warning for Unpublished Events with Invitations** (Medium)

If host:
- Creates event with `is_public = false`
- Adds guests
- Sends invitations

Show warning:
> ⚠️ **Note:** Invited guests won't be able to see this event until you make it visible. You can update this in Event Settings.

#### 3. **Align Label Consistency** (Low Priority)

**Current inconsistency:**
- **Event Creation:** "Publish your wedding hub now?"
- **Event Editing:** "Show event to invited guests"

**Recommendation:** Use the same label in both places for consistency

#### 4. **Add Visual Indicator** (Low Priority)

In host dashboard, show a badge for unpublished events:
```
🔒 Hidden from guests
```

---

## Testing Checklist

### Manual Test Scenarios

- [x] **Create event with `is_public = true`**
  - Verify guest can see event after login
  - Verify event appears in guest event list

- [ ] **Create event with `is_public = false`**
  - Verify guest **cannot** see event after login
  - Verify event does **not** appear in guest event list
  - Verify guest can still receive SMS invitations

- [ ] **Toggle `is_public` on existing event**
  - Create event as unpublished
  - Add guests
  - Verify guests don't see event
  - Toggle to published
  - Verify guests now see event

- [ ] **Edge case: Unpublished event with invitations**
  - Create unpublished event
  - Add guests
  - Send SMS invitations
  - Verify guests receive SMS
  - Verify guests cannot access event
  - Verify no error messages shown to guest

### Automated Test Scenarios

```typescript
describe('is_public event visibility', () => {
  it('should hide unpublished events from guest queries', async () => {
    // Create event with is_public = false
    // Add guest to event
    // Query as guest
    // Assert event is not in results
  });

  it('should show published events to invited guests', async () => {
    // Create event with is_public = true
    // Add guest to event
    // Query as guest
    // Assert event appears in results
  });

  it('should respect RLS policies for unpublished events', async () => {
    // Create event with is_public = false
    // Attempt direct query as guest
    // Assert RLS blocks access
  });
});
```

---

## Related Files

### Components
- `components/features/events/EventBasicsStep.tsx` (Toggle UI)
- `components/features/events/CreateEventWizard.tsx` (Default value)
- `components/features/host-dashboard/EventDetailsEditor.tsx` (Edit UI)

### Services
- `lib/services/eventCreation.ts` (Event creation logic)
- `lib/services/guestAutoJoin.ts` (Visibility filtering)

### Hooks
- `hooks/events/useGuestEvents.ts` (Guest event queries)
- `hooks/events/useEventWithGuest.ts` (Single event access)

### Database
- `supabase/migrations/20250616044000_recreate_core_schema.sql` (Schema)
- `supabase/migrations/20250616045000_fix_events_rls_policies.sql` (RLS)
- `supabase/migrations/20250129000002_optimize_rls_policies.sql` (Optimized RLS)

---

## Conclusion

The **"Publish your wedding hub now?"** toggle is a **critical feature** that controls event visibility across multiple layers:

1. **Database RLS policies** block unauthorized SELECT queries
2. **Application queries** explicitly filter by `is_public`
3. **Guest auto-join logic** respects the visibility setting

**Verdict:** ✅ **Keep the toggle as-is** with minor UX improvements recommended above.

**No action required** for immediate deployment, but consider UX enhancements for future releases.

---

**Investigation completed:** October 16, 2025  
**Next steps:** Review recommendations with product team

