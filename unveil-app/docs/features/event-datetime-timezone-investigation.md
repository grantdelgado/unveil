# Event Date, Time, and Timezone Investigation

**Date:** October 16, 2025  
**Status:** ✅ Complete  
**Priority:** 🔴 Critical - Data Loss Issue Identified

---

## Executive Summary

**CRITICAL ISSUE FOUND:** The event creation flow collects `event_time` (e.g., "17:00") from users but **NEVER stores it** in the database. This causes:
- ❌ **Time data loss** - User enters 5:00 PM, but only the date is saved
- ❌ **Inconsistent UX** - Edit page tries to extract time from DATE column (always shows midnight)
- ❌ **Timezone confusion** - Creation flow doesn't capture timezone, edit page does
- ❌ **Scheduled message issues** - Can't accurately schedule based on event time

### Recommendation

**🚨 URGENT: Add missing `start_time` TIMESTAMPTZ column to events table**

This requires a database migration to properly store event datetime with timezone.

---

## Current State Analysis

### Database Schema

**`events` Table Columns (Related to Timing):**

| Column | Type | Nullable | Current Usage |
|--------|------|----------|---------------|
| `event_date` | **DATE** | NO | ✅ Stores date only (e.g., `2025-10-18`) |
| `time_zone` | TEXT | YES | ⚠️ Sometimes null, sometimes set |
| **NO `event_time` column** | - | - | ❌ **TIME IS LOST** |
| **NO `start_time` column** | - | - | ❌ **DATETIME NOT STORED** |

**Production Data Sample:**

```sql
SELECT id, title, event_date, time_zone
FROM events
ORDER BY created_at DESC
LIMIT 4;
```

| Event | event_date | time_zone |
|-------|------------|-----------|
| Montana Test | `2025-10-18` | `null` |
| Nick and Kate's Wedding | `2026-01-03` | `Pacific/Auckland` |
| David Banner's Wedding | `2025-08-27` | `America/Chicago` |
| Providence & Grant | `2025-08-31` | `America/Denver` |

**Observations:**
- ✅ All events have `event_date` (required)
- ⚠️ 25% have `time_zone = null` (newly created events)
- ❌ **NO TIME stored anywhere** (all times lost!)

---

## Event Creation Flow Analysis

### `CreateEventWizard.tsx`

**Form State:**
```typescript
const [formData, setFormData] = useState<EventFormData>({
  title: '',
  event_date: '',
  event_time: '15:00',  // ⚠️ DEFAULT: 3:00 PM
  location: '',
  is_public: true,
  sms_tag: '',
});
```

**What Gets Stored:**
```typescript
const eventInput: EventCreationInput = {
  title: formData.title,
  event_date: formData.event_date,  // ✅ Stored
  location: formData.location || undefined,
  is_public: formData.is_public,
  creation_key: creationKeyRef.current,
  sms_tag: formData.sms_tag.trim(),
  // ❌ event_time is NEVER passed to the service!
  // ❌ time_zone is NEVER collected or passed!
};
```

**EventCreationInput Interface:**
```typescript
export interface EventCreationInput {
  title: string;
  event_date: string;  // Just the date string (e.g., '2025-10-18')
  location?: string;
  is_public: boolean;
  header_image?: File;
  creation_key?: string;
  sms_tag: string;
  // ❌ NO event_time field
  // ❌ NO time_zone field
}
```

**What Actually Inserts:**
```typescript
const eventData = {
  title: input.title.trim(),
  event_date: input.event_date,  // Just '2025-10-18'
  location: input.location?.trim() || null,
  header_image_url: headerImageUrl,
  host_user_id: userId,
  is_public: input.is_public,
  creation_key: creationKey,
  sms_tag: input.sms_tag.trim(),
  // ❌ time_zone: NOT included
};
```

### EventBasicsStep.tsx - UI Captures Time

```tsx
{/* Event Time */}
<TextInput
  type="time"
  id="event_time"
  value={formData.event_time}  // ✅ User enters time (e.g., "17:00")
  onChange={(e) => onUpdate('event_time', e.target.value)}
  className="text-[16px] min-h-[44px]"
/>
```

**Problem:** User enters time, but it's **never sent to the database!**

---

## Event Edit Flow Analysis

### `/host/events/[eventId]/edit/page.tsx`

