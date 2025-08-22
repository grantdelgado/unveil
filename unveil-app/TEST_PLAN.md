---
status: active
owner: development-team
last_reviewed: 2025-01-30
---

# Test Plan: Repository Hygiene & Security Fixes

**PR Summary**: Comprehensive fixes for SECURITY DEFINER vulnerabilities, migration conflicts, documentation restructure, and CI improvements.

## 🎯 Scope of Changes

### 1. Security Fixes ⚠️ CRITICAL
- **SECURITY DEFINER search_path vulnerabilities** - Added explicit `SET search_path = public, pg_temp`
- **Migration**: `supabase/migrations/20250130000010_fix_security_definer_search_path.sql`

### 2. Migration Hygiene 🗂️
- **Timestamp conflicts resolved** - Moved conflicting migrations to `supabase/migrations-archive/`
- **Baseline migration created** - `supabase/migrations/20250130000020_baseline_schema.sql`
- **Archive documentation** - Added `supabase/migrations-archive/README.md`

### 3. Documentation Restructure 📚
- **Canonical index** - Created `docs/README.md` as central navigation
- **Front-matter standardization** - Added status/owner/last_reviewed to key docs
- **Stale file archival** - Moved outdated docs to `docs/archive/stale-docs/`

### 4. CI/CD Quality Gates 🛡️
- **Markdown linting** - `.github/workflows/docs-quality.yml`
- **Link checking** - Validates internal and external links
- **PII detection** - Scans for new email/phone violations
- **Front-matter validation** - Ensures documentation metadata compliance

## 📋 Test Strategy

### Pre-Deployment Testing (Development)

#### 1. Database Migration Safety ⚠️ CRITICAL
```bash
# Test migration rollback capability
supabase db reset --local
supabase db push --local

# Verify all SECURITY DEFINER functions have search_path
supabase db inspect --local | grep -i "security definer" -A 5 -B 5

# Test function execution (should not fail)
supabase sql --local "SELECT add_or_restore_guest('test-event-id', '+1234567890')"
```

**Expected Results:**
- ✅ All migrations apply cleanly in correct order
- ✅ No SECURITY DEFINER functions without explicit search_path
- ✅ All RPC functions execute without privilege errors
- ✅ Rollback capability preserved

#### 2. Schema Consistency Validation
```bash
# Compare production schema to fresh migration result
supabase db diff production --local
```

**Expected Results:**
- ✅ No unexpected schema differences
- ✅ All tables, indexes, and constraints match
- ✅ RLS policies identical

#### 3. Documentation CI Testing
```bash
# Run locally before pushing
npm install -g markdownlint-cli2 markdown-link-check
markdownlint-cli2 "**/*.md"
python .github/scripts/pii-scanner.py
node .github/scripts/check-front-matter.js
```

**Expected Results:**
- ✅ No markdown linting errors
- ✅ No broken internal links
- ✅ No new PII violations
- ✅ All documentation has valid front-matter

### Production Deployment Testing

#### 1. Migration Safety Verification ⚠️ CRITICAL
```sql
-- Before migration: Verify current function count
SELECT COUNT(*) FROM information_schema.routines 
WHERE routine_schema = 'public' AND security_type = 'DEFINER';

-- After migration: Verify all functions have search_path
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND security_type = 'DEFINER'
  AND routine_definition NOT LIKE '%search_path%';
```

**Expected Results:**
- ✅ Zero functions without search_path protection
- ✅ All existing functions continue to work
- ✅ No privilege escalation vulnerabilities

#### 2. Application Functionality Testing
```bash
# Test critical RPC functions
curl -X POST "$SUPABASE_URL/rest/v1/rpc/get_guest_event_messages" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_event_id": "test-event-id"}'

# Test guest management functions
curl -X POST "$SUPABASE_URL/rest/v1/rpc/add_or_restore_guest" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_event_id": "test-event-id", "p_phone": "+1234567890"}'
```

**Expected Results:**
- ✅ All RPC functions return expected results
- ✅ No authentication or authorization errors
- ✅ Response times within normal ranges

### CI/CD Pipeline Verification

