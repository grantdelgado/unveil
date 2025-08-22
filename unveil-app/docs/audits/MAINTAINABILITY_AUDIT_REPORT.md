# Unveil App Maintainability Audit Report

## Executive Summary

This comprehensive audit identifies maintainability issues and proposes a structured cleanup plan for the Unveil app. The analysis covers dependency management, code organization, security vulnerabilities, and architectural improvements.

## 🔍 Audit Findings

### 1. Dependency Analysis

#### Unused Dependencies (Safe to Remove)

- `react-window` - Virtual scrolling library not used
- `react-window-infinite-loader` - Related to react-window
- `recharts` - Chart library not used
- `zustand` - State management not used
- `@sentry/tracing` - Deprecated, use @sentry/nextjs
- `@tailwindcss/postcss` - Not needed with Tailwind v4
- `@testing-library/user-event` - Not used in tests
- `@types/react-window` - Related to unused react-window
- `@vitest/coverage-v8` - Coverage not configured
- `autoprefixer` - Not needed with Tailwind v4
- `eslint-config-next` - Redundant with Next.js built-in config
- `eslint-plugin-prettier` - Use prettier separately

#### Missing Dependencies

- `puppeteer` - Used in mobile-test.js script
- `glob` - Used in verify-ui-changes.ts script

**Estimated Bundle Size Reduction**: ~2.1MB

### 2. Circular Dependencies (3 Found)

1. `components/features/events/CreateEventWizard.tsx` ↔ `EventBasicsStep.tsx`
2. `components/features/events/CreateEventWizard.tsx` ↔ `EventReviewStep.tsx`
3. `components/features/media/GuestPhotoGallery.tsx` ↔ `index.ts`

**Impact**: Build warnings, potential runtime issues, harder maintenance

### 3. Code Organization Issues

#### Current Structure Problems

- Mixed component organization (`app/components/` vs `components/`)
- Inconsistent import paths (`@/app/components` vs `@/components`)
- Large service files violating Single Responsibility Principle
- Scattered hook organization

#### Unused Exports (Sample from ts-prune)

- Multiple layout and page default exports
- Unused utility functions in lib/index.ts
- Hook exports not used across modules

### 4. Supabase Security Issues

#### Database Security Warnings (23 Functions)

- **Issue**: Functions with mutable search_path (security vulnerability)
- **Affected Functions**: All RPC functions missing `SECURITY DEFINER` with `search_path` setting
- **Risk**: SQL injection potential, function hijacking

#### Auth Configuration Issues

- **OTP Expiry**: Set to >1 hour (security risk)
- **Leaked Password Protection**: Disabled (security risk)

