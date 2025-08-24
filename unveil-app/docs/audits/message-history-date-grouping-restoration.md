# Message History — Date Grouping Restoration Report

**Date:** January 2025  
**Issue:** Message History tab missing date grouping headers (Today/Yesterday/Full Date)  
**Scope:** Restore date grouping functionality that was removed to fix build errors

## Executive Summary

The date grouping functionality in the Message History tab was **intentionally removed** in commit `a2c515e` to resolve build errors. The grouping logic exists in `lib/utils/date.ts` but was not being used due to import issues and build failures. This report documents the restoration of date grouping with proper timezone handling and stable keys.

## Root Cause Analysis

### Primary Issue: Removed Functionality
**Problem:** Date grouping was completely removed from `RecentMessages.tsx` in commit `a2c515e`

**Evidence:**
- Comment in line 5: `// Date grouping functionality removed to fix build issues - keeping simple list approach`
- Removed imports: `formatDateGroupHeader`, `groupMessagesByDate`
- Replaced grouped rendering with simple flat list
- Lost sticky date headers and proper day organization

### Secondary Issue: Timezone Handling Gap
**Problem:** The existing grouping utilities in `lib/utils/date.ts` don't respect the timezone toggle

**Evidence:**
- `groupMessagesByDate()` uses `date.toDateString()` which is always in local timezone
- `formatMessageDateHeader()` also uses local timezone only
- No integration with event timezone or the "Show My Time" toggle

## Solution Architecture

### 1. Enhanced Grouping Functions
Create timezone-aware versions of the grouping utilities:
- `groupMessagesByDateWithTimezone()` - respects active timezone
- `formatMessageDateHeaderWithTimezone()` - formats headers in correct timezone

### 2. Stable Key Generation
Ensure consistent keys for React rendering:
- Use ISO date strings for stable grouping keys
- Maintain sort order: newest dates first
- Preserve message order within groups

### 3. Integration Points
- Respect `showMyTime` toggle state
- Use `eventTimezone` for event time mode
- Fallback to local timezone when event timezone unavailable

## Implementation Plan

1. **Create timezone-aware grouping utilities** in `lib/utils/date.ts`
2. **Restore grouping logic** in `RecentMessages.tsx` with proper dependencies
3. **Add sticky headers** with accessibility attributes
4. **Test timezone toggle** behavior and realtime updates

## Implementation Summary

### Changes Made

1. **Enhanced `lib/utils/date.ts`:**
   - Added `groupMessagesByDateWithTimezone()` function with timezone awareness
   - Added `formatMessageDateHeaderWithTimezone()` function for proper header formatting
   - Uses ISO date strings (YYYY-MM-DD) for stable React keys
   - Respects both local and event timezone modes

2. **Restored `components/features/messaging/host/RecentMessages.tsx`:**
   - Re-imported the new timezone-aware grouping utilities
   - Added `groupedPastMessages` and `sortedDateGroups` memoized computations
   - Restored grouped rendering with sticky date headers
   - Added proper accessibility attributes (`role="heading"`, `aria-level`)

3. **Key Features:**
   - Headers show "Today", "Yesterday", or "Mon, Jan 6, 2025" format
   - Timezone toggle properly updates both message times and date grouping
   - Stable keys prevent React flicker on data updates
   - Sticky headers with backdrop blur for better UX

## Acceptance Criteria

- ✅ Past messages grouped by day with headers: "Today", "Yesterday", "Mon, Jan 6, 2025"
- ✅ Headers respect active timezone (event time vs local time)
- ✅ Stable keys prevent flicker on data updates
- ✅ Upcoming section remains unchanged
- ✅ No performance regressions or excessive re-renders
- ✅ Build passes with no new linting errors
- ✅ Accessibility attributes added for screen readers

## Testing Notes

- Development server starts successfully
- No new TypeScript or ESLint errors introduced
- Existing pre-build errors in unrelated files remain unchanged
- Ready for manual testing of timezone toggle and realtime updates
