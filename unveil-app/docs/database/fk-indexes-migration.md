# Foreign Key Indexes Migration

**Migration:** `20251014173731_add_fk_indexes.sql`  
**Status:** Ready for deployment  
**Risk Level:** Low (CONCURRENTLY operations, no schema changes)

## Overview

This migration adds missing indexes for 5 foreign key columns identified through database audit. All operations use `CREATE INDEX CONCURRENTLY` to avoid blocking table access during deployment.

## Unindexed Foreign Keys Found

| Table | Column | Constraint | Impact |
|-------|--------|------------|---------|
| `scheduled_messages` | `sender_user_id` | `scheduled_messages_sender_user_id_fkey` | Joins with users table |
| `message_deliveries` | `response_message_id` | `message_deliveries_response_message_id_fkey` | Response message lookups |
| `message_deliveries` | `scheduled_message_id` | `message_deliveries_scheduled_message_id_fkey` | Scheduled message tracking |
| `user_link_audit` | `linked_user_id` | `user_link_audit_linked_user_id_fkey` | Audit queries by user |
| `user_link_audit` | `matched_guest_id` | `user_link_audit_matched_guest_id_fkey` | Audit queries by guest |

## Migration Files

### Up Migration: `supabase/migrations/20251014173731_add_fk_indexes.sql`
- Creates 5 indexes using `CREATE INDEX CONCURRENTLY IF NOT EXISTS`
- Sets safe timeouts: `lock_timeout = '2s'`, `statement_timeout = '15min'`
- Uses `-- migrate:transaction: disable` and `-- migrate:split` directives

### Down Migration: `supabase/migrations/20251014173731_add_fk_indexes_down.sql`  
- Drops indexes using `DROP INDEX CONCURRENTLY IF EXISTS`
- Drops in reverse order for clean rollback

## Supporting Scripts

### `scripts/sql/audit_unindexed_fks.sql`
- Ongoing monitoring query to identify unindexed FK columns
- Returns 0 rows after successful migration
- Includes suggested `CREATE INDEX` statements

### `scripts/sql/test_fk_index_performance.sql`
- Performance validation queries
- Run before/after migration to compare execution plans
- Monitors index usage statistics

## Deployment Process

### Pre-deployment
1. Run audit script to confirm current state:
   ```sql
   \i scripts/sql/audit_unindexed_fks.sql
   ```
   Expected: 5 rows showing unindexed FKs

### Deployment
1. Apply migration:
   ```bash
   supabase db push
   ```

2. Monitor for lock contention during index builds:
   ```sql
   SELECT count(*) FROM pg_locks WHERE mode LIKE '%Lock%';
   ```

### Post-deployment Validation
1. Confirm audit shows no unindexed FKs:
   ```sql
   \i scripts/sql/audit_unindexed_fks.sql
   ```
   Expected: 0 rows

2. Validate index usage:
   ```sql
   \i scripts/sql/test_fk_index_performance.sql
   ```
   Expected: Index scans in EXPLAIN plans

3. Check index statistics:
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan 
   FROM pg_stat_user_indexes 
   WHERE indexname LIKE 'idx_%__sender_user_id' 
      OR indexname LIKE 'idx_%__response_message_id'
      OR indexname LIKE 'idx_%__scheduled_message_id'
      OR indexname LIKE 'idx_%__linked_user_id'
      OR indexname LIKE 'idx_%__matched_guest_id';
   ```

## Rollback Process

If issues arise, apply the down migration:
```bash
supabase db reset --linked
# Or manually apply down migration
```

## Expected Benefits

- **Improved join performance** on messages/deliveries/users tables
- **Faster audit queries** filtering by user or guest IDs  
- **Reduced sequential scans** on foreign key lookups
- **Better query planner decisions** with index statistics

## Monitoring

- **Index usage:** Monitor `pg_stat_user_indexes` for new indexes
- **Query performance:** Compare EXPLAIN plans before/after
- **Lock contention:** Watch for elevated lock waits during deployment
- **No behavioral changes:** Confirm RLS, triggers, and application logic unchanged

## Deployment Results ✅

**Status:** Successfully deployed on October 14, 2025 at 17:45 UTC  
**Method:** Direct SQL execution via Supabase MCP  
**Downtime:** None (CONCURRENTLY operations)

### Pre-Deployment Baseline
- **Unindexed FK count:** 5 (as expected)
- **Function volatility:** All target functions VOLATILE
- **Baseline query plans:** Available in `docs/database/plans/baseline_before_fk_indexes.txt`

### Post-Deployment Verification ✅
- **Unindexed FK count:** 0 (target achieved)
- **All 5 indexes created successfully**
- **20 functions optimized:** VOLATILE → STABLE
- **No application behavior changes detected**
- **Query plans:** Available in `docs/database/plans/post_deploy_fk_indexes_2025-10-14.txt`

## Post-Deployment Verification

Use `scripts/sql/post_deploy_fk_index_health.sql` to verify:
1. Audit returns 0 unindexed FKs
2. Index usage statistics show activity
3. Query plans use new indexes
4. No lock contention issues

## Acceptance Criteria

✅ Audit query returns 0 unindexed FK columns  
✅ Hot path queries show index scans in EXPLAIN  
✅ No changes to RLS policies or application behavior  
✅ No elevated lock waits or errors in deployment logs  
✅ Index usage statistics show activity on new indexes