**Loading Event Data:**
```typescript
// Parse event_date into date and time components
const eventDateTime = new Date(eventData.event_date);
const dateStr = eventDateTime.toISOString().split('T')[0];
const timeStr = eventDateTime.toTimeString().slice(0, 5);

setFormData({
  title: eventData.title,
  event_date: dateStr,  // e.g., '2025-10-18'
  event_time: timeStr,  // ⚠️ Always '00:00' because event_date is DATE type!
  location: eventData.location || '',
  description: eventData.description || '',
  is_public: eventData.is_public ?? true,
});
```

**Problem:** Since `event_date` is a DATE column, `new Date(eventData.event_date)` creates a date at **midnight UTC**. The extracted `timeStr` is always `00:00`.

**Saving Event Data:**
```typescript
// Combine date and time
const eventDateTime = `${formData.event_date}T${formData.event_time}:00`;
// e.g., '2025-10-18T17:00:00'

const eventData: EventUpdate = {
  title: formData.title.trim(),
  event_date: eventDateTime,  // ⚠️ Trying to store TIMESTAMP in DATE column!
  location: formData.location.trim() || null,
  description: formData.description.trim() || null,
  header_image_url: headerImageUrl,
  is_public: formData.is_public,
};
```

**Problem:** PostgreSQL will **truncate** `'2025-10-18T17:00:00'` to just `'2025-10-18'` when inserting into a DATE column. **Time is lost!**

---

## Critical Gaps Identified

### 1. ❌ **Time Data Loss**

**Issue:** Event time is collected but never stored

**User Impact:**
- User enters "5:00 PM" during creation
- Database only stores date
- When user edits event, time shows as "12:00 AM" (midnight)
- User must re-enter time every edit

**Affected Users:**
- ✅ 100% of events created via wizard (all lose time)
- ✅ 0 events correctly store time

---

### 2. ❌ **Timezone Mismatch**

**Issue:** Creation flow doesn't collect timezone, edit flow does

**Current State:**
- **Creation:** No timezone field → `time_zone` stored as `NULL`
- **Edit:** Timezone dropdown available → Can set timezone post-creation
- **Result:** 25% of events have `time_zone = null`

**User Impact:**
- Scheduled messages fall back to UTC (confusing for users)
- Schedule items show "Times in your local timezone" warning
- No clarity about when events actually happen

---

### 3. ❌ **Schema Type Mismatch**

**Issue:** `event_date` is DATE type, but code tries to store TIMESTAMP

**Technical Problem:**
```sql
-- Schema definition
event_date DATE NOT NULL

-- What edit page tries to insert
event_date = '2025-10-18T17:00:00'  -- ❌ Truncated to '2025-10-18'
```

**PostgreSQL Behavior:**
- Silently truncates time component
- No error thrown
- Data loss is invisible to users

---

### 4. ⚠️ **Scheduled Messages Fallback**

**Issue:** Messages can't accurately schedule without event time

**Current Workaround:**
- Schedule items store `start_at` as TIMESTAMPTZ (correct)
- Convert between UTC and event timezone using `time_zone`
- **But** main event time is unknown (only date)

**Impact on Scheduling:**
- Can't send "1 hour before ceremony" messages
- Can't send "morning of wedding" messages at correct local time
- Must rely on manual schedule item creation

---

## Detailed Analysis

### What Works

✅ **Schedule Items System:**
- `event_schedule_items` table has `start_at TIMESTAMPTZ`
- Properly stores UTC timestamps
- Converts to/from event timezone for display
- Uses `toUTCFromEventZone()` and `fromUTCToEventZone()` utilities

✅ **Timezone Utilities:**
- `lib/utils/timezone.ts` has proper conversion functions
- `getTimezoneLabel()` displays friendly names
- Handles null timezone gracefully (falls back to UTC)

✅ **Edit Page UI:**
- Has date picker ✅
- Has time picker ✅
- Has timezone dropdown ✅ (likely implemented)

### What's Broken

❌ **Creation Flow:**
- Collects time but doesn't store it
- Doesn't collect timezone at all
- Missing from `EventCreationInput` interface
- Missing from `EventBasicsStep` component

❌ **Database Schema:**
- `event_date` is DATE (should be TIMESTAMPTZ or need separate time column)
- No `start_time` or `event_time` column exists
- Can't store time component at all

❌ **Edit Flow:**
- Tries to extract time from DATE column (always gets midnight)
- Tries to store datetime string in DATE column (time gets truncated)
- Works for timezone (can set it), but creation doesn't collect it

---

## Recommendations

### 🚨 **Option 1: Add `start_time` Column (RECOMMENDED)**

**Migration Required:**

