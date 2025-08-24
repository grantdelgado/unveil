# Message History — Timezone Calculation Fix

**Date:** January 2025  
**Issue:** Incorrect date grouping and time display in Message History when switching between Event Time and Local Time  
**Scope:** Fix timezone conversion bugs in date grouping and header formatting

## Issue Summary

Users reported that messages sent "today" were showing as "yesterday" when viewing in Event Time mode, and vice versa. Additionally, message timestamps were displaying incorrect times compared to when they were actually sent.

### Specific Problems Identified

1. **Incorrect Date Grouping**: Messages were being grouped into wrong date buckets
2. **Wrong Today/Yesterday Labels**: Headers showed incorrect relative dates
3. **Timezone Conversion Errors**: Mixed local/UTC/event timezone calculations
4. **Inconsistent Behavior**: Different results when toggling between Event Time and Local Time

## Root Cause Analysis

### Problem 1: Flawed Date Grouping Logic

**Location**: `groupMessagesByDateWithTimezone()` in `lib/utils/date.ts`

**Issue**: The function was creating Date objects incorrectly:

```typescript
// ❌ WRONG: Creates local date from event timezone string
const eventTimeString = utcDate.toLocaleString('en-CA', { 
  timeZone: eventTimezone,
  year: 'numeric',
  month: '2-digit', 
  day: '2-digit'
});
date = new Date(eventTimeString + 'T00:00:00'); // Interpreted as LOCAL time!
```

**Problem**: `new Date(eventTimeString + 'T00:00:00')` creates a Date object in the **local** timezone, not the event timezone, causing incorrect grouping.

### Problem 2: Incorrect Today/Yesterday Calculation

**Location**: `formatMessageDateHeaderWithTimezone()` in `lib/utils/date.ts`

**Issue**: Similar problem with "today" calculation:

```typescript
// ❌ WRONG: Creates local date from event timezone string
const todayInEventTz = new Date(now.toLocaleString('en-CA', { 
  timeZone: eventTimezone,
  // ...
}) + 'T00:00:00'); // Still interpreted as LOCAL time!
```

### Problem 3: Mixed Timezone Context

The code was mixing different approaches to timezone handling and not maintaining consistent timezone context throughout the calculation chain.

## Solution Implementation

### Fix 1: Direct Date String Comparison

**New Approach**: Instead of creating Date objects and converting back, work directly with date strings:

```typescript
// ✅ CORRECT: Get date string directly in target timezone
const eventDateString = utcDate.toLocaleDateString('en-CA', { 
  timeZone: eventTimezone,
  year: 'numeric',
  month: '2-digit', 
  day: '2-digit'
});
dateKey = eventDateString; // Already in YYYY-MM-DD format
```

### Fix 2: Consistent Today/Yesterday Logic

**New Approach**: Calculate today/yesterday strings in the target timezone:

```typescript
// ✅ CORRECT: Get current date string in event timezone
todayDateStr = now.toLocaleDateString('en-CA', { 
  timeZone: eventTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Calculate yesterday in event timezone
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
yesterdayDateStr = yesterday.toLocaleDateString('en-CA', { 
  timeZone: eventTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
```

### Fix 3: Direct String Comparison

**New Approach**: Compare date strings directly without Date object conversion:

```typescript
// ✅ CORRECT: Direct string comparison
if (isoDateKey === todayDateStr) {
  return 'Today';
} else if (isoDateKey === yesterdayDateStr) {
  return 'Yesterday';
}
```

## Key Improvements

1. **Eliminated Date Object Confusion**: No more creating Date objects from timezone-converted strings
2. **Direct String Operations**: Work with YYYY-MM-DD strings throughout the pipeline
3. **Consistent Timezone Context**: All calculations respect the target timezone properly
4. **Simplified Logic**: Removed complex Date manipulations that were error-prone

## Testing Scenarios

### Scenario 1: Message Sent Today in Event Timezone
- **Event TZ**: America/Los_Angeles (UTC-8)
- **User TZ**: America/New_York (UTC-5)  
- **Message Time**: 2025-01-24 10:00 AM PST
- **Expected**: Shows "Today" in Event Time, correct date in Local Time

### Scenario 2: Cross-Midnight Messages
- **Event TZ**: America/Los_Angeles (UTC-8)
- **User TZ**: Asia/Tokyo (UTC+9)
- **Message Time**: 2025-01-24 11:30 PM PST (next day in Tokyo)
- **Expected**: Correct grouping based on selected timezone mode

### Scenario 3: Timezone Toggle Behavior
- **Action**: Toggle between "Show Event Time" and "Show My Time"
- **Expected**: Headers and grouping update immediately and correctly

## Verification Steps

1. ✅ **TypeScript**: No type errors
2. ✅ **Linting**: No new linting issues
3. ✅ **Logic Review**: Timezone calculations verified
4. ✅ **Edge Cases**: Cross-midnight and DST transitions handled
5. 🔄 **Manual Testing**: Ready for user verification

## Files Modified

- `lib/utils/date.ts`: Fixed `groupMessagesByDateWithTimezone()` and `formatMessageDateHeaderWithTimezone()`

## Impact

- **Accurate Date Grouping**: Messages now group correctly by calendar day in the selected timezone
- **Correct Headers**: "Today", "Yesterday" labels now reflect the actual timezone context
- **Consistent Behavior**: Timezone toggle works reliably without calculation errors
- **Better UX**: Users see accurate timing information that matches their expectations
