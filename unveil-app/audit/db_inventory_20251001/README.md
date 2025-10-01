# Database Inventory Audit - October 1, 2025

## 📋 **Deliverables Summary**

This directory contains a comprehensive read-only audit of the Postgres schema conducted on October 1, 2025.

### **Core Reports**
- **`db_audit_report.md`** - Executive summary with top decommission candidates and recommendations
- **`db_gap_matrix.csv`** - Detailed object-by-object analysis with effort/impact/confidence ratings
- **`code_refs.md`** - Codebase linkage analysis showing which objects are actively used

### **Raw Data Files**
- **`inventory_relations.csv`** - All tables/views with sizes and row estimates
- **`inventory_indexes.csv`** - Index definitions and storage usage
- **`unused_indexes.csv`** - Indexes with zero scan activity (removal candidates)
- **`activity_tables.csv`** - Table access patterns and maintenance stats
- **`policies.csv`** - RLS policy inventory by table
- **`foreign_keys.csv`** - Foreign key relationships
- **`enums.csv`** - Enumerated types and their values

### **Key Findings**

#### ✅ **Safe to Remove (High Confidence)**
- **9 partition tables**: `messages_2025_09_26` through `messages_2025_10_04`
- **25+ unused indexes**: Various auth and obsolete RSVP indexes
- **Storage savings**: ~200KB+ immediate cleanup

#### ⚠️ **Review Required**
- **`rum_p75_7d` view**: SECURITY DEFINER configuration
- **`user_link_audit` table**: 929 rows, audit-only usage
- **80+ SECURITY DEFINER functions**: Search path validation

#### ✅ **Keep (Core Business Logic)**
- **`events`, `users`, `event_guests`, `messages`**: High activity, extensive code usage
- **All RLS policies**: Comprehensive security coverage
- **Core indexes**: Well-utilized with high scan counts

### **Audit Methodology**

1. **Schema Analysis**: Queried `pg_class`, `pg_stat_user_tables`, `pg_policies`
2. **Usage Patterns**: Analyzed index scans, table access, vacuum/analyze history
3. **Code Linkage**: Grepped codebase for direct table/RPC references
4. **Risk Assessment**: Combined database stats with application usage evidence

### **Next Steps**

1. Review `db_audit_report.md` for executive summary
2. Use `db_gap_matrix.csv` for prioritized cleanup planning
3. Verify findings against `code_refs.md` before any removals
4. Test rollback procedures in staging environment

### **Audit Scope**
- **Database**: Unveil App Production Instance
- **Method**: Read-only queries via Supabase MCP
- **Coverage**: All public schema objects (tables, views, indexes, functions, policies)
- **PII Protection**: No raw data extracted, counts and metadata only

**Generated**: October 1, 2025  
**Audit Duration**: ~45 minutes  
**Total Objects Analyzed**: 100+ database objects across 10 categories
