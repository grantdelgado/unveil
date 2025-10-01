# Database Hygiene Guide

**Last Updated**: October 4, 2025  
**Status**: Wave 3 Complete - Minimal Ops Infrastructure Active

---

## 🎯 **Current State**

### **RSVP Model** ✅
**Canonical Model**: Uses `declined_at` + `sms_opt_out` exclusively
- **Attending**: `declined_at IS NULL`
- **Declined**: `declined_at IS NOT NULL`  
- **SMS Eligible**: `declined_at IS NULL AND sms_opt_out = FALSE`

**Migration Status**: ✅ Complete
- ✅ Phase 1: RPC functions updated to use `declined_at`
- ✅ Phase 2: `rsvp_status` column removed
- ✅ Compatibility view removed (October 1, 2025)

### **Partitioning Status** ✅
**Current**: No message partitions exist
- Main `messages` table handles all message storage
- No partition management required
- Partition retention function available but disabled

---

## 🔧 **Active Monitoring Infrastructure**

### **Index Usage Monitoring** ✅
**Purpose**: Identify unused indexes for future cleanup

**Components**:
- `index_usage_snapshots` table - Daily snapshots of pg_stat_user_indexes
- `low_usage_indexes_30d` view - Flags indexes with 0 scans over 30 days
- `capture_index_usage_snapshot()` function - Records current usage stats

**Current Status**: 321 snapshots captured, 82 low-usage indexes identified

### **Audit Retention Policy** ✅
**Purpose**: Prevent unbounded growth of audit tables

**Components**:
- `purge_user_link_audit(retain_days)` - Purges old audit records
- `run_user_link_audit_purge(retain_days)` - Wrapper with logging
- `user_link_audit_purge_runs` table - PII-free operation tracking

**Current Status**: 180-day retention, 1 purge run logged

### **TTL Policies**
- **Audit data**: 180 days (6 months)
- **Index snapshots**: 90 days (3 months)
- **Purge logs**: Unlimited (small volume)

---

## 📅 **Manual Operations Schedule**

Since `pg_cron` is not installed, run these operations manually:

### **Daily Routine** (3:05 AM recommended)
```sql
-- Capture index usage trends
SELECT public.capture_index_usage_snapshot();
```

### **Weekly Routine** (Sunday 3:15 AM recommended)  
```sql
-- Purge old audit records (180-day retention)
SELECT public.run_user_link_audit_purge(180);
```

### **Daily Cleanup** (4:00 AM recommended)
```sql
-- Clean old index snapshots (90-day retention)
SELECT public.cleanup_index_snapshots(90);
```

### **Check Schedule**
```sql
-- View recommended schedule
SELECT * FROM public.show_ops_schedule();
```

---

## 📊 **Monitoring Queries**

### **Index Usage Analysis**
```sql
-- Current snapshot status
SELECT COUNT(*) as total_snapshots,
       COUNT(DISTINCT table_name) as tables_monitored,
       MAX(captured_at) as last_capture
FROM public.index_usage_snapshots;

-- Review cleanup candidates (after 7+ days of data)
SELECT * FROM public.low_usage_indexes_30d 
WHERE recommendation = 'CANDIDATE_FOR_REMOVAL'
ORDER BY table_name, index_name;
```

### **Audit Health**
```sql
-- Current audit table size
SELECT COUNT(*) as total_audit_records,
       MIN(created_at) as oldest_record,
       MAX(created_at) as newest_record,
       EXTRACT(days FROM MAX(created_at) - MIN(created_at)) as span_days
FROM public.user_link_audit;

-- Purge operation history
SELECT * FROM public.user_link_audit_purge_runs 
ORDER BY ran_at DESC LIMIT 5;
```

---

## 🧹 **Cleanup History**

### **Wave 1** (October 1, 2025)
- ✅ Dropped `event_guests_rsvp_compat` view
- ✅ Removed 2 unused RSVP-Lite indexes
- ✅ Created partition retention function (disabled)

### **Wave 2** (October 2, 2025)  
- ✅ Added audit retention policy (180-day TTL)
- ✅ Created index usage monitoring infrastructure
- ✅ Added partition sentinel (later removed in Wave 3)

### **Wave 3** (October 4, 2025)
- ✅ Clarified RUM object (keep - actively used)
- ✅ Conservative index approach (no drops, wait for data)
- ✅ Implemented minimal-keep ops infrastructure
- ✅ Removed unnecessary partition monitoring

---

## 🔮 **Future Waves**

### **Wave 4** (30+ days from Wave 2)
**Prerequisites**: 30 days of index usage trend data

**Planned Actions**:
- Data-driven index cleanup based on proven 0-scan patterns
- Review audit retention effectiveness
- Consider pg_cron installation for automation

### **Ongoing Maintenance**
- **Monthly review**: Check `low_usage_indexes_30d` for new candidates
- **Quarterly audit**: Validate retention policies and storage growth
- **Annual review**: Assess overall database hygiene effectiveness

---

## 🚨 **Emergency Procedures**

### **Rollback Any Wave**
```sql
-- Wave 3 rollback
\i 20251004120201_wave3_02_remove_partition_sentinel_down.sql
\i 20251004120101_wave3_01_enable_minimal_ops_cron_down.sql

-- Wave 2 rollback  
\i 20251002120301_wave2_03_index_usage_watcher_down.sql
\i 20251002120101_wave2_01_audit_retention_down.sql

-- Wave 1 rollback
\i 20251001120101_rollback_restore_rsvp_indexes.sql
\i 20251001120001_rollback_restore_rsvp_compat_view.sql
```

### **Performance Issues**
If any performance regressions occur:
1. Check `EXPLAIN` plans for affected queries
2. Review recent index changes in audit logs
3. Apply targeted rollback migrations
4. Monitor for 24 hours before declaring resolution

---

## 📞 **Support & Contacts**

### **For Questions**
- **Technical**: See migration files and audit reports
- **Performance**: Review EXPLAIN plans and index usage data
- **Rollback**: Use provided down migrations

### **Documentation**
- **Audit reports**: `audit/db_inventory_20251001/`
- **Wave summaries**: `audit/wave3/`  
- **Migration history**: `supabase/migrations/`

**Database hygiene is now on a solid, sustainable foundation with minimal overhead and maximum safety! 🚀**
