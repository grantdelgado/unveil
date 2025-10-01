# RUM P75 7D Object Analysis

**Date**: October 2, 2025  
**Object**: `public.rum_p75_7d`  
**Investigation**: RUMP757D / rum_p75_7d clarification

---

## 🔍 **Object Identification**

### **What It Is**
- **Type**: View (not table or function)
- **Schema**: `public.rum_p75_7d`
- **Size**: 0 bytes (computed view)
- **Security**: Regular view (NOT SECURITY DEFINER)

### **Definition**
```sql
CREATE VIEW public.rum_p75_7d AS
SELECT 
  rum_events.route,
  rum_events.metric,
  percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY (rum_events.value::double precision)) AS p75,
  count(*) AS n,
  avg(rum_events.value) AS avg_value,
  min(rum_events.value) AS min_value,
  max(rum_events.value) AS max_value
FROM rum_events
WHERE rum_events.ts > (now() - '7 days'::interval)
GROUP BY rum_events.route, rum_events.metric
ORDER BY rum_events.route, rum_events.metric;
```

### **Purpose**
**Real User Monitoring (RUM) Analytics View**
- Calculates 75th percentile performance metrics over 7-day rolling window
- Aggregates performance data from `rum_events` table
- Provides statistical summary: P75, average, min, max, count

---

## 📊 **Usage Analysis**

### **Code References** (from `code_refs.md`)
Found **2 active references**:

1. **`app/api/rum/route.ts`** - Performance dashboard API
   ```typescript
   let query = supabase.from('rum_p75_7d').select('*');
   ```

2. **`scripts/rum-report.ts`** - Analytics reporting script
   ```typescript
   let query = supabase.from('rum_p75_7d').select('*');
   ```

### **Dependencies**
- **Depends on**: `rum_events` table (120 rows, 24KB)
- **No dependents**: No other objects depend on this view

### **Access Pattern**
- **API endpoint**: Used by performance dashboard
- **Reporting**: Analytics script consumption
- **Frequency**: Unknown (likely dashboard queries)

---

## 🎯 **Keep/Drop Recommendation**

### **RECOMMENDATION: KEEP** 

**Rationale**:
- ✅ **Active usage**: 2 code references in production API and reporting
- ✅ **Performance value**: Provides essential RUM analytics for app monitoring
- ✅ **Low cost**: View has 0 storage cost, computes on demand
- ✅ **No security risk**: Regular view, not SECURITY DEFINER

**Risk Assessment**:
- **Risk if removed**: HIGH - Would break performance dashboard API
- **Effort to maintain**: LOW - View requires no maintenance
- **Impact**: MEDIUM - Performance monitoring would be lost

### **Previous Audit Confusion**
The initial audit incorrectly flagged this as a SECURITY DEFINER issue:
- **Reality**: It's a regular view, not SECURITY DEFINER
- **Cause**: Audit may have confused it with a function or misread catalog
- **Resolution**: No security fix needed

---

## 📋 **Action Items**

### **Immediate**
- ✅ **Keep the view** - Essential for performance monitoring
- ✅ **No changes needed** - View is properly configured

### **Future Considerations**
- **Monitor usage**: Track dashboard API calls to confirm ongoing value
- **Optimize if needed**: Consider materialized view if query becomes expensive
- **Document**: Add to performance monitoring documentation

---

## 🔧 **Technical Details**

### **Performance Characteristics**
- **Computation**: Aggregates last 7 days of `rum_events` on each query
- **Cost**: Depends on `rum_events` table size (currently 120 rows)
- **Optimization**: Could be materialized if performance becomes an issue

### **Data Flow**
```
rum_events (raw metrics) → rum_p75_7d (7-day aggregates) → Dashboard API
```

### **Security Posture**
- **Access**: Follows standard RLS policies (if any on rum_events)
- **No elevation**: Regular view with no special permissions
- **Safe**: No search_path or SECURITY DEFINER concerns

---

## ✅ **Conclusion**

**`rum_p75_7d` is a legitimate, actively-used performance monitoring view that should be KEPT.**

The initial audit confusion about SECURITY DEFINER was incorrect - this is a standard view providing essential RUM analytics for the application's performance dashboard.

**No action required for this object in Wave 3.**
