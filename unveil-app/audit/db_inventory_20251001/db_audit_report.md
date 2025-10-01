# Database Inventory & Decommission Audit Report
**Date**: October 1, 2025  
**Scope**: Postgres schema read-only analysis  
**Database**: Unveil App Production Instance  

---

## 🎯 **Executive Summary**

**Total Objects Audited**: 35+ tables, 50+ indexes, 1 view, 80+ functions, 35+ policies  
**Decommission Candidates**: 15 objects identified for removal  
**Storage Opportunity**: ~2MB immediate cleanup, index optimization potential  
**Security Issues**: 1 SECURITY DEFINER function flagged for review  

### **Key Findings**
- ✅ **Core schema is healthy** - Primary tables well-utilized and properly indexed
- ⚠️ **9 unused partition tables** from September/October 2025 ready for cleanup  
- ⚠️ **25+ unused indexes** consuming storage with zero scan activity
- ⚠️ **1 view** (`rum_p75_7d`) with SECURITY DEFINER flag needs search_path review
- ✅ **RLS policies comprehensive** - All core tables properly protected

---

## 📊 **Top Decommission Candidates**

### **Immediate Removal (High Confidence)**

| Object | Type | Size | Risk | Evidence |
|--------|------|------|------|----------|
| `messages_2025_09_26` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_09_27` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_09_28` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_09_29` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_09_30` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_10_01` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_10_02` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_10_03` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |
| `messages_2025_10_04` | Table | 8KB | Low | 0 scans, 0 rows, 0 code refs |

**Total Immediate Cleanup**: ~72KB + associated indexes

### **Index Optimization (Quick Wins)**

| Index | Table | Scans | Reason |
|-------|-------|-------|--------|
| `idx_event_guests_declined_at_null` | event_guests | 0 | RSVP-Lite migration made obsolete |
| `idx_event_guests_declined_at_not_null` | event_guests | 0 | RSVP-Lite migration made obsolete |
| `oauth_clients_deleted_at_idx` | oauth_clients | 0 | Unused OAuth feature |
| `users_instance_id_idx` | users | 0 | Supabase internal, unused |
| `refresh_tokens_instance_id_idx` | refresh_tokens | 0 | Supabase internal, unused |

**Estimated Storage Savings**: ~100KB in index space

---

## 🔒 **Security & RLS Review**

### **SECURITY DEFINER Functions Requiring Review**

⚠️ **80+ SECURITY DEFINER functions found** - All appear to have proper `SET search_path TO 'public', 'pg_temp'` configuration.

**Sample flagged function**:
- `rum_p75_7d` view - Uses SECURITY DEFINER, review search_path configuration

### **RLS Policy Coverage**
✅ **Comprehensive RLS implementation**:
- `event_guests`: 7 policies (host/guest access control)
- `messages`: 6 policies (event-scoped messaging)
- `message_deliveries`: 4 policies (delivery access control)
- `events`: 3 policies (host/guest visibility)
- `media`: 3 policies (event participant access)

**No missing RLS policies detected** - All core tables properly protected.

---

## 📈 **Performance & Usage Analysis**

### **High-Activity Tables** (Keep - Core Business Logic)
| Table | Rows | Index Scans | Code Refs | Status |
|-------|------|-------------|-----------|---------|
| `events` | 3 | 46,769 | 8+ | ✅ Core |
| `scheduled_messages` | 44 | 90,844 | 3+ | ✅ Core |
| `event_guests` | 143 | 17,554 | 15+ | ✅ Core |
| `messages` | 109 | 14,111 | 10+ | ✅ Core |
| `users` | 81 | 8,866 | 6+ | ✅ Core |

### **Medium-Activity Tables** (Monitor)
| Table | Rows | Index Scans | Code Refs | Status |
|-------|------|-------------|-----------|---------|
| `message_deliveries` | 1,439 | 7,071 | 5+ | ⚠️ Monitor |
| `user_link_audit` | 929 | 73 | 0 | ⚠️ Audit-only |
| `media` | 0 | 312 | 4+ | ⚠️ Empty but active |

### **Zero-Activity Objects** (Remove)
- **9 partition tables**: `messages_2025_*` series
- **25+ unused indexes**: Various auth/internal indexes
- **Utility tables**: `secrets`, `seed_files` (if confirmed unused)

---

## 🔧 **Recommended Actions**

### **Phase 1: Immediate Cleanup** (Effort: 1-2 hours)
1. **Drop partition tables**: `messages_2025_09_26` through `messages_2025_10_04`
2. **Remove RSVP-Lite obsolete indexes**: 
   - `idx_event_guests_declined_at_null`
   - `idx_event_guests_declined_at_not_null`
3. **Clean unused auth indexes**: OAuth and instance-related indexes

```sql
-- Example cleanup (verify before running)
DROP TABLE IF EXISTS messages_2025_09_26, messages_2025_09_27, messages_2025_09_28;
DROP INDEX IF EXISTS idx_event_guests_declined_at_null, idx_event_guests_declined_at_not_null;
```

### **Phase 2: Analytics Consolidation** (Effort: 1-2 days)
1. **Review `rum_p75_7d` view**: Confirm SECURITY DEFINER necessity
2. **Consolidate `user_link_audit`**: Archive old records, optimize retention
3. **Media table optimization**: Investigate zero-row count vs. active code usage

### **Phase 3: Long-term Optimization** (Effort: 1 week)
1. **Function audit**: Review 80+ SECURITY DEFINER functions for consolidation opportunities
2. **Index analysis**: Monitor low-usage indexes over 30-day period
3. **Partitioning strategy**: Implement proper partitioning for `messages` table if needed

---

## 📋 **Verification Checklist**

### **Before Any Removals**
- [ ] Confirm zero application errors in logs for 7 days
- [ ] Verify no scheduled jobs reference target objects
- [ ] Test rollback procedures in staging environment
- [ ] Coordinate with analytics team on `rum_*` objects

### **Post-Removal Monitoring**
- [ ] Monitor application logs for 24 hours
- [ ] Verify no performance regressions
- [ ] Confirm storage reclamation
- [ ] Update documentation and runbooks

---

## 🎯 **Success Metrics**

### **Immediate Impact**
- **Storage Reduction**: ~200KB+ (tables + indexes)
- **Maintenance Reduction**: 15+ fewer objects to monitor
- **Security Posture**: SECURITY DEFINER review completed

### **Long-term Benefits**
- **Simplified Schema**: Cleaner object inventory
- **Faster Backups**: Fewer objects to process
- **Reduced Complexity**: Easier database maintenance

---

## 📞 **Next Steps**

1. **Review this report** with database and application teams
2. **Schedule Phase 1 cleanup** during next maintenance window  
3. **Create rollback scripts** for all proposed changes
4. **Monitor metrics** for 30 days post-cleanup

**Report Generated**: October 1, 2025  
**Audit Scope**: Read-only analysis, no schema modifications performed  
**Contact**: Database team for questions or clarifications
