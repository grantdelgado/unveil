# Auto-Link User ID by Phone System

## Overview

The auto-link system automatically populates `user_id` fields across tables when there's an unambiguous match between a phone number and an active event guest. This system is event-scoped, safe, idempotent, and fully auditable.

## Discovery Summary

### Target Tables
- **`message_deliveries`**: Has `phone_number`, `user_id`, and can get `event_id` via `guest_id → event_guests.event_id`
- Future tables can be easily added to the trigger system

### Phone Normalization
- Uses E.164 format (`+1XXXXXXXXXX`) with existing CHECK constraints
- The `normalize_phone()` function handles various input formats:
  - `8725292147` → `+18725292147`
  - `+18725292147` → `+18725292147` (unchanged)
  - `18725292147` → `+18725292147`
  - `invalid` → `NULL`

### Uniqueness Constraints
- `event_guests` has `UNIQUE(event_id, phone) WHERE removed_at IS NULL`
- This ensures exactly one active guest per phone per event

## System Components

### 1. Central Linking Function

```sql
SELECT * FROM link_user_by_phone(event_id, normalized_phone);
```

**Logic:**
1. Check feature flag `LINK_USER_BY_PHONE` (currently enabled)
2. Find active event guests with matching phone
3. If exactly one match:
   - Use `event_guests.user_id` if NOT NULL
   - Otherwise, use single matching user from `users` table
4. Return `user_id`, `guest_id`, and `outcome`

**Outcomes:**
- `linked`: Successfully found and returned a user_id
- `no_match`: No matching guest or user found
- `ambiguous`: Multiple candidates found (safety fallback)
- `skipped`: Feature disabled or invalid inputs

### 2. Trigger System

**Trigger:** `trigger_message_deliveries_auto_link_user`
- Fires on `BEFORE INSERT OR UPDATE` of `message_deliveries`
- Only acts when `NEW.user_id IS NULL`
- Never overwrites existing `user_id` values
- Logs all operations to audit table

### 3. Audit Table

```sql
SELECT * FROM user_link_audit ORDER BY created_at DESC;
```

**Columns:**
- `table_name`: Which table was affected
- `record_id`: Primary key of the affected record
- `event_id`: Event scope
- `normalized_phone`: Phone used for matching
- `matched_guest_id`: Guest that was matched (if any)
- `linked_user_id`: User ID that was linked (if any)
- `outcome`: Result of the linking attempt
- `created_at`: Timestamp of operation

### 4. Backfill Function

```sql
-- Dry run (safe, logs to audit but doesn't modify data)
SELECT * FROM backfill_user_links('message_deliveries', 100, true);

-- Actual backfill (modifies data)
SELECT * FROM backfill_user_links('message_deliveries', 100, false);
```

**Returns:**
- `processed_count`: Total records examined
- `linked_count`: Records successfully linked
- `no_match_count`: Records with no matching user
- `ambiguous_count`: Records with multiple candidates
- `skipped_count`: Records that couldn't be processed
- `sample_results`: First 5 results for inspection

### 5. Rollback Function

```sql
-- Rollback links created after a specific timestamp (dry run)
SELECT * FROM rollback_user_links('2025-01-29 14:00:00+00', 'message_deliveries', true);

-- Actual rollback
SELECT * FROM rollback_user_links('2025-01-29 14:00:00+00', 'message_deliveries', false);
```

## Usage Guide

### Running Backfill

```sql
-- 1. Test with dry run first
SELECT * FROM backfill_user_links('message_deliveries', 50, true);

-- 2. Review audit results
SELECT outcome, COUNT(*) 
FROM user_link_audit 
WHERE table_name = 'message_deliveries' 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY outcome;

-- 3. Run actual backfill if results look good
SELECT * FROM backfill_user_links('message_deliveries', 100, false);
```

### Emergency Rollback

```sql
-- 1. Check what would be rolled back
SELECT * FROM rollback_user_links('2025-01-29 14:00:00+00', 'message_deliveries', true);

-- 2. Perform rollback if needed
SELECT * FROM rollback_user_links('2025-01-29 14:00:00+00', 'message_deliveries', false);
```