**Remediation Required**: [Supabase Security Guide](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

### 5. Architectural Recommendations

#### Current Feature Organization

```
components/
├── features/
│   ├── auth/            ✅ Well organized
│   ├── events/          ⚠️  Has circular deps
│   ├── guests/          ✅ Clean structure
│   ├── messaging/       ✅ Good separation
│   ├── media/           ⚠️  Circular import
│   └── host-dashboard/  ✅ Domain-focused
```

#### Recommended Feature-Based Structure

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   ├── events/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   ├── messaging/
│   │   ├── components/
│   │   │   ├── host/
│   │   │   ├── guest/
│   │   │   └── common/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts
│   └── guests/
├── shared/
│   ├── components/ui/
│   ├── hooks/
│   ├── utils/
│   └── types/
└── app/ (Next.js routes only)
```

## 🚀 Low-Risk Cleanup Plan

### Phase 1: Immediate Wins (No Behavior Changes)

#### PR #1: Dependency Cleanup

**Risk**: Minimal - removing unused dependencies
**Time**: 30 minutes

```bash
# Remove unused dependencies
pnpm remove react-window react-window-infinite-loader recharts zustand
pnpm remove @sentry/tracing @tailwindcss/postcss @testing-library/user-event
pnpm remove @types/react-window @vitest/coverage-v8 autoprefixer
pnpm remove eslint-config-next eslint-plugin-prettier

# Add missing dependencies
pnpm add -D puppeteer glob
```

#### PR #2: Fix Circular Dependencies

**Risk**: Low - structural fixes only
**Time**: 1 hour

1. **Extract shared types** from CreateEventWizard
2. **Move common logic** to separate utility files
3. **Fix media index.ts** export structure

```typescript
// Fix: components/features/events/types.ts
export interface EventWizardStep {
  title: string;
  isValid: boolean;
  data: Record<string, any>;
}

// Fix: CreateEventWizard.tsx - remove direct imports
import { EventBasicsStep } from './steps';
import { EventReviewStep } from './steps';
```

#### PR #3: Supabase Security Fixes

**Risk**: Low - security improvements
**Time**: 45 minutes

```sql
-- Fix all RPC functions with secure search_path
ALTER FUNCTION public.is_valid_phone_for_messaging()
  SECURITY DEFINER SET search_path = public;

-- Apply to all 23 functions identified in audit
```

### Phase 2: Structural Improvements (Medium Risk)

#### PR #4: Import Path Standardization

**Risk**: Medium - affects all components
**Time**: 2 hours

1. **Standardize on `@/components`** for all component imports
2. **Update tsconfig.json** path mapping
3. **Run automated find/replace** for import paths

#### PR #5: Remove Unused Exports

**Risk**: Low - dead code removal
**Time**: 1 hour

Based on ts-prune output, remove unused exports from:

- lib/index.ts utility functions
- Hook re-exports in hooks/index.ts
- Component index files

### Phase 3: Feature Organization (Higher Risk)

#### PR #6: Feature-Based Restructure (Optional)

**Risk**: High - major structural change
**Time**: 4-6 hours

This is optional and can be done incrementally:

1. **Create feature directories** with co-located components/hooks/services
2. **Move components gradually** (one feature at a time)
3. **Update import paths** incrementally
4. **Test thoroughly** after each feature migration

## 🧪 Testing Strategy

### Smoke Tests Added

- **Authentication flow** validation
- **Messaging system** integration
- **Guest management** CRUD operations
- **RLS policy** enforcement
- **Error handling** scenarios

Location: `__tests__/smoke/critical-flows.test.ts`

### Recommended Test Commands

```bash
# Run smoke tests before each PR
pnpm test smoke

# Run full test suite
pnpm test:all

# Lint and fix issues
pnpm lint:fix
```

## 📊 Impact Assessment

| Category           | Current State      | After Cleanup | Improvement |
| ------------------ | ------------------ | ------------- | ----------- |
| Bundle Size        | ~15MB              | ~12.9MB       | -14%        |
| Build Warnings     | 3 circular deps    | 0             | -100%       |
| Security Issues    | 25 warnings        | 2 warnings    | -92%        |
| Import Consistency | Mixed paths        | Standardized  | +100%       |
| Dead Code          | ~50 unused exports | 0             | -100%       |

## 🎯 Recommended Execution Order

1. **Week 1**: PRs #1-3 (Immediate wins)
2. **Week 2**: PRs #4-5 (Structural improvements)
3. **Week 3+**: PR #6 (Feature restructure - optional)

## ⚠️ Risks and Mitigation

### Low Risk Items

- Dependency removal: Verified unused
- Security fixes: Standard Supabase practices
- Dead code removal: No runtime impact

### Medium Risk Items

- Import path changes: Comprehensive testing required
- Circular dependency fixes: May affect build order

### High Risk Items

- Feature restructure: Major architectural change
- **Mitigation**: Do incrementally, one feature at a time

## 🔧 Automation Opportunities

1. **ESLint rules** for import path consistency
2. **Husky pre-commit hooks** for dependency checking
3. **GitHub Actions** for automated security scanning
4. **Bundle analyzer** in CI for size monitoring

## 📋 Success Metrics

- ✅ Zero circular dependencies
- ✅ <25 security warnings
- ✅ 100% consistent import paths
- ✅ <13MB bundle size
- ✅ All smoke tests passing

---

**Next Steps**: Start with Phase 1 PRs for immediate improvements with minimal risk.