```sql
-- Add new column to store full event datetime with timezone
ALTER TABLE events 
ADD COLUMN start_time TIMESTAMPTZ;

-- Backfill existing events (migrate date-only to timestamp)
UPDATE events
SET start_time = event_date::timestamptz
WHERE start_time IS NULL;

-- Optional: Make required after backfill
-- ALTER TABLE events 
-- ALTER COLUMN start_time SET NOT NULL;
```

**Benefits:**
- ✅ Proper datetime storage with timezone info
- ✅ No ambiguity about when event happens
- ✅ Can accurately schedule messages
- ✅ Backward compatible (`event_date` remains for display)

**Application Changes Needed:**

1. **EventCreationInput:**
   ```typescript
   export interface EventCreationInput {
     title: string;
     event_date: string;      // Keep for backward compat
     event_time: string;      // Add: '17:00'
     time_zone?: string;      // Add: 'America/Los_Angeles'
     location?: string;
     is_public: boolean;
     header_image?: File;
     creation_key?: string;
     sms_tag: string;
   }
   ```

2. **eventCreation.ts:**
   ```typescript
   // Combine date + time + timezone
   const startTime = input.time_zone
     ? toUTCFromEventZone(input.event_date, input.event_time, input.time_zone)
     : `${input.event_date}T${input.event_time}:00Z`;
   
   const eventData = {
     title: input.title.trim(),
     event_date: input.event_date,    // Keep for display
     start_time: startTime,           // New: Full timestamp
     time_zone: input.time_zone || null,
     // ... other fields
   };
   ```

3. **EventBasicsStep.tsx:**
   - Add timezone dropdown (copy from edit page)
   - Keep existing date and time pickers
   - Group visually as single unit

