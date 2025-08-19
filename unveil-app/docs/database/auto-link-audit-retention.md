# Auto-Link Audit Retention Strategy

## Current State (MVP)
- **Table size**: 2 records
- **Growth rate**: ~2 records/day (test environment)
- **Projected size**: ~730 records/year at current rate
- **Storage impact**: Negligible (<1MB/year)

## Retention Decision for MVP
**NO RETENTION NEEDED** for initial deployment because:

1. **Low volume**: Even with 10x growth (20 records/day), annual storage would be ~7K records
2. **Valuable for debugging**: Audit trail is crucial for troubleshooting linking issues
3. **Rollback dependency**: `rollback_user_links()` function relies on audit history
4. **Compliance**: Full audit trail may be required for data governance

## Future Retention Strategy (When Needed)

### Triggers for Implementation
Implement retention when ANY of these conditions are met:
- Audit table exceeds 100K records
- Table size exceeds 100MB
- Query performance on audit table degrades
- Compliance requires data purging

### Recommended Retention Approach

```sql
-- Simple time-based retention (90 days)
CREATE OR REPLACE FUNCTION cleanup_user_link_audit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.user_link_audit 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- Schedule via pg_cron (weekly cleanup)
-- SELECT cron.schedule('audit-cleanup', '0 2 * * 0', 'SELECT cleanup_user_link_audit();');
```

### Alternative: Partitioning Strategy

For high-volume environments, consider monthly partitioning:

```sql
-- Create partitioned table (future migration)
CREATE TABLE user_link_audit_partitioned (
    LIKE user_link_audit INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE user_link_audit_202501 PARTITION OF user_link_audit_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Drop old partitions as needed
DROP TABLE user_link_audit_202401;
```

## Monitoring

### Audit Table Health Check
```sql
-- Monthly audit table analysis
SELECT 
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as recent_records,
    pg_size_pretty(pg_total_relation_size('user_link_audit')) as table_size,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM user_link_audit;
```

### Growth Rate Monitoring
```sql
-- Weekly growth analysis
SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as records,
    COUNT(DISTINCT table_name) as affected_tables,
    COUNT(*) FILTER (WHERE outcome = 'linked') as successful_links
FROM user_link_audit
WHERE created_at > NOW() - INTERVAL '8 weeks'
GROUP BY week
ORDER BY week;
```

## Rollback Impact

When implementing retention, consider rollback needs:
- Keep audit records for active rollback scenarios
- Document maximum rollback window (e.g., 30 days)
- Update `rollback_user_links()` to handle missing audit data gracefully

## Implementation Timeline

- **MVP**: No retention needed
- **Month 3**: Implement monitoring queries
- **Month 6**: Evaluate growth patterns
- **Year 1**: Implement retention if table exceeds thresholds
- **Scale**: Consider partitioning for high-volume deployments
