# Message History — Variable Declaration Order Fix

**Date:** January 2025  
**Issue:** `ReferenceError: Cannot access 'pastMessages' before initialization`  
**Scope:** Fix JavaScript variable hoisting issue in RecentMessages component

## Problem Summary

After restoring the date grouping functionality, the application crashed with:
```
ReferenceError: Cannot access 'pastMessages' before initialization
    at RecentMessages (RecentMessages.tsx:517:7)
```

## Root Cause

**Variable Declaration Order Issue**: The grouping logic was placed before the `pastMessages` variable was defined.

### Incorrect Order:
```javascript
// ❌ WRONG: Using pastMessages before it's defined
const groupedPastMessages = React.useMemo(() => {
  return groupMessagesByDateWithTimezone(pastMessages, showMyTime, eventTimezone);
}, [pastMessages, showMyTime, eventTimezone]);

// ... later in the code ...
const pastMessages = unifiedMessages.filter(/* ... */);
```

### JavaScript Hoisting Rules
- `const` and `let` declarations are **not hoisted** like `var`
- Variables declared with `const`/`let` exist in a "temporal dead zone" until their declaration is reached
- Attempting to access them before declaration throws a `ReferenceError`

## Solution Applied

**Moved grouping logic after variable definitions**:

```javascript
// ✅ CORRECT: Define pastMessages first
const pastMessages = unifiedMessages.filter(
  (msg) =>
    !(
      msg.type === 'scheduled' &&
      msg.status === 'scheduled' &&
      msg.send_at &&
      new Date(msg.send_at) > new Date()
    ),
);

// ✅ CORRECT: Then use it in grouping logic
const groupedPastMessages = React.useMemo(() => {
  return groupMessagesByDateWithTimezone(pastMessages, showMyTime, eventTimezone);
}, [pastMessages, showMyTime, eventTimezone]);
```

## Changes Made

1. **Removed grouping logic** from line ~515 (before `pastMessages` definition)
2. **Added grouping logic** after line 577 (after `pastMessages` definition)
3. **Preserved all functionality** - no logic changes, only reordering

## Verification

- ✅ No linting errors
- ✅ Development server runs successfully
- ✅ No more `ReferenceError` on component render
- ✅ Date grouping functionality preserved

## Key Takeaway

When adding new computed values that depend on existing variables, always ensure the dependencies are declared first. This is especially important with React hooks and `useMemo` dependencies that reference other component variables.
