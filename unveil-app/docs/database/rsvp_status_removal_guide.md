# RSVP Status Column Removal Guide

**📅 Date**: September 30, 2025  
**🎯 Goal**: Complete removal of legacy `rsvp_status` column  
**📊 Status**: ✅ **MIGRATION COMPLETE** - Both phases deployed successfully  

---

## 🎯 **Overview**

The `rsvp_status` column has been removed from the `event_guests` table as part of the RSVP-Lite implementation. This guide documents the migration process and provides guidance for developers and analysts.

## 📊 **New RSVP Model**

### ✅ **Current (Post-Migration) Model**
```sql
-- RSVP Status Logic (Use This)
SELECT 
  guest_id,
  guest_name,
  CASE 
    WHEN declined_at IS NULL THEN 'ATTENDING'
    ELSE 'DECLINED' 
  END as rsvp_status,
  sms_opt_out -- For notification preferences
FROM event_guests
WHERE removed_at IS NULL;
```

### ❌ **Legacy (Removed) Model**
```sql
-- DON'T USE - Column removed
SELECT rsvp_status FROM event_guests; -- ❌ Will fail
```

---

## 🔄 **Migration Timeline**

### **Phase 1: Code Updates** ✅ COMPLETED
- **Date**: 2025-10-01  
- **Changes**: Updated RPC functions and UI components to use `declined_at`
- **Migration**: `20251001000000_phase1_update_rpc_use_declined_at.sql`
- **Impact**: Zero downtime, backward compatible
- **Status**: ✅ **DEPLOYED SUCCESSFULLY**

### **Phase 2: Column Removal** ✅ COMPLETED  
- **Date**: 2025-10-02
- **Changes**: Removed `rsvp_status` column, added compatibility view
- **Migration**: `20251002000000_phase2_remove_rsvp_status_column.sql`
- **Impact**: Schema change with instant rollback available
- **Status**: ✅ **DEPLOYED SUCCESSFULLY**

### **Phase 3: Compatibility View Sunset** 📅 SCHEDULED
- **Date**: 2025-10-30 (4 weeks after Phase 2)
- **Changes**: Remove `event_guests_rsvp_compat` view after analyst migration
- **Migration**: `20251030000000_sunset_rsvp_compat_view.sql`
- **Impact**: Analytics queries must use `declined_at` directly
- **Status**: 📅 **SCHEDULED** - Analysts have 4 weeks to migrate

---

## 👩‍💻 **For Developers**

### **RSVP Status Logic**
```typescript
// ✅ CORRECT - Use declined_at
function getRSVPStatus(guest: { declined_at?: string | null }): 'attending' | 'declined' {
  return guest.declined_at ? 'declined' : 'attending';
}

// ❌ INCORRECT - Column removed
function getRSVPStatus(guest: { rsvp_status?: string }): string {
  return guest.rsvp_status; // Will fail - column doesn't exist
}
```

### **Database Queries**
```sql
-- ✅ CORRECT - Filter by declined_at
SELECT * FROM event_guests 
WHERE event_id = $1 
  AND declined_at IS NULL; -- Attending guests

-- ✅ CORRECT - Count by status  
SELECT 
  COUNT(*) FILTER (WHERE declined_at IS NULL) as attending,
  COUNT(*) FILTER (WHERE declined_at IS NOT NULL) as declined
FROM event_guests 
WHERE event_id = $1 AND removed_at IS NULL;

-- ❌ INCORRECT - Column removed
SELECT * FROM event_guests WHERE rsvp_status = 'attending'; -- Will fail
```

### **Messaging Audience Logic**
```sql
-- ✅ CORRECT - Exclude declined guests
SELECT * FROM event_guests eg
WHERE eg.event_id = $1
  AND eg.declined_at IS NULL -- Attending guests only
  AND COALESCE(eg.sms_opt_out, false) = false; -- Not opted out

-- ❌ INCORRECT - Old logic
SELECT * FROM event_guests WHERE rsvp_status = 'attending'; -- Will fail
```

---

## 📊 **For Analysts**

### **Compatibility View Available**
```sql
-- ✅ Use this view for legacy queries
SELECT 
  *,
  rsvp_status_compat, -- Maps to declined_at logic
  is_attending,       -- declined_at IS NULL
  is_declined        -- declined_at IS NOT NULL
FROM event_guests_rsvp_compat
WHERE event_id = 'your-event-id';
```