4. **CreateEventWizard.tsx:**
   - Add `time_zone` to form state (default to user's browser timezone)
   - Pass to `EventCreationInput`

---

### 🔧 **Option 2: Expand `event_date` to TIMESTAMPTZ**

**Migration Required:**

```sql
-- Change column type
ALTER TABLE events 
ALTER COLUMN event_date TYPE TIMESTAMPTZ 
USING event_date::timestamptz;

-- Rename for clarity
ALTER TABLE events 
RENAME COLUMN event_date TO start_time;
```

**Concerns:**
- ⚠️ Breaking change (many queries use `event_date`)
- ⚠️ Requires updating all application code
- ⚠️ Riskier migration (type conversion)

**Verdict:** **Not recommended** - too risky, keep `event_date` for backward compatibility

---

### ⏸️ **Option 3: Keep Date-Only (Do Nothing)**

**If we accept current limitations:**

**Pros:**
- ✅ No migration needed
- ✅ Simple schema

**Cons:**
- ❌ Users lose time data every creation
- ❌ Can't properly schedule messages
- ❌ Confusing UX (shows midnight when editing)
- ❌ Timezone is optional (inconsistent)

**Verdict:** **Not acceptable** - loses critical user data

---

## Proposed Implementation Plan

### Phase 1: Database Migration (REQUIRED)

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_event_start_time.sql`

```sql
BEGIN;

-- Add start_time column to store full event datetime
ALTER TABLE public.events
ADD COLUMN start_time TIMESTAMPTZ;

-- Backfill existing events: convert event_date to timestamp at noon UTC
-- (Conservative assumption since we don't have the actual time)
UPDATE public.events
SET start_time = (event_date || ' 12:00:00')::timestamptz
WHERE start_time IS NULL;

-- Add comment
COMMENT ON COLUMN public.events.start_time IS 
'Full event start datetime in UTC. Use with time_zone column for local time display.';

-- Index for schedule queries
CREATE INDEX IF NOT EXISTS idx_events_start_time 
ON public.events(start_time);

COMMIT;
```

**Rollback:**
```sql
ALTER TABLE public.events DROP COLUMN IF EXISTS start_time;
```

---

### Phase 2: Update Event Creation Service

**File:** `lib/services/eventCreation.ts`

**1. Update Interface:**
```typescript
export interface EventCreationInput {
  title: string;
  event_date: string;      // Keep for backward compat
  event_time: string;      // NEW: '17:00'
  time_zone?: string;      // NEW: 'America/Los_Angeles'
  location?: string;
  is_public: boolean;
  header_image?: File;
  creation_key?: string;
  sms_tag: string;
}
```

**2. Update Insert Logic:**
```typescript
import { toUTCFromEventZone } from '@/lib/utils/timezone';

private static async createEventWithRPC(
  input: EventCreationInput,
  userId: string,
  headerImageUrl: string | null,
  creationKey: string,
): Promise<EventCreationResult> {
  // Calculate start_time in UTC
  const startTimeUTC = input.time_zone
    ? toUTCFromEventZone(
        input.event_date,
        input.event_time,
        input.time_zone
      )
    : `${input.event_date}T${input.event_time}:00Z`;

  const eventData = {
    title: input.title.trim(),
    event_date: input.event_date,
    start_time: startTimeUTC,      // NEW
    time_zone: input.time_zone || null,  // NEW
    location: input.location?.trim() || null,
    header_image_url: headerImageUrl,
    host_user_id: userId,
    is_public: input.is_public,
    creation_key: creationKey,
    sms_tag: input.sms_tag.trim(),
  };
  
  // ... rest of creation logic
}
```

---

### Phase 3: Update Event Creation UI

**File:** `components/features/events/EventBasicsStep.tsx`

**Add Timezone Dropdown:**

```tsx
{/* Date, Time, and Timezone Row */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* Event Date */}
  <div className="space-y-2">
    <label htmlFor="event_date" className="block text-sm font-medium text-gray-700">
      Wedding Date <span className="text-red-500">*</span>
    </label>
    <TextInput
      type="date"
      id="event_date"
      value={formData.event_date}
      onChange={(e) => onUpdate('event_date', e.target.value)}
      disabled={disabled}
      error={errors.event_date}
      min={new Date().toISOString().split('T')[0]}
      className="text-[16px] min-h-[44px]"
    />
  </div>

  {/* Event Time */}
  <div className="space-y-2">
    <label htmlFor="event_time" className="block text-sm font-medium text-gray-700">
      Time <span className="text-red-500">*</span>
    </label>
    <TextInput
      type="time"
      id="event_time"
      value={formData.event_time}
      onChange={(e) => onUpdate('event_time', e.target.value)}
      disabled={disabled}
      error={errors.event_time}
      className="text-[16px] min-h-[44px]"
    />
  </div>

  {/* Time Zone */}
  <div className="space-y-2">
    <label htmlFor="time_zone" className="block text-sm font-medium text-gray-700">
      Time Zone <span className="text-red-500">*</span>
    </label>
    <select
      id="time_zone"
      value={formData.time_zone}
      onChange={(e) => onUpdate('time_zone', e.target.value)}
      disabled={disabled}
      className="text-[16px] min-h-[44px] w-full rounded-md border-gray-300 focus:border-pink-300 focus:ring focus:ring-pink-200"
    >
      <option value="">Select timezone</option>
      <option value="America/New_York">Eastern Time</option>
      <option value="America/Chicago">Central Time</option>
      <option value="America/Denver">Mountain Time</option>
      <option value="America/Los_Angeles">Pacific Time</option>
      <option value="America/Anchorage">Alaska Time</option>
      <option value="Pacific/Honolulu">Hawaii Time</option>
      {/* Add more as needed */}
    </select>
  </div>
</div>

<MicroCopy>
  All times will be displayed in your selected timezone for guests and scheduled messages.
</MicroCopy>
```

**Update FormData Interface:**
```typescript
// components/features/events/types.ts
export interface EventFormData {
  title: string;
  event_date: string;
  event_time: string;
  time_zone: string;  // NEW
  location: string;
  is_public: boolean;
  sms_tag: string;
}
```

---

### Phase 4: Update Event Review Step

**File:** `components/features/events/EventReviewStep.tsx`

**Display Full DateTime with Timezone:**

```tsx
<p className="text-[15px] text-gray-700">
  {formatEventDateTime(
    formData.event_date + 'T' + formData.event_time
  )}
  {formData.time_zone && (
    <span className="text-gray-600">
      {' '}({getTimezoneLabel(formData.time_zone)})
    </span>
  )}
</p>
```

**Add to Configuration:**
```tsx
<div className="flex items-center justify-between">
  <span className="text-gray-600">Time Zone</span>
  <span className="font-medium text-gray-900">
    {getTimezoneLabel(formData.time_zone) || 'Not set'}
  </span>
</div>
```

---

### Phase 5: Update Event Edit Page

**File:** `app/host/events/[eventId]/edit/page.tsx`

**Load Event Data (with start_time):**

```typescript
setFormData({
  title: eventData.title,
  event_date: eventData.event_date,  // Keep as date string
  event_time: eventData.start_time 
    ? fromUTCToEventZone(eventData.start_time, eventData.time_zone || 'UTC')?.time || '15:00'
    : '15:00',
  time_zone: eventData.time_zone || '',
  location: eventData.location || '',
  description: eventData.description || '',
  is_public: eventData.is_public ?? true,
});
```

**Save Event Data (with start_time):**

```typescript
// Combine date + time + timezone into UTC timestamp
const startTimeUTC = formData.time_zone
  ? toUTCFromEventZone(formData.event_date, formData.event_time, formData.time_zone)
  : `${formData.event_date}T${formData.event_time}:00Z`;

const eventData: EventUpdate = {
  title: formData.title.trim(),
  event_date: formData.event_date,  // Keep for display
  start_time: startTimeUTC,         // NEW: Proper timestamp
  time_zone: formData.time_zone || null,
  location: formData.location.trim() || null,
  description: formData.description.trim() || null,
  header_image_url: headerImageUrl,
  is_public: formData.is_public,
};
```

---

## Impact on Scheduled Messages

### Current Behavior (Broken)

**Without Event Time:**
- Can't send "1 hour before ceremony"
- Can't send "morning of wedding at 9 AM local time"
- Must manually create schedule items for every message

**Without Timezone:**
- Messages scheduled in UTC (confusing)
- "Send at 10 AM" → might be 3 AM for user
- No clarity about delivery time

### After Fix (Working)

**With Event Start Time:**
- ✅ Can send "1 hour before event starts"
- ✅ Can send "day of event at 9 AM"
- ✅ Automatic message scheduling works

**With Timezone:**
- ✅ All times in user's local timezone
- ✅ Clear about when messages send
- ✅ Guests see correct times

---

## Testing Plan

### Database Migration Testing

1. **Pre-migration:**
   - Export current event data
   - Document events with/without time_zone

2. **Run migration:**
   - Add `start_time` column
   - Backfill with midday timestamps
   - Verify no data loss

3. **Post-migration:**
   - Verify all events have `start_time`
   - Check scheduled messages still work
   - Test timezone conversions

### Application Testing

1. **Event Creation:**
   - [ ] Enter date, time, timezone
   - [ ] Verify all three stored in database
   - [ ] Check review screen shows complete datetime
   - [ ] Verify redirect to dashboard works

2. **Event Edit:**
   - [ ] Load event with `start_time`
   - [ ] Verify time extracts correctly (not midnight)
   - [ ] Edit time and save
   - [ ] Verify `start_time` updates in UTC

3. **Schedule Items:**
   - [ ] Create schedule item
   - [ ] Verify times convert correctly
   - [ ] Toggle reminders
   - [ ] Verify send times accurate

4. **Backward Compatibility:**
   - [ ] Old events with only `event_date`
   - [ ] Should show backfilled time
   - [ ] Should allow editing time

---

## Rollback Plan

**If migration causes issues:**

```sql
-- Remove start_time column
ALTER TABLE public.events DROP COLUMN IF EXISTS start_time;

-- Revert application code
git revert <migration-commit>
```

**Safe to rollback:**
- `event_date` column unchanged
- `time_zone` column unchanged
- New `start_time` column simply dropped

---

## Acceptance Criteria

- [ ] **Database:**
  - [ ] `start_time TIMESTAMPTZ` column exists
  - [ ] All events have `start_time` populated
  - [ ] Migration completes without errors

- [ ] **Event Creation:**
  - [ ] Date, time, timezone all collected in UI
  - [ ] All three stored in database
  - [ ] Review screen displays complete datetime with timezone

- [ ] **Event Edit:**
  - [ ] Loads correct time (not midnight)
  - [ ] Can edit date, time, timezone independently
  - [ ] Saves update `start_time` correctly

- [ ] **Scheduled Messages:**
  - [ ] Can reference event start time
  - [ ] Timezone conversions accurate
  - [ ] Messages send at correct local time

- [ ] **Backward Compatibility:**
  - [ ] Old events don't break
  - [ ] Null timezone handled gracefully
  - [ ] No regression in existing functionality

---

## Related Issues

This investigation reveals a **critical data integrity issue**:

1. **User enters time** → Time is lost
2. **User edits event** → Time shows as midnight
3. **User confused** → Thinks they never entered time
4. **Scheduled messages** → Can't use event time for scheduling

**Priority:** 🔴 **CRITICAL**  
**Impact:** 🔴 **HIGH** - Affects 100% of event creations  
**Risk:** 🟡 **MEDIUM** - Requires schema migration  
**Effort:** 🟢 **LOW** - Well-defined fix, straightforward implementation

---

**Investigation completed:** October 16, 2025  
**Next steps:** Review with team, approve migration, implement fix

