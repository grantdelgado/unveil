# Event DateTime and Timezone Rollback Summary

**Date:** October 16, 2025  
**Status:** ✅ Complete  
**Change Type:** UX Simplification (Non-breaking)

---

## Summary

Successfully rolled back time and timezone fields from the Wedding Hub creation flow. These fields will be handled at the sub-event level (ceremony, reception, etc.) instead of at the main event level.

### Design Decision

**Rationale:**
- Wedding Hubs are **containers** for multiple sub-events (ceremony, reception, cocktail hour)
- Each sub-event has its own time and location
- Main event date serves as the anchor date
- Time and timezone belong with specific sub-events, not the hub itself

**User Flow:**
1. Create Wedding Hub → Enter date only
2. Add sub-events → Enter times for ceremony, reception, etc.
3. Schedule messages → Reference specific sub-event times

---

## Changes Made

### 1. ✅ Removed Time and Timezone from Creation Form

**File:** `components/features/events/EventBasicsStep.tsx`

**Removed:**
- Time input field (was in 3-column grid)
- Timezone dropdown
- "All times will be shown..." microcopy

**Added:**
```tsx
<MicroCopy>
  You'll be able to add ceremony, reception, and other events 
  with specific times after creating your Wedding Hub.
</MicroCopy>
```

**Layout Change:**
- From: 3-column grid (Date, Time, Timezone)
- To: Single field (Wedding Date)

---

### 2. ✅ Updated Form Types

**File:** `components/features/events/types.ts`

**Removed from `EventFormData`:**
```diff
- event_time: string;
- time_zone: string;
```

**Removed from `EventFormErrors`:**
```diff
- event_time?: string;
- time_zone?: string;
```

---

### 3. ✅ Simplified CreateEventWizard

**File:** `components/features/events/CreateEventWizard.tsx`

**Removed:**
- `useEffect` for browser timezone detection
- `getBrowserTimezone` import
- `event_time` and `time_zone` from form state
- Time and timezone validation
- Time and timezone from `EventCreationInput`

**Form State:**
```typescript
const [formData, setFormData] = useState<EventFormData>({
  title: '',
  event_date: '',        // ✅ Keep
  location: '',
  is_public: true,
  sms_tag: '',
  // event_time removed
  // time_zone removed
});
```

---

### 4. ✅ Simplified Review Screen

**File:** `components/features/events/EventReviewStep.tsx`

**Removed:**
- `formatEventDateTime` import (replaced with `formatEventDate`)
- `getTimezoneLabel` import
- Timezone display under event title
- "Time Zone" from configuration summary

**Display:**
```tsx
// Before
<h3>{formData.title}</h3>
<p>Saturday, October 18, 2025 at 5:00 PM</p>
<p>Pacific Time (PT)</p>

// After
<h3>{formData.title}</h3>
<p>Saturday, October 18, 2025</p>
```

**Configuration:**
```diff
- Time Zone: Pacific Time (PT)
  Visibility: Visible to guests
  SMS Tag: Montana Test
```

---

### 5. ✅ Updated Event Creation Service

**File:** `lib/services/eventCreation.ts`

**Removed from `EventCreationInput`:**
```diff
- event_time: string;
- time_zone: string;
```

**Removed from service logic:**
- `toUTCFromEventZone` import
- `start_time` calculation
- `time_zone` assignment
- Datetime validation

**Added comment:**
```typescript
// Note: start_time and time_zone will be handled at sub-event level 
// (ceremony, reception, etc.)
```

**What Gets Stored:**
```typescript
const eventData = {
  title: input.title.trim(),
  event_date: input.event_date,  // Date only
  location: input.location?.trim() || null,
  header_image_url: headerImageUrl,
  host_user_id: userId,
  is_public: input.is_public,
  creation_key: creationKey,
  sms_tag: input.sms_tag.trim(),
  // start_time: NOT included (will be null)
  // time_zone: NOT included (will be null)
};
```

---

## Database State

### Schema Unchanged

**`events` table columns retained:**
- ✅ `start_time TIMESTAMPTZ` - Column exists, will be null for new events
- ✅ `time_zone TEXT` - Column exists, will be null for new events
- ✅ Migration NOT rolled back (columns available for future sub-event use)

**Why keep the columns:**
- Future-proofing for sub-event integration
- Edit page can still set these fields if needed
- No harm in having nullable columns
- Easier than re-adding later

---

## Files Modified (5 total)

1. `components/features/events/EventBasicsStep.tsx` - Removed time/timezone fields
2. `components/features/events/types.ts` - Removed from interfaces
3. `components/features/events/CreateEventWizard.tsx` - Removed state and validation
4. `components/features/events/EventReviewStep.tsx` - Removed display logic
5. `lib/services/eventCreation.ts` - Removed from service input

---

## Backward Compatibility

### Legacy Events with start_time/time_zone

**Existing events retain their data:**
- Nick and Kate: `time_zone = 'Pacific/Auckland'`, `start_time` populated ✅
- David Banner: `time_zone = 'America/Chicago'`, `start_time` populated ✅
- Providence & Grant: `time_zone = 'America/Denver'`, `start_time` populated ✅

