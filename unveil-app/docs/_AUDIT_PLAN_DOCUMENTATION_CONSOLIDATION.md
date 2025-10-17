# 📋 Documentation Consolidation Audit Plan

**Date:** October 16, 2025  
**Objective:** Establish single canonical source of truth for Unveil engineering context  
**Status:** REVIEW PHASE (No changes made yet)

---

## 🔍 Executive Summary

### Current State
- **No canonical context document exists** at `/docs/context/unveil-product-eng-context.md`
- **Multiple overlapping documentation sources** create confusion
- **77+ report files** in `/docs/reports/` (many dated 2024-2025)
- **20+ audit files** in `/docs/audits/`
- **Existing archive structure** at `/docs/archive/` contains legacy docs

### Key Findings
✅ **GOOD:** Strong existing documentation structure in `/docs/README.md`  
✅ **GOOD:** Clear architecture docs (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`)  
⚠️ **CONCERN:** Many dated reports (2024-2025) could be archived  
⚠️ **CONCERN:** RLS documentation scattered across 6+ files  
⚠️ **CONCERN:** No single authoritative "context" document for AI tools

---

## 📊 Documentation Inventory

### Active Core Documentation (KEEP AS-IS)
```
docs/
├── README.md                          ✅ Strong hub document
├── architecture/
│   ├── ARCHITECTURE.md               ✅ Comprehensive, current
│   ├── DESIGN_SYSTEM.md              ✅ Active reference
│   ├── SECURITY.md                   ✅ Active reference
│   └── index.md                      ✅ Good index
├── development/
│   ├── DEVELOPMENT_GUIDE.md          ✅ Active guide
│   ├── DEPLOYMENT.md                 ✅ Active guide
│   └── IMMEDIATE_ACTION_REQUIRED.md  ✅ Recent (check date)
└── project/
    ├── SYSTEM_OVERVIEW.md            ✅ High-level, current
    ├── MVP_FEATURES.md               ✅ Feature specs
    └── index.md                      ✅ Good index
```

### Scattered/Redundant Documentation (CANDIDATES FOR ARCHIVE)

#### 1. RLS Documentation (6 files - REDUNDANT)
```
_artifacts/db_audit_20250930/rls_summary.md
_artifacts/avatar_audit/privacy_rls.md
_artifacts/appstore_audit_20251001/rls_touchpoints.md
docs/reviews/2025-09-26/db_rls_audit.md
docs/reports/db_rls_consolidation_20250924.md
docs/reports/rls_opt_20250115.md                    ← OLD (Jan 2025)
```
**RECOMMENDATION:** Archive all except most recent audit, reference `SECURITY.md` as canonical

#### 2. Reports Directory (77 files - MOSTLY OLD)
```
docs/reports/
├── docs_consolidation_plan_20250919.md      ← Sept 2024
├── docs_consolidation_results_20250919.md   ← Sept 2024
├── platform_readiness_20250915.md           ← Sept 2024
├── rls_opt_20250115.md                      ← Jan 2025
├── state_of_unveil_executive_20250925.md    ← Sept 2024
└── [70+ more dated reports]
```
**RECOMMENDATION:** Archive entire `/docs/reports/` directory to `/docs/_archive/reports_2024-2025/`

#### 3. Old Audits (candidates)
```
docs/audits/
├── repo-docs-and-migrations-audit.md        ← Check if superseded
├── linkcheck-failures.json                  ← Archive if old
└── security-definer-inventory-20250821.sql  ← Archive if historical
```

#### 4. Already Archived (GOOD)
```
docs/archive/project-docs-legacy/            ✅ Already archived
_backup/docs_folders/                        ✅ Already backed up
```

---

## 🎯 Proposed Canonical Structure

### NEW: Single Context Document
**Path:** `/docs/context/unveil-product-eng-context.md`

**Contents:**
```markdown
# Unveil Product & Engineering Context

## Purpose
Single canonical reference for AI tools (Cursor, MCP servers) and engineering onboarding.

## Quick Links
- **Architecture:** /docs/architecture/ARCHITECTURE.md
- **Schema:** /supabase/migrations/
- **RLS Policies:** /docs/architecture/SECURITY.md
- **Frontend Patterns:** /components/ and /hooks/
- **API Reference:** /lib/db/
- **Development:** /docs/development/DEVELOPMENT_GUIDE.md

## System Overview
[Concise 500-word summary linking to detailed docs]

## Schema Quick Reference
[Key tables, relationships - link to migrations]

## RLS Policy Summary
[High-level policy patterns - link to SECURITY.md]

## Frontend Architecture
[Component patterns, hooks, state management]

## Common Pitfalls & Solutions
[Known issues, debugging tips]

## Archive
Historical documentation: /docs/_archive/
```

### UPDATED: Root README Structure
**Path:** `/docs/README.md` (update existing)

Add section:
```markdown
## 🎯 Canonical Documentation

### For AI Tools & Onboarding
**📘 [Engineering Context](/docs/context/unveil-product-eng-context.md)** — Single source of truth

### For Specific Domains
- **Architecture:** `/docs/architecture/ARCHITECTURE.md`
- **Schema:** `/supabase/migrations/`
- **Security/RLS:** `/docs/architecture/SECURITY.md`
- **Development:** `/docs/development/DEVELOPMENT_GUIDE.md`

### Archives
- **Historical Reports:** `/docs/_archive/reports_2024-2025/`
- **Legacy Docs:** `/docs/archive/project-docs-legacy/`
```

---

## 📦 Archive Plan

### Phase 1: Create Archive Structure
```bash
docs/_archive/
├── reports_2024-2025/          # Move from /docs/reports/
├── audits_2024-2025/           # Move old audits from /docs/audits/
├── rls_historical/             # Consolidate scattered RLS docs
└── database_fixes_2024-2025/   # Historical database fixes
```

### Phase 2: Move Files (77+ files)

#### Move to `/docs/_archive/reports_2024-2025/`
- All files in `/docs/reports/` dated before October 2025
- Prepend comment: `<!-- ARCHIVED: superseded by /docs/context/unveil-product-eng-context.md -->`

#### Move to `/docs/_archive/audits_2024-2025/`
- `docs/audits/repo-docs-and-migrations-audit.md` (if outdated)
- `docs/audits/linkcheck-failures.json` (if old)
- Any completed audit reports

#### Move to `/docs/_archive/rls_historical/`
- `_artifacts/db_audit_20250930/rls_summary.md`
- `_artifacts/avatar_audit/privacy_rls.md`
- `_artifacts/appstore_audit_20251001/rls_touchpoints.md`
- `docs/reviews/2025-09-26/db_rls_audit.md`
- `docs/reports/db_rls_consolidation_20250924.md`
- `docs/reports/rls_opt_20250115.md`

#### Move to `/docs/_archive/database_fixes_2024-2025/`
- `docs/database/event-creation-schema-fix.md` (completed fix)
- Other completed database fix reports

### Phase 3: Add Archive Headers
Prepend to each archived file:
```markdown
<!-- 
ARCHIVED: [Date]
SUPERSEDED BY: /docs/context/unveil-product-eng-context.md
REASON: Historical report/audit completed
-->
```

---

## 🔧 Metadata Updates

### Files to Update

#### 1. `/docs/README.md`
✅ Already excellent structure  
➕ Add canonical context section  
➕ Add archive navigation

#### 2. Root `/README.md`
✅ Already links to `/docs/`  
🔍 Verify links point to active docs only

#### 3. `package.json`
🔍 Check for any doc references (unlikely)

#### 4. `.cursor/mcp.json`
✅ Already exists  
🔍 No changes needed (MCP connects to live DB)

#### 5. `tsconfig.json` / `tsconfig.docs.json`
🔍 Check if exists, update if needed

---

## ✅ Safety Checks

### Pre-Move Verification
- [ ] Confirm all files in move list are truly outdated
- [ ] Check for any broken internal links
- [ ] Verify no critical information exists only in reports
- [ ] Confirm git history preserves moved files

### Post-Move Verification
- [ ] All links in active docs resolve correctly
- [ ] Canonical context doc created and complete
- [ ] Archive headers added to all moved files
- [ ] `/docs/README.md` updated with new structure
- [ ] No 404s when following documentation trails

---

## 📏 Size Estimate

### Files to Archive
- **Reports:** ~77 files (mostly .md, some .json/.csv)
- **Old Audits:** ~10 files
- **RLS Docs:** 6 files
- **Database Fixes:** ~5 files
- **Total:** ~100 files to archive

### Disk Impact
- Archive size: ~5-10 MB (text files)
- No binary/media files involved
- Git history preserved (no data loss)

---

## 🚦 Rollback Strategy

### If Issues Arise
1. **Git revert:** All changes in single commit
2. **Manual restore:** Files copied, not deleted
3. **Backup location:** `.cursor/plan-backup/` (if Cursor creates)

### Rollback Command
```bash
git revert HEAD  # If committed
# OR
git reset --hard origin/main  # If not pushed
```

---

## 📋 Acceptance Criteria

### Done When...
1. ✅ **Canonical context exists:** `/docs/context/unveil-product-eng-context.md`
2. ✅ **All outdated docs archived:** `/docs/_archive/` structure complete
3. ✅ **Archive headers added:** All archived files have superseded comments
4. ✅ **Documentation updated:** `/docs/README.md` reflects new structure
5. ✅ **No conflicts:** Single authoritative path for each topic
6. ✅ **Links verified:** No broken internal documentation links
7. ✅ **Metadata current:** All project references point to canonical paths

---

## 🎯 Next Steps

### REVIEW PHASE (Current)
1. ✅ Audit complete - review this document
2. ⏳ **AWAITING USER APPROVAL** before making changes
3. ⏳ User confirms scope and file moves are safe

### EXECUTION PHASE (After Approval)
1. Create `/docs/context/` directory
2. Write canonical context document
3. Create archive directory structure
4. Move files with archive headers
5. Update `/docs/README.md`
6. Verify all links
7. Commit changes

---

## ⚠️ Important Notes

### What We're NOT Doing
- ❌ Deleting any documentation (archiving only)
- ❌ Modifying migration files or code
- ❌ Changing `.gitignore` patterns
- ❌ Touching active development docs

### What We ARE Doing
- ✅ Creating single canonical context doc
- ✅ Organizing historical reports
- ✅ Adding clear navigation
- ✅ Establishing documentation hygiene

---

**Status:** Ready for review and approval  
**Risk Level:** Low (archiving only, no deletions)  
**Reversibility:** High (git revert available)