### Monitoring

```sql
-- Check recent linking activity
SELECT 
    outcome,
    COUNT(*) as count,
    COUNT(DISTINCT event_id) as events,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM user_link_audit 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY outcome
ORDER BY count DESC;

-- Check for ambiguous cases that might need manual review
SELECT 
    event_id,
    normalized_phone,
    COUNT(*) as audit_count
FROM user_link_audit
WHERE outcome = 'ambiguous'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_id, normalized_phone
ORDER BY audit_count DESC;
```

## Safety Features

### Event Scoping
- All operations are scoped to specific events
- No cross-event contamination possible
- Uses existing RLS policies for security

### Non-Destructive
- Never overwrites existing `user_id` values
- All operations logged to audit table
- Dry-run capability for all functions

### Idempotent
- Re-running backfill on same data produces no changes
- Triggers only act when `user_id` IS NULL
- Safe to run multiple times

### Feature Flag
- Controlled by `get_feature_flag('LINK_USER_BY_PHONE')`
- Currently enabled, but can be disabled instantly
- When disabled, all operations return 'skipped' outcome

## Performance

### Indexes
- `idx_message_deliveries_phone_user_null`: Fast lookup for backfill candidates
- `event_guests_event_id_phone_active_key`: Unique constraint doubles as performance index
- `idx_user_link_audit_*`: Various audit table indexes for monitoring queries

### Trigger Performance
- Sub-millisecond latency for typical operations
- Uses existing indexes for lookups
- Minimal overhead when `user_id` already populated

## Testing Results

✅ **Basic Linking**: New records automatically get `user_id` populated  
✅ **Phone Normalization**: Various formats correctly normalized to E.164  
✅ **Preservation**: Existing `user_id` values never overwritten  
✅ **Invalid Input**: Bad phone numbers safely ignored  
✅ **Audit Logging**: All operations tracked with full context  
✅ **Feature Flag**: System respects enable/disable flag  
✅ **Edge Cases**: No matches, ambiguous matches handled safely  

## Example Audit Records

```json
{
  "table_name": "message_deliveries",
  "record_id": "6b931cd2-5ca5-4258-93ca-b3de6207653a",
  "normalized_phone": "+18725292147",
  "matched_guest_id": "702150f5-3817-49d8-a77f-4a2324a77dad",
  "linked_user_id": "7a4ce708-0555-4db2-b181-b7404857f118",
  "outcome": "linked",
  "created_at": "2025-01-29T14:56:05.036762Z"
}
```

## Future Extensions

### Adding New Tables
To add auto-linking to a new table:

1. Add case to `auto_link_user_by_phone_trigger()` function
2. Create trigger on the new table
3. Update `backfill_user_links()` and `rollback_user_links()` functions
4. Add appropriate indexes

### Additional Features
- **Batch processing**: Current backfill processes 100 records at a time
- **Metrics collection**: Audit table provides full traceability
- **Custom matching rules**: Central function can be extended for complex scenarios
- **Multi-table operations**: System designed for easy expansion

## Troubleshooting

### Common Issues

**Q: Backfill shows 0 processed records**  
A: Check that there are records with `user_id IS NULL AND phone_number IS NOT NULL`

**Q: All outcomes show 'skipped'**  
A: Feature flag might be disabled. Check `get_feature_flag('LINK_USER_BY_PHONE')`

**Q: Many 'ambiguous' outcomes**  
A: Multiple users might have the same phone number. Review data quality.

**Q: Trigger not firing**  
A: Check that table has the trigger installed: `\d+ message_deliveries` in psql

### Performance Issues

**Q: Trigger causing slowdowns**  
A: Check if indexes exist, especially `idx_message_deliveries_phone_user_null`

**Q: Backfill timing out**  
A: Reduce batch size parameter or run in smaller chunks

## Migration Files

- `20250129000000_auto_link_user_by_phone.sql`: Complete system implementation
- Applied in steps to handle dependencies correctly
- All components created and tested successfully
