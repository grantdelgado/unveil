# Warnings Triage Report
*Generated on 9/23/2025, 7:29:05 PM*

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total Warnings** | 29 |
| **P0 (Critical)** | 15 |
| **P1 (High)** | 13 |
| **P2 (Medium)** | 1 |

### Risk Assessment
🔴 **HIGH RISK** - Multiple critical issues need immediate action

**Key Concerns:**
- 8 deprecation warnings (may break in future versions)
- 18 performance warnings (bundle size/runtime)


### Tool Breakdown
| Tool | Count | Status |
|------|-------|--------|
| next | 11 | 🟠 Some issues |
| webpack | 2 | 🟡 Few issues |
| perf | 16 | 🟠 Some issues |


---

## Top Risks (P0)

### 1. PERF: Bundle size 319 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /guest/events/[eventId]/home  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 2. PERF: Bundle size 311 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/[eventId]/dashboard  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 3. PERF: Bundle size 315 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/[eventId]/details  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 4. PERF: Bundle size 305 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/[eventId]/edit  
**Frequency:** 2x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 5. PERF: Bundle size 285 KB exceeds error threshold (200 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/[eventId]/messages  
**Frequency:** 2x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 6. PERF: Bundle size 294 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/[eventId]/schedule  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 7. PERF: Bundle size 309 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /host/events/create  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 8. PERF: Bundle size 304 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /select-event  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 9. PERF: Bundle size 290 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /setup  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---

### 10. PERF: Bundle size 303 KB exceeds error threshold (250 KB)...

**Tool:** perf  
**File:** N/A  
**Route:** /guest/events/[eventId]/schedule  
**Frequency:** 1x  
**Owner:** platform-team  

**Recommended Action:**
Optimize performance bottleneck

**Effort:** L | **Impact:** High

---



---

## Priority Breakdown

### P0 - Critical Issues (15)
*Must fix immediately - potential production impact*

#### PERF (15)

- **perf**: Bundle size 319 KB exceeds error threshold (250 KB)
  - File: `N/A`
  - Route: `/guest/events/[eventId]/home`
  - Action: Optimize performance bottleneck

- **perf**: Bundle size 311 KB exceeds error threshold (250 KB)
  - File: `N/A`
  - Route: `/host/events/[eventId]/dashboard`
  - Action: Optimize performance bottleneck

- **perf**: Bundle size 315 KB exceeds error threshold (250 KB)
  - File: `N/A`
  - Route: `/host/events/[eventId]/details`
  - Action: Optimize performance bottleneck

- **perf**: Bundle size 305 KB exceeds error threshold (250 KB)
  - File: `N/A`
  - Route: `/host/events/[eventId]/edit`
  - Action: Optimize performance bottleneck

- **perf**: Bundle size 285 KB exceeds error threshold (200 KB)
  - File: `N/A`
  - Route: `/host/events/[eventId]/messages`
  - Action: Optimize performance bottleneck

  *... and 10 more perf warnings*



### P1 - High Priority (13)
*Should fix in current sprint - quality/performance impact*

#### DEPRECATION (8)

- **next**: 588:20  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.  no-restricted-syntax
  - File: `N/A`
  - Action: Migrate to new API before removal deadline

- **next**: 590:24  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.  no-restricted-syntax
  - File: `N/A`
  - Action: Migrate to new API before removal deadline

- **next**: 459:25  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.  no-restricted-syntax
  - File: `N/A`
  - Action: Migrate to new API before removal deadline

- **next**: 459:54  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.  no-restricted-syntax
  - File: `N/A`
  - Action: Migrate to new API before removal deadline

- **next**: 460:22  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_count. Consider migrating to message_deliveries table for new features.  no-restricted-syntax
  - File: `N/A`
  - Action: Migrate to new API before removal deadline

  *... and 3 more deprecation warnings*

#### REACT (2)

- **next**: 185:6  Warning: React Hook useCallback has a missing dependency: 'handleError'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
  - File: `N/A`
  - Action: Fix React warning/error

- **next**: 308:6  Warning: React Hook useCallback has a missing dependency: 'handleError'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
  - File: `N/A`
  - Action: Fix React warning/error

#### PERF (3)

- **webpack**: asset size limit: The following asset(s) exceed the recommended size limit (215 KiB).
  - File: `N/A`
  - Action: Optimize performance bottleneck

- **webpack**: entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  - File: `N/A`
  - Action: Optimize performance bottleneck

- **perf**: Average bundle size 294.2 KB is high (>200 KB)
  - File: `N/A`
  - Action: Split bundle or lazy load components



### P2 - Medium Priority (1)
*Fix when convenient - maintenance/technical debt*

#### OTHER (1)

- **next**: ⚠ Compiled with warnings in 9.0s
  - File: `N/A`
  - Action: Review and address warning




---

## Category Analysis

| Category | Count | Risk Level | Recommended Timeline |
|----------|-------|------------|---------------------|
| deprecation | 8 | 🔴 High | 1-2 sprints |
| react | 2 | 🟠 Medium | 1-3 sprints |
| other | 1 | 🟡 Low | Backlog |
| perf | 18 | 🟠 Medium | 2-3 sprints |

### Category Definitions

- **security**: Security vulnerabilities or unsafe patterns
- **deprecation**: APIs/features scheduled for removal
- **perf**: Performance issues (bundle size, runtime)
- **runtime**: Browser console errors/warnings
- **react**: React-specific warnings and errors
- **type**: TypeScript type issues and `any` usage
- **a11y**: Accessibility compliance issues
- **docs**: Documentation formatting and structure
- **lint**: Code style and linting issues
- **config**: Configuration and build setup warnings
- **other**: Miscellaneous warnings

---

## Action Playbook

### Next.js/Webpack Performance
- **Bundle size > 250KB**: Split into smaller chunks using `dynamic()`
- **Asset optimization**: Compress images, optimize fonts
- **Modular imports**: Use tree-shaking friendly imports

### TypeScript Issues
- **`any` types**: Add proper type definitions
- **Missing types**: Enable stricter TypeScript options
- **Type errors**: Review and fix type mismatches

### React Warnings
- **useEffect deps**: Add missing dependencies or use `useCallback`
- **Key props**: Add stable keys to list items
- **Hydration**: Ensure server/client markup matches

### ESLint Warnings
- **Autofix**: Run `pnpm lint:fix` for style issues
- **Custom rules**: Review deprecated API usage warnings
- **React hooks**: Fix dependency arrays and hook usage

### Deprecation Warnings
- **Check migration guides**: Review Next.js, React, Supabase docs
- **Timeline**: Plan migration before removal deadlines
- **Testing**: Thoroughly test after API changes

### Performance Monitoring
- **Bundle analyzer**: Use `pnpm build:analyze` for detailed analysis
- **Lighthouse**: Regular performance audits
- **Monitoring**: Set up alerts for bundle size regressions

---

## Tool-Specific Findings

### NEXT (11 warnings)

**Top Issues:**
1. [P1] 588:20  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_...
2. [P1] 590:24  Warning: DEPRECATED: Legacy analytics fields delivered_count and failed_...
3. [P1] 185:6  Warning: React Hook useCallback has a missing dependency: 'handleError'. ...

**Recommended Next Steps:**
- Run bundle analyzer to identify large dependencies
- Consider code splitting for heavy routes
- Optimize image and font loading

### WEBPACK (2 warnings)

**Top Issues:**
1. [P1] asset size limit: The following asset(s) exceed the recommended size limit (215 ...
2. [P1] entrypoint size limit: The following entrypoint(s) combined asset size exceeds t...

**Recommended Next Steps:**
- Run bundle analyzer to identify large dependencies
- Consider code splitting for heavy routes
- Optimize image and font loading

### PERF (16 warnings)

⚠️ **15 critical issues requiring immediate attention**

**Top Issues:**
1. [P0] Bundle size 319 KB exceeds error threshold (250 KB)...
2. [P0] Bundle size 311 KB exceeds error threshold (250 KB)...
3. [P0] Bundle size 315 KB exceeds error threshold (250 KB)...

**Recommended Next Steps:**
- Address bundle size budget violations
- Optimize large route chunks
- Monitor performance regressions



---

## Trends & Patterns

### Frequent Problem Areas



---

## Appendices

### A. Data Sources
This report aggregated warnings from:
- build_2025-09-24T00-27.json
- eslint_2025-09-24T00-21.json
- eslint_2025-09-24T00-28.json
- perf_2025-09-24T00-28.json
- playwright_2025-09-24T00-28.json
- typecheck_2025-09-24T00-21.json
- typecheck_2025-09-24T00-28.json
- vitest_2025-09-24T00-28.json

### B. Methodology
- **Prioritization**: P0 ≥70 points, P1 ≥40 points, P2 <40 points
- **Scoring Factors**: Severity, category impact, frequency, file/route importance
- **Deduplication**: By tool + code + message + file + line
- **Classification**: Automated with manual review recommended

### C. Export Formats
- **Full CSV**: `warnings_triage_20250924.csv`
- **JSON Data**: Available in `docs/reports/warnings/`

---

*Report generated by Unveil Warnings Triage System*
*Next suggested run: 9/30/2025*