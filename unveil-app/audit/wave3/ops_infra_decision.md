# Ops Infrastructure Decision - Wave 3

**Date**: October 2, 2025  
**Decision**: **MINIMAL-KEEP** (Recommended)

---

## 🎯 **Decision: Minimal-Keep with Lightweight Scheduling**

### **What We Keep**
- ✅ `index_usage_snapshots` table - Essential for ongoing index optimization
- ✅ `low_usage_indexes_30d` view - Critical for identifying cleanup candidates  
- ✅ `user_link_audit_purge_runs` table - Tracks audit retention operations
- ✅ `purge_user_link_audit()` functions - Prevents unbounded audit growth

### **What We Enable** 
- ✅ Daily index usage snapshots (3:05 AM)
- ✅ Weekly audit purge (Sunday 3:15 AM, 180-day retention)
- ✅ Daily ops cleanup (4:00 AM, 90-day retention for snapshots)

### **What We Remove/Skip**
- ❌ `partition_sightings` - No partitions exist, monitoring unnecessary
- ❌ Complex partition retention - No partitions to manage
- ❌ Heavy observability - Keep only essential monitoring

---

## 📊 **Rationale**

### **Why Minimal-Keep**

#### **High Value, Low Cost**
- **Index monitoring**: Critical for database performance optimization
- **Audit retention**: Prevents unbounded growth (1,065 rows currently)
- **Storage cost**: <1MB total for all monitoring tables
- **Maintenance**: Automated with minimal overhead

#### **Proven Need**
- **Wave 1 success**: Index usage data identified 2 unused indexes for safe removal
- **Wave 2 validation**: 161 indexes captured, 82 low-usage candidates identified
- **Future value**: 30-day trends will enable Wave 4 optimizations

#### **Operational Benefits**
- **Proactive monitoring**: Identify issues before they impact performance
- **Data-driven decisions**: Evidence-based index optimization
- **Audit compliance**: Retention policy prevents regulatory issues

### **Why Not Remove-Most/Remove-All**

#### **Remove-Most Risks**
- Lose index optimization capability
- Manual audit queries become maintenance burden
- No early warning system for performance regressions

#### **Remove-All Risks**  
- Complete loss of database hygiene automation
- Audit table growth becomes manual problem
- Future cleanup waves require rebuilding infrastructure

---

## 🔧 **Implementation Plan**

### **Phase 1: Enable Core Scheduling** ✅
```sql
-- Daily index snapshots @3:05 AM
SELECT cron.schedule('daily_index_usage_snapshot', '5 3 * * *', 
  $$SELECT public.capture_index_usage_snapshot();$$);

-- Weekly audit purge @3:15 AM Sunday (180-day retention)  
SELECT cron.schedule('weekly_audit_purge', '15 3 * * 0',
  $$SELECT public.run_user_link_audit_purge(180);$$);

-- Daily ops cleanup @4:00 AM (90-day snapshot retention)
SELECT cron.schedule('daily_ops_cleanup', '0 4 * * *',
  $$SELECT public.cleanup_index_snapshots(90);$$);
```

### **Phase 2: Remove Unnecessary Monitoring**
```sql
-- Remove partition sentinel (no partitions exist)
DROP VIEW IF EXISTS public.partition_sightings_recent;
DROP FUNCTION IF EXISTS public.scan_message_partitions();
DROP TABLE IF EXISTS public.partition_sightings;
```

---

## 📋 **Monitoring Schedule**

### **Daily Operations (Automated)**
- **3:05 AM**: Capture index usage snapshot (~161 indexes)
- **4:00 AM**: Cleanup old snapshots (keep 90 days)

### **Weekly Operations (Automated)**
- **Sunday 3:15 AM**: Purge old audit records (keep 180 days)

### **Monthly Reviews (Manual)**
- Review `low_usage_indexes_30d` for new cleanup candidates
- Check `user_link_audit_purge_runs` for retention health
- Validate index usage trends for performance optimization

---

## 🎯 **Success Metrics**

### **Storage Management**
- **Index snapshots**: ~90 days × 161 indexes = ~14K rows max
- **Audit purge logs**: ~52 entries per year (weekly runs)
- **Total overhead**: <1MB for all monitoring infrastructure

### **Operational Value**
- **Proactive optimization**: Identify unused indexes before they impact performance
- **Audit compliance**: Automated retention prevents unbounded growth
- **Performance insights**: 30-day trends enable data-driven decisions

### **Cost-Benefit Analysis**
- **Cost**: Minimal storage + 3 cron jobs
- **Benefit**: Automated database hygiene + performance optimization
- **ROI**: High - prevents manual audit work and performance issues

---

## ✅ **Decision Finalized**

**MINIMAL-KEEP approach selected for Wave 3:**
- Keep essential index monitoring and audit retention
- Enable lightweight daily/weekly automation  
- Remove unnecessary partition monitoring
- Maintain data-driven approach to database optimization

This provides the best balance of operational value, minimal overhead, and ongoing database health management.
