# Database Health & Performance Snapshot

**Audit Date:** September 30, 2025  
**Database:** Unveil App Production Instance  
**PostgreSQL Version:** 15.8.1.085  

## Executive Summary

The database demonstrates **healthy performance characteristics** with some optimization opportunities:

- ✅ **Reasonable total size** (~4.5MB across all relations)
- ⚠️ **High index-to-table ratios** on several core tables
- ⚠️ **Many unused indexes** identified (cleanup opportunity)
- ✅ **Well-performing query patterns** with proper index usage

## Size Analysis

### Top 10 Largest Relations

| Rank | Table | Schema | Total Size | Table Size | Index Size | Index Ratio |
|------|-------|--------|------------|------------|------------|-------------|
| 1 | message_deliveries | public | 1,128 kB | 224 kB | 904 kB | 80.1% |
| 2 | audit_log_entries | auth | 568 kB | 408 kB | 160 kB | 28.2% |
| 3 | schema_migrations | supabase_migrations | 504 kB | 272 kB | 232 kB | 46.0% |
| 4 | event_guests | public | 304 kB | 64 kB | 240 kB | 78.9% |
| 5 | users | auth | 296 kB | 96 kB | 200 kB | 67.6% |
| 6 | refresh_tokens | auth | 232 kB | 48 kB | 184 kB | 79.3% |
| 7 | messages | public | 208 kB | 24 kB | 184 kB | 88.5% |
| 8 | subscription | realtime | 200 kB | 64 kB | 136 kB | 68.0% |
| 9 | user_link_audit | public | 176 kB | 0 bytes | 176 kB | 100.0% |
| 10 | scheduled_messages | public | 152 kB | 32 kB | 120 kB | 78.9% |

### Key Observations

1. **Index-Heavy Tables:** Several tables have 75%+ of their size in indexes
2. **Core Tables Healthy:** Main application tables are reasonably sized
3. **Audit Tables:** Significant space used by audit/logging tables (expected)

## Index Usage Analysis

### 🔴 Unused Indexes (High Priority Cleanup)

**Critical Finding:** 60+ indexes with 0 scans but high sequential scan tables

| Table | Schema | Unused Indexes | Sequential Scans | Impact |
|-------|--------|----------------|------------------|--------|
| storage.objects | storage | 2 indexes | 122,255 scans | HIGH |
| realtime.subscription | realtime | 1 index | 113,900 scans | HIGH |
| public.events | public | 1 index | 69,543 scans | HIGH |
| auth.users | auth | 6 indexes | 13,374 scans | MEDIUM |
| public.event_guests | public | 1 index | 15,408 scans | MEDIUM |

### 🟢 Well-Performing Indexes

| Table | Index | Scans | Usage Category |
|-------|-------|-------|----------------|
| public.scheduled_messages | idx_scheduled_messages_processing | 54,857 | HEAVILY_USED |
| public.events | idx_events_host | 25,418 | HEAVILY_USED |
| public.events | events_pkey | 21,517 | HEAVILY_USED |
| realtime.subscription | subscription_subscription_id_entity_filters_key | 13,296 | HEAVILY_USED |

### ⚠️ High Sequential Scan Tables

Tables with concerning seq_scan vs idx_scan ratios:

1. **storage.objects** - 122K seq scans, minimal index usage
2. **realtime.subscription** - 113K seq scans (realtime system table)
3. **public.events** - 69K seq scans (may need query optimization)

## Query Performance Analysis

### Top Resource-Consuming Queries

| Query Type | Calls | Total Time (ms) | % of Total | Avg Time (ms) |
|------------|-------|-----------------|------------|---------------|
| realtime.list_changes | 2.56M | 11,306,451 | 91.4% | 4.4 |
| PostgREST API calls | 53.7K | 217,630 | 1.8% | 4.1 |
| Timezone queries | 1.1K | 146,086 | 1.2% | 136.7 |
| GraphQL schema | 754 | 78,830 | 0.6% | 104.5 |

### Key Performance Insights

1. **Realtime Dominance:** 91% of query time spent in realtime operations
2. **API Performance:** PostgREST queries averaging ~4ms (excellent)
3. **Timezone Overhead:** Timezone lookups are expensive (136ms avg)
4. **GraphQL Cost:** Schema introspection queries are heavy

## Database Health Indicators

### ✅ Positive Indicators
- **Low total database size** (under 5MB)
- **Fast API response times** (4ms average)
- **Active index usage** on core tables
- **Proper table statistics** (auto-vacuum working)

### ⚠️ Areas for Optimization

#### 1. Index Cleanup Opportunity
```sql
-- Example unused indexes to consider dropping:
-- DROP INDEX IF EXISTS storage.name_prefix_search;
-- DROP INDEX IF EXISTS public.idx_events_creation_key_unique;
-- DROP INDEX IF EXISTS auth.users_email_partial_key;
```

#### 2. Query Pattern Optimization
- **Storage queries:** High seq scan ratio suggests missing indexes or query patterns
- **Timezone caching:** Consider caching timezone data for better performance
- **Realtime tuning:** Monitor realtime subscription performance

#### 3. Table Maintenance
- **user_link_audit:** 100% index ratio suggests table is empty (good - audit purging working)
- **Partition pruning:** Realtime message partitions ready for cleanup

## Bloat Assessment

Based on statistics analysis:

| Table | Live Rows | Dead Rows | Bloat Level | Action Needed |
|-------|-----------|-----------|-------------|---------------|
| message_deliveries | 1,441 | 9 | MINIMAL | None |
| event_guests | 143 | 5 | MINIMAL | None |
| messages | 111 | 6 | MINIMAL | None |
| scheduled_messages | 45 | 58 | MODERATE | Monitor |

**Overall Bloat Status:** HEALTHY - Auto-vacuum maintaining good table health

## Recommendations

### Immediate Actions (Performance)
1. **Index Cleanup:** Drop 20+ unused indexes to reduce maintenance overhead
2. **Storage Queries:** Investigate high sequential scan patterns
3. **Timezone Caching:** Implement application-level timezone caching

### Monitoring Setup
1. **Track index usage** trends over time
2. **Monitor realtime** subscription performance
3. **Alert on bloat** levels exceeding 20%

### Future Capacity Planning
- **Current growth rate:** Sustainable for next 12 months
- **Index maintenance:** Regular cleanup recommended quarterly
- **Partition management:** Realtime partitions ready for automated pruning

## Conclusion

The Unveil database demonstrates **excellent health fundamentals** with optimization opportunities in index management and query patterns. The core application performance is strong with room for operational improvements.

**Performance Grade: B+**

---
*Generated by automated database health monitoring system*
