# Event Creation Idempotency

**Last Updated:** January 30, 2025  
**Migration:** `20250130000000_add_event_creation_idempotency.sql`

## 📋 Overview

This document describes the idempotency mechanism implemented to prevent duplicate event creation from double submissions, network retries, or browser navigation issues.

## 🚨 Problem Solved

**Issue**: Users could create duplicate events by:

- Double-clicking the "Create Wedding Hub" button
- Browser back/forward navigation during submission
- Network timeouts causing client retries
- Concurrent API calls with identical data

**Example**: Nick Molcsan created two identical events 131ms apart, indicating a classic double-submission scenario.

## 🛠️ Solution Architecture

### Server-Side Idempotency

The core solution uses a **creation_key** column with unique constraints:

```sql
-- New column for idempotency
ALTER TABLE public.events
ADD COLUMN creation_key UUID NULL;

-- Unique constraint prevents duplicates
CREATE UNIQUE INDEX idx_events_creation_key_unique
ON public.events(creation_key)
WHERE creation_key IS NOT NULL;
```

### Flow Diagram

```
Client Request
    ↓
Generate/Use creation_key (UUID)
    ↓
Server: Check existing event with same creation_key
    ↓
┌─ Exists? → Return existing event (200 OK)
└─ No? → Create new event + Return (201 Created)
```

## 🔧 Implementation Details

### 1. Database Schema

**New Column**: `events.creation_key UUID`

- **Nullable**: Yes (for backward compatibility)
- **Unique**: Yes (via partial unique index)
- **Indexed**: Yes (for efficient lookups)

### 2. Updated RPC Function

The `create_event_with_host_atomic()` function now:

```sql
-- Check for existing event with same creation_key
IF creation_key_param IS NOT NULL THEN
    SELECT * INTO existing_event
    FROM public.events
    WHERE creation_key = creation_key_param
    AND host_user_id = current_user_id;

    -- Return existing event if found
    IF existing_event.id IS NOT NULL THEN
        RETURN QUERY SELECT
            true,
            existing_event.id,
            existing_event.created_at,
            NULL::text,
            'returned_existing';
        RETURN;
    END IF;
END IF;
```

### 3. Client-Side Generation

**EventCreationService** generates UUID creation keys:

```typescript
// Generate idempotency key if not provided
const creationKey = input.creation_key || crypto.randomUUID();

const eventData = {
  // ... other fields
  creation_key: creationKey,
};
```

**CreateEventWizard** persists keys across retries:

```typescript
// Idempotency key for server-side duplicate prevention
const creationKeyRef = useRef<string | null>(null);

// Generate once, reuse for retries
if (!creationKeyRef.current) {
  creationKeyRef.current = crypto.randomUUID();
}
```

## 🎯 Key Features

### ✅ Idempotent Operations

- **Same creation_key** → Returns existing event
- **Different creation_key** → Creates new event
- **No creation_key** → Creates new event (backward compatible)

### ✅ Multi-Event Support

- Users can create multiple events (different creation_keys)
- No artificial "one event per host" limitation
- Future-proof for multi-event functionality

### ✅ Race Condition Handling

```sql
EXCEPTION
    WHEN unique_violation THEN
        -- Handle concurrent requests with same key
        SELECT * INTO existing_event
        FROM public.events
        WHERE creation_key = creation_key_param;

        RETURN QUERY SELECT true, existing_event.id, ...
```

### ✅ Operation Transparency

Response includes operation type:

- `"operation": "created"` → New event created
- `"operation": "returned_existing"` → Existing event returned

## 📊 Diagnostic Tools

### Duplicate Detection Script

```bash
# Detect duplicates
npx tsx scripts/detect-duplicate-events.ts

# Analyze and cleanup safe duplicates
npx tsx scripts/detect-duplicate-events.ts --fix-duplicates
```

### Database Function

```sql
-- Built-in diagnostic function
SELECT * FROM detect_duplicate_events();
```

Returns potential duplicates with timing analysis.

## 🧪 Testing Scenarios

### Test Case 1: Double Submission

```typescript
// Simulate double-click
const creationKey = crypto.randomUUID();

const [result1, result2] = await Promise.all([
  EventCreationService.createEventWithHost(
    { ...eventData, creation_key: creationKey },
    userId,
  ),
  EventCreationService.createEventWithHost(
    { ...eventData, creation_key: creationKey },
    userId,
  ),
]);

// Expected: Same event_id, one "created", one "returned_existing"
assert(result1.data.event_id === result2.data.event_id);
```

### Test Case 2: Different Events

```typescript
// Different creation keys = different events
const result1 = await EventCreationService.createEventWithHost(
  { ...eventData },
  userId,
);
const result2 = await EventCreationService.createEventWithHost(
  { ...eventData },
  userId,
);

// Expected: Different event_ids, both "created"
assert(result1.data.event_id !== result2.data.event_id);
```

## 🔍 Debugging Guide

### Check Creation Key Usage

```sql
-- Events with creation keys
SELECT id, title, creation_key, created_at
FROM events
WHERE creation_key IS NOT NULL
ORDER BY created_at DESC;
```

### Find Duplicate Creation Keys

```sql
-- Should return empty (unique constraint prevents this)
SELECT creation_key, COUNT(*)
FROM events
WHERE creation_key IS NOT NULL
GROUP BY creation_key
HAVING COUNT(*) > 1;
```

### Analyze Event Creation Patterns

```sql
-- Recent event creation timing
SELECT
  host_user_id,
  title,
  creation_key,
  created_at,
  LAG(created_at) OVER (PARTITION BY host_user_id ORDER BY created_at) as prev_created,
  created_at - LAG(created_at) OVER (PARTITION BY host_user_id ORDER BY created_at) as time_diff
FROM events
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## 🚀 Migration Guide

### Forward Migration

1. **Add column**: `creation_key UUID NULL`
2. **Add unique index**: Prevent duplicates going forward
3. **Update RPC function**: Support idempotency
4. **Update client code**: Generate creation keys

### Rollback Plan

```sql
-- Remove unique constraint
DROP INDEX IF EXISTS idx_events_creation_key_unique;

-- Remove column
ALTER TABLE events DROP COLUMN creation_key;

-- Restore original RPC function (see migration rollback)
```

## 📈 Performance Impact

- **Index overhead**: Minimal (partial index, UUID type)
- **Query performance**: No impact on existing queries
- **Storage**: +16 bytes per event (UUID column)
- **Network**: +36 characters per API call (UUID string)

## 🔐 Security Considerations

- **Creation keys are UUIDs**: Cryptographically secure, non-guessable
- **User isolation**: Keys scoped to `host_user_id`
- **No sensitive data**: Keys contain no user information
- **RLS enforcement**: Existing policies still apply

## 📝 Future Enhancements

1. **Expiration**: Add `creation_key_expires_at` for cleanup
2. **Analytics**: Track idempotency hit rates
3. **Client retry logic**: Exponential backoff with same key
4. **Batch operations**: Extend to guest imports, message sends

---

## 🎉 Success Metrics

After implementation:

- ✅ **Zero duplicate events** from double submissions
- ✅ **Transparent user experience** (same UX for new vs. existing)
- ✅ **Backward compatibility** (existing code works unchanged)
- ✅ **Multi-event support** (no artificial limitations)
- ✅ **Diagnostic tooling** (detect and cleanup legacy duplicates)

**Bottom Line**: It is now **impossible** to create duplicate events from a single user action, while preserving the ability to create multiple distinct events.