#### 1. Documentation Quality Gates
- **Trigger**: Push to any `*.md` file
- **Checks**: Markdown linting, link validation, PII scanning, front-matter
- **Expected**: ✅ All checks pass on this PR

#### 2. Migration Safety Checks
- **Trigger**: Changes to `supabase/migrations/`  
- **Checks**: SQL linting, migration ordering, rollback validation
- **Expected**: ✅ Clean migration path validated

## 🔍 Risk Assessment

### HIGH RISK - Requires Careful Monitoring

1. **SECURITY DEFINER Function Changes** ⚠️
   - **Risk**: Function execution failures due to search_path restrictions
   - **Mitigation**: Comprehensive pre-deployment testing of all RPC functions
   - **Rollback**: Immediate rollback capability via migration reversal

2. **Migration Timestamp Changes** ⚠️
   - **Risk**: Fresh deployments might have different schema than production
   - **Mitigation**: Baseline migration ensures consistency
   - **Rollback**: Restore archived migrations if needed

### MEDIUM RISK - Standard Monitoring

3. **Documentation Restructure** 📚
   - **Risk**: Broken internal links, navigation confusion
   - **Mitigation**: Automated link checking, comprehensive index
   - **Rollback**: Revert documentation changes independently

4. **CI/CD Pipeline Changes** 🛡️
   - **Risk**: False positives blocking legitimate changes
   - **Mitigation**: Baseline for existing violations, exemption patterns
   - **Rollback**: Disable specific checks if needed

### LOW RISK - Normal Operations

5. **Archive Operations** 🗂️
   - **Risk**: Minimal - only affects development workflow
   - **Mitigation**: Clear documentation of archived content
   - **Rollback**: Restore files from archive directory

## ✅ Success Criteria

### Functional Requirements
- [ ] All database migrations apply successfully
- [ ] All SECURITY DEFINER functions execute correctly
- [ ] No application functionality regressions
- [ ] All RPC functions return expected results

### Security Requirements  
- [ ] Zero SECURITY DEFINER functions without search_path protection
- [ ] No privilege escalation vulnerabilities detected
- [ ] PII scanning prevents new violations
- [ ] All security audit findings resolved

### Quality Requirements
- [ ] Documentation CI passes all checks
- [ ] No broken internal links in documentation
- [ ] All new documentation has proper front-matter
- [ ] Migration ordering is deterministic

### Operational Requirements
- [ ] Rollback capability preserved and tested
- [ ] Production monitoring shows normal performance
- [ ] No increase in error rates or response times
- [ ] CI/CD pipeline operates reliably

## 🔄 Rollback Procedures

### Database Rollback (if needed)
```sql
-- Emergency rollback of SECURITY DEFINER changes
-- (Full SQL provided in migration file comments)
CREATE OR REPLACE FUNCTION public.add_or_restore_guest(...)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
-- Remove: SET search_path = public, pg_temp
AS $$ ... $$;
```

### Documentation Rollback
```bash
# Revert documentation changes
git revert <commit-hash>

# Restore archived files if needed
mv docs/archive/stale-docs/* docs/development/
```

### CI/CD Rollback
```bash
# Disable problematic checks temporarily
# Edit .github/workflows/docs-quality.yml
# Comment out failing job sections
```

## 📊 Monitoring & Validation

### Post-Deployment Monitoring (24 hours)

1. **Database Performance**
   - Query response times for RPC functions
   - Error rates in application logs
   - Connection pool utilization

2. **Application Functionality**
   - User authentication success rates
   - Message sending/receiving functionality
   - Guest management operations

3. **Security Posture**
   - No privilege escalation attempts logged
   - All function calls properly scoped
   - RLS policies functioning correctly

### Long-term Monitoring (1 week)

1. **Documentation Quality**
   - CI pipeline success rates
   - Developer feedback on documentation usability
   - Link health over time

2. **Migration Stability**
   - Fresh deployment success rates
   - Development environment setup reliability
   - Schema consistency validation

---

**Test Plan Version**: 1.0  
**Created**: January 30, 2025  
**Owner**: Development Team  
**Review Cycle**: Before each similar change
