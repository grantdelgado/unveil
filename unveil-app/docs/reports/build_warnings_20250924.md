# Next.js Build Warnings Report
**Generated:** September 24, 2025  
**Build Command:** `NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 pnpm build`  
**Next.js Version:** 15.3.4  
**Build Status:** ✅ Success with warnings  

## Executive Summary

- **Total Warnings:** 10
- **Our Code:** 10 warnings (100%)
- **Vendor Code:** 0 warnings (0%)
- **Categories:** 
  - Asset Size: 2 warnings
  - Entrypoint Size: 1 warning  
  - Deprecated API: 6 warnings
  - React Hooks: 2 warnings

## Warning Details

### Asset Size Warnings (2)
**Category:** Performance/Bundle Size  
**Source:** Our code (webpack output)  
**Impact:** Medium - affects web performance

#### 1. Large Asset Bundles
- **static/chunks/main-c39f2c9af2cca9ec.js** (366 KiB) - exceeds 215 KiB limit
- **static/chunks/2042-f3f5b41c0e28a0a4.js** (391 KiB) - exceeds 215 KiB limit

**Context:** Two main chunks exceed Next.js recommended size limits, potentially impacting initial load performance.

---

### Entrypoint Size Warnings (1) 
**Category:** Performance/Bundle Size  
**Source:** Our code (webpack output)  
**Impact:** Medium - affects web performance

#### 1. Large Entrypoints
Multiple entrypoints exceed the recommended 244 KiB limit:
- **main** (549 KiB)
- **main-app** (676 KiB)
- **app/(auth)/login/page** (307 KiB)
- **app/host/events/[eventId]/details/page** (342 KiB)
- **app/guest/events/[eventId]/home/page** (339 KiB)
- **app/host/events/create/page** (319 KiB)
- **app/host/events/[eventId]/dashboard/page** (315 KiB)
- **app/host/events/[eventId]/edit/page** (303 KiB)
- **app/(auth)/select-event/page** (297 KiB)
- **app/guest/events/[eventId]/schedule/page** (288 KiB)

**Context:** Large entrypoints indicate potential for code splitting optimization.

---

### Deprecated API Warnings (6)
**Category:** Legacy Code/API Deprecation  
**Source:** Our code  
**Impact:** Low - functional but needs migration  

#### 1-2. GuestImportStep.tsx
- **File:** `./components/features/events/GuestImportStep.tsx`
- **Lines:** 588:20, 590:24
- **Rule:** `no-restricted-syntax`
- **Message:** Legacy analytics fields `delivered_count` and `failed_count`. Consider migrating to `message_deliveries` table for new features.

#### 3-6. RecentMessages.tsx
- **File:** `./components/features/messaging/host/RecentMessages.tsx`
- **Lines:** 459:25, 459:54, 460:22, 461:22  
- **Rule:** `no-restricted-syntax`
- **Message:** Legacy analytics fields `delivered_count` and `failed_count`. Consider migrating to `message_deliveries` table for new features.

#### 7-8. eventCreation.ts
- **File:** `./lib/services/eventCreation.ts`
- **Lines:** 677:22, 705:25
- **Rule:** `no-restricted-syntax`  
- **Message:** Legacy analytics fields `delivered_count` and `failed_count`. Consider migrating to `message_deliveries` table for new features.

**Context:** All deprecated API warnings relate to legacy analytics fields that should be migrated to a new table structure.

---

### React Hooks Warnings (2)
**Category:** React Best Practices  
**Source:** Our code  
**Impact:** Low - potential for stale closures

#### 1-2. CSVImportModal.tsx  
- **File:** `./components/features/guests/CSVImportModal.tsx`
- **Lines:** 185:6, 308:6
- **Rule:** `react-hooks/exhaustive-deps`
- **Message:** React Hook `useCallback` has a missing dependency: 'handleError'. Either include it or remove the dependency array.

**Context:** Missing dependencies in useCallback hooks could lead to stale closures and unexpected behavior.

## Suggested Next Steps

### Immediate Actions (Priority: High)
1. **Bundle Size Optimization**
   - **Code splitting:** Implement dynamic imports for large components
   - **Tree shaking:** Review and remove unused imports/code
   - **Lazy loading:** Use `React.lazy()` for non-critical components
   - **Bundle analysis:** Run `pnpm build --analyze` to identify large dependencies

### Short Term (Priority: Medium)  
2. **Fix React Hooks Dependencies**
   - Add `handleError` to dependency arrays in `CSVImportModal.tsx`
   - Use `useCallback` for `handleError` if it changes frequently
   - Consider `useEvent` pattern if available

3. **Migrate Deprecated Analytics Fields**
   - Create migration plan for `message_deliveries` table structure
   - Update queries in:
     - `components/features/events/GuestImportStep.tsx`
     - `components/features/messaging/host/RecentMessages.tsx` 
     - `lib/services/eventCreation.ts`
   - Remove ESLint rule exceptions after migration

### Long Term (Priority: Low)
4. **Performance Monitoring**
   - Set up bundle size monitoring in CI/CD
   - Implement performance budgets
   - Consider server-side rendering optimizations

## Raw Build Log
The complete build output is available at:  
`/docs/reports/warnings/build_raw_20250924.log`

---
*Report generated automatically from Next.js production build output*
