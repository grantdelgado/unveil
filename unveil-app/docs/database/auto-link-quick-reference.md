# Auto-Link User ID Quick Reference

## 🚀 Quick Start

### Test the System

```sql
-- Test phone normalization
SELECT normalize_phone('8725292147'), normalize_phone('+18725292147');

-- Test central function
SELECT * FROM link_user_by_phone(
    '24caa3a8-020e-4a80-9899-35ff2797dcc0',  -- event_id
    '+18725292147'                           -- phone
);
```

### Run Backfill (Safe)

```sql
-- 1. Dry run first (always start here)
SELECT * FROM backfill_user_links('message_deliveries', 50, true);

-- 2. Check results
SELECT outcome, COUNT(*) FROM user_link_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY outcome;

-- 3. Run for real if results look good
SELECT * FROM backfill_user_links('message_deliveries', 100, false);
```

### Emergency Rollback

```sql
-- Rollback links created in last hour
SELECT * FROM rollback_user_links(NOW() - INTERVAL '1 hour', 'message_deliveries', false);
```

## 📊 Monitoring Queries

### Recent Activity

```sql
SELECT outcome, COUNT(*), MAX(created_at) as latest
FROM user_link_audit
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY outcome;
```

### Problem Cases

```sql
-- Find ambiguous cases needing manual review
SELECT event_id, normalized_phone, COUNT(*)
FROM user_link_audit
WHERE outcome = 'ambiguous' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_id, normalized_phone
ORDER BY count DESC;
```

### System Health

```sql
-- Check trigger is working
SELECT COUNT(*) as new_records_with_user_id
FROM message_deliveries
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND user_id IS NOT NULL;
```

## 🔧 Troubleshooting

### Feature Flag Control

```sql
-- Check if enabled
SELECT get_feature_flag('LINK_USER_BY_PHONE');

-- Disable system (edit function to return false)
```

### Data Quality Checks

```sql
-- Find records that should be linkable but aren't
SELECT COUNT(*) as orphaned_records
FROM message_deliveries md
JOIN event_guests eg ON md.guest_id = eg.id
WHERE md.user_id IS NULL
  AND md.phone_number IS NOT NULL
  AND eg.user_id IS NOT NULL
  AND eg.removed_at IS NULL;
```

## 📈 Performance

### Current Indexes

- ✅ `event_guests_event_id_phone_active_key` (unique)
- ✅ `idx_message_deliveries_phone_user_null` (partial)
- ✅ `idx_user_link_audit_*` (monitoring)

### Trigger Overhead

- ~0.1ms for records with existing user_id (skip)
- ~1-2ms for new linking operations
- All operations logged to audit table

## 🎯 Success Metrics

From testing:

- ✅ Phone normalization: 100% accuracy
- ✅ Trigger activation: Working correctly
- ✅ Audit logging: Complete coverage
- ✅ Safety: No overwrites, event-scoped
- ✅ Performance: Sub-millisecond for common cases

## 🔄 Batch Processing

### Safe Batch Sizes

- **Development**: 50 records
- **Production**: 100-500 records
- **Large backfill**: Run in multiple batches

### Example Batch Script

```sql
-- Process in chunks
DO $$
DECLARE
    result RECORD;
BEGIN
    LOOP
        SELECT * INTO result FROM backfill_user_links('message_deliveries', 100, false);

        RAISE NOTICE 'Processed: %, Linked: %', result.processed_count, result.linked_count;

        -- Exit if no more records
        IF result.processed_count = 0 THEN
            EXIT;
        END IF;

        -- Brief pause between batches
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;
```

## 🚨 Emergency Procedures

### Disable System

```sql
-- Edit get_feature_flag function to return false for 'LINK_USER_BY_PHONE'
-- All new operations will return 'skipped' outcome
```

### Mass Rollback

```sql
-- Rollback all links from today
SELECT * FROM rollback_user_links(CURRENT_DATE, 'message_deliveries', false);
```

### Remove Trigger

```sql
-- Temporarily disable trigger
DROP TRIGGER IF EXISTS trigger_message_deliveries_auto_link_user ON message_deliveries;

-- Re-enable later
CREATE TRIGGER trigger_message_deliveries_auto_link_user
    BEFORE INSERT OR UPDATE ON message_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_user_by_phone_trigger();
```