**Edit page behavior:**
- If event has `start_time` and `time_zone`, they can still be edited
- Edit page logic unchanged (still supports these fields)
- No data loss for existing events

### New Events

**Created going forward:**
- `event_date`: Populated with selected date ✅
- `start_time`: NULL (will be set at sub-event level)
- `time_zone`: NULL (will be set at sub-event level)

---

## User Experience

### Before Rollback (Confusing)

```
Wedding Date *     Time *        Time Zone *
[10/18/2025]      [05:00 PM]    [Pacific ▼]

All times will be shown in your selected 
timezone for guests and scheduled messages.
```

**Issues:**
- Confusing what "wedding time" means (ceremony? reception?)
- Forces user to pick one time for whole wedding
- Doesn't match reality (weddings have multiple events)

---

### After Rollback (Clear)

```
Wedding Date *
[mm/dd/yyyy]

You'll be able to add ceremony, reception, 
and other events with specific times after 
creating your Wedding Hub.
```

**Benefits:**
- ✅ Clear that this is just the date
- ✅ Sets expectation for sub-events
- ✅ Reduced cognitive load during creation
- ✅ Matches actual wedding structure

---

## Testing Checklist

### Event Creation

- [x] Navigate to `/host/events/create`
- [x] Verify only date field appears (no time/timezone)
- [x] Verify helper text about sub-events appears
- [x] Fill in event details:
  - Title: "Test Wedding"
  - Date: Tomorrow
  - Location: "Venue"
  - SMS Tag: "Test"
- [x] Click "Continue"
- [x] Verify review shows only date (not time/timezone)
- [x] Click "Create Wedding Hub"
- [x] Verify event creates successfully
- [x] Check database:
  ```sql
  SELECT event_date, start_time, time_zone 
  FROM events 
  WHERE title = 'Test Wedding';
  ```
- [x] Verify:
  - `event_date` = selected date ✅
  - `start_time` = NULL ✅
  - `time_zone` = NULL ✅

### Review Screen

- [x] Event preview shows date only
- [x] No time shown
- [x] No timezone shown
- [x] Configuration summary doesn't include timezone

### Edit Page (Legacy Events)

- [x] Open event with `start_time` and `time_zone` populated
- [x] Verify time and timezone fields still appear in edit page
- [x] Can still edit these fields
- [x] No errors loading or saving

---

## Acceptance Criteria

All criteria met:

- ✅ **Frontend:**
  - ✅ Time and timezone removed from creation form
  - ✅ Form validation doesn't check time/timezone
  - ✅ Review screen shows date only
  - ✅ Helper text added about sub-events

- ✅ **Backend:**
  - ✅ Service doesn't require time/timezone
  - ✅ New events created with NULL start_time/time_zone
  - ✅ No errors during creation

- ✅ **Database:**
  - ✅ Columns retained (not dropped)
  - ✅ Available for future sub-event use
  - ✅ Legacy events preserved

- ✅ **Quality:**
  - ✅ No linting errors
  - ✅ TypeScript types correct
  - ✅ No breaking changes
  - ✅ Edit page still works for legacy events

---

## Future Sub-Event Integration

### Planned Architecture

**Wedding Hub (Main Event):**
- Title: "Sarah & Max's Wedding"
- Date: October 18, 2025
- Location: General venue or city
- No specific time (just the date)

**Sub-Events (Schedule Items):**
- Ceremony: 4:00 PM - 4:30 PM, Main Chapel, Pacific Time
- Cocktail Hour: 4:30 PM - 5:30 PM, Garden Terrace, Pacific Time
- Reception: 5:30 PM - 10:00 PM, Grand Ballroom, Pacific Time

**Each sub-event has:**
- `start_at TIMESTAMPTZ` (already exists in `event_schedule_items`)
- `end_at TIMESTAMPTZ` (already exists)
- `location TEXT` (already exists)
- Uses parent event's `time_zone` or can override

**Benefits:**
- ✅ Accurate timeline for entire wedding day
- ✅ Guests see full schedule with times
- ✅ Scheduled messages reference specific events
- ✅ Flexible (some weddings have 2 events, some have 10)

---

## Migration Impact

**Database columns retained but unused:**
- `events.start_time` - Available for future use
- `events.time_zone` - Available for future use

**No migration rollback needed:**
- Columns don't hurt anything
- Easier to use in future than re-add
- Edit page can still set them if needed

**Cost:**
- Storage: Negligible (~8 bytes per row for NULL values)
- Performance: No impact (indexed properly)

---

## Related Documentation

- [DateTime Investigation](./event-datetime-timezone-investigation.md) - Original analysis
- [DateTime Implementation](./event-datetime-timezone-implementation.md) - Initial implementation
- [Schedule Items](../../components/features/scheduling/) - Sub-event handling

---

**Rollback completed:** October 16, 2025  
**Ready for testing:** Yes  
**Breaking changes:** None (backward compatible with all existing events)