### **Updated Analytics Queries**
```sql
-- ✅ RSVP Status Distribution
SELECT 
  event_id,
  COUNT(*) FILTER (WHERE declined_at IS NULL) as attending_count,
  COUNT(*) FILTER (WHERE declined_at IS NOT NULL) as declined_count,
  COUNT(*) as total_guests
FROM event_guests 
WHERE removed_at IS NULL
GROUP BY event_id;

-- ✅ SMS Notification Eligibility
SELECT 
  event_id,
  COUNT(*) FILTER (
    WHERE declined_at IS NULL 
    AND COALESCE(sms_opt_out, false) = false
    AND phone IS NOT NULL
  ) as sms_eligible_count
FROM event_guests
WHERE removed_at IS NULL  
GROUP BY event_id;
```

### **⚠️ IMPORTANT: Compatibility View Sunset**

**📅 Sunset Date**: October 30, 2025 (4 weeks after Phase 2)

The `event_guests_rsvp_compat` view will be **removed** on this date. All analytics queries must be migrated to use `declined_at` directly.

**Migration Required**:
```sql
-- ❌ WILL BREAK after 2025-10-30:
SELECT rsvp_status_compat FROM event_guests_rsvp_compat;

-- ✅ MIGRATE TO THIS:
SELECT 
  CASE WHEN declined_at IS NULL THEN 'ATTENDING' ELSE 'DECLINED' END as status
FROM event_guests 
WHERE removed_at IS NULL;
```

---

## 🚨 **CI Protection**

A GitHub Actions workflow prevents new `rsvp_status` usage:

```yaml
# .github/workflows/rsvp-status-guard.yml
# Automatically fails builds that reference removed column
```

**If you see this error:**
```
❌ RSVP Status Usage Detected!
The rsvp_status column has been removed from the database.
Please use declined_at instead.
```

**Fix by updating your code:**
- Replace `rsvp_status === 'attending'` with `declined_at === null`
- Replace `rsvp_status === 'declined'` with `declined_at !== null`

---

## 🔧 **Rollback Procedures**

### **Emergency Rollback (Phase 2 Only)**
If Phase 2 causes issues, run the rollback migration:

```sql
-- Restore rsvp_status column with backfilled data
\i supabase/migrations/20251002000001_rollback_phase2_restore_rsvp_status.sql
```

**Note**: Phase 1 cannot be rolled back via migration - requires code revert.

---

## 🧪 **Testing**

### **Verify Migration Success**
```sql
-- Should return error (column doesn't exist)
SELECT rsvp_status FROM event_guests LIMIT 1;

-- Should work (compatibility view)
SELECT rsvp_status_compat FROM event_guests_rsvp_compat LIMIT 1;

-- Should work (new logic)
SELECT 
  CASE WHEN declined_at IS NULL THEN 'ATTENDING' ELSE 'DECLINED' END
FROM event_guests LIMIT 1;
```

### **Test Audience Queries**
```sql
-- Should return same results as before migration
SELECT COUNT(*) FROM event_guests 
WHERE event_id = 'test-event' 
  AND declined_at IS NULL 
  AND COALESCE(sms_opt_out, false) = false;
```

---

## 📚 **Additional Resources**

- **Audit Report**: `audit/rsvp_semantics_20250930/rsvp_semantics_20250930.md`
- **Reference Analysis**: `audit/rsvp_status_onephase/refs_20250930.md`
- **Migration Plan**: `audit/rsvp_status_onephase/safe_two_phase_plan.md`
- **Phase 1 Tests**: `__tests__/integration/rsvp-status-removal-phase1.test.ts`

---

## ❓ **FAQ**

**Q: Why was rsvp_status removed?**
A: The RSVP-Lite model uses `declined_at` as the canonical source of truth. The `rsvp_status` column was redundant and could get out of sync.

**Q: What about pending/maybe statuses?**
A: In RSVP-Lite, guests are either attending (`declined_at IS NULL`) or declined (`declined_at IS NOT NULL`). Pending/maybe are treated as attending.

**Q: How do I handle SMS notifications?**
A: Use `sms_opt_out` field. Declining an event automatically sets `sms_opt_out = true`.

**Q: Will old analytics queries break?**
A: Use the `event_guests_rsvp_compat` view for legacy queries. It provides `rsvp_status_compat` field.

**Q: Can I still filter by RSVP status in messaging?**
A: Yes, but it now uses `declined_at` logic internally. The API remains the same.

---

**✅ Migration Complete**: The `rsvp_status` column has been successfully removed. Use `declined_at` for all RSVP logic going forward.
