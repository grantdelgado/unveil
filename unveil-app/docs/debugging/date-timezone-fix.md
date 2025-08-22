# Event Date Timezone Fix - Off-by-One Issue Resolution

## Issue Summary

Fixed critical off-by-one date rendering issue where event dates stored as `2025-08-31` would display as "Saturday, August 30, 2025" for users in negative UTC offset timezones (PST, EST, etc.).

## Root Cause Analysis

### The Problem

JavaScript's `new Date('YYYY-MM-DD')` constructor interprets the string as UTC midnight (00:00:00Z). When this UTC date is converted to local timezone for display:

- **UTC Database**: `2025-08-31` (DATE column)
- **JavaScript Parse**: `new Date('2025-08-31')` → `2025-08-31T00:00:00.000Z`
- **PST Display**: `2025-08-30T16:00:00.000-08:00` → "Saturday, August 30, 2025" ❌
- **EST Display**: `2025-08-30T19:00:00.000-05:00` → "Saturday, August 30, 2025" ❌

### The Solution

Parse date components manually and create Date object in local timezone:

```typescript
// ❌ WRONG: Creates UTC midnight, shifts in negative offset timezones
new Date('2025-08-31').toLocaleDateString();

// ✅ CORRECT: Parse components, create in local timezone
const [year, month, day] = dateString.split('-').map(Number);
new Date(year, month - 1, day).toLocaleDateString();
```

## Implementation Details

### Updated Files

1. **`lib/utils/date.ts`** - Fixed `formatEventDate()` function with timezone-safe parsing
2. **`app/guest/events/[eventId]/home/page.tsx`** - Removed duplicate implementation, use centralized function
3. **`components/features/scheduling/EventSchedule.tsx`** - Removed duplicate implementation
4. **`components/features/events/EventReviewStep.tsx`** - Fixed datetime concatenation usage
5. **`app/host/events/[eventId]/edit/page.tsx`** - Fixed datetime concatenation usage

### Key Changes

```typescript
/**
 * Formats a DATE string (YYYY-MM-DD) as a calendar day, avoiding timezone shifts.
 */
export const formatEventDate = (dateString: string): string => {
  if (!dateString) return '';

  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) {
    console.warn(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    return dateString;
  }

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(dateParts[2], 10);

  // Create Date in local timezone to preserve calendar day
  const localDate = new Date(year, month, day);

  return localDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
```

## QA Checklist

### Manual Testing Requirements

#### 1. Timezone Validation

Test the following timezones to ensure consistent calendar day display:

- [ ] **UTC-8 (PST)**: Los Angeles, San Francisco
- [ ] **UTC-5 (EST)**: New York, Boston
- [ ] **UTC+0 (GMT)**: London (winter)
- [ ] **UTC+1 (CET)**: Paris, Berlin
- [ ] **UTC+9 (JST)**: Tokyo, Seoul

#### 2. Browser Testing

- [ ] **macOS Chrome**: Primary development browser
- [ ] **iOS Safari**: Mobile Safari behavior
- [ ] **Android Chrome**: Mobile Chrome behavior
- [ ] **Firefox**: Alternative rendering engine
- [ ] **Edge**: Chromium-based validation

#### 3. SSR/Hydration Testing

- [ ] **Server-rendered HTML**: View page source to check initial HTML
- [ ] **Client hydration**: Ensure no hydration mismatches in console
- [ ] **No layout shifts**: Date should remain consistent during hydration

#### 4. Date Range Testing

Test edge cases and various date formats:

- [ ] **Month boundaries**: `2025-08-31`, `2025-09-01`
- [ ] **Year boundaries**: `2024-12-31`, `2025-01-01`
- [ ] **Leap years**: `2024-02-29`
- [ ] **Different months**: January, June, December

#### 5. Component Coverage

Verify date display in all event date locations:

- [ ] **Guest home page**: Main event details card
- [ ] **Event schedule page**: Schedule header
- [ ] **Host dashboard**: Event summary cards
- [ ] **Event list page**: Event selection list
- [ ] **Event editing**: Review step preview

### Automated Testing

```bash
# Run the date utility tests
npm test lib/utils/date.test.ts

# Check for regressions
npm run test:ci
```

### Timezone Simulation for Testing

To test different timezones locally:

```javascript
// In browser console, temporarily override timezone
const originalTimezoneOffset = Date.prototype.getTimezoneOffset;

// Simulate PST (UTC-8)
Date.prototype.getTimezoneOffset = () => 480;

// Simulate EST (UTC-5)
Date.prototype.getTimezoneOffset = () => 300;

// Test the date formatting
formatEventDate('2025-08-31');

// Restore
Date.prototype.getTimezoneOffset = originalTimezoneOffset;
```

## Validation Commands

```bash
# Test specific date scenarios
node -e "
const { formatEventDate } = require('./lib/utils/date.ts');
console.log('2025-08-31:', formatEventDate('2025-08-31'));
console.log('2025-12-25:', formatEventDate('2025-12-25'));
console.log('2024-02-29:', formatEventDate('2024-02-29'));
"

# Lint check
npm run lint

# Type check
npm run type-check
```

## Expected Results

For `event_date = '2025-08-31'`:

- **All timezones**: "Sunday, August 31, 2025"
- **SSR HTML**: Same as hydrated client
- **No console warnings**: About hydration mismatches

## Rollback Plan

If issues arise, revert these commits and temporarily use this workaround:

```typescript
// Emergency fallback - not timezone safe but prevents crashes
const formatEventDate = (dateString: string) => {
  try {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};
```

## Future Considerations

1. **Internationalization**: Consider user locale preferences for date formatting
2. **Database Migration**: Eventually migrate to `TIMESTAMPTZ` if time-of-day becomes important
3. **Library Integration**: Consider `date-fns` or `dayjs` for more complex date operations
4. **User Timezone Storage**: Store user's preferred timezone for personalized experiences

## Documentation References

- [MDN Date Constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date)
- [JavaScript Date Timezone Gotchas](https://maggiepint.com/2017/04/11/the-javascript-date-nightmare/)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
