# iOS Readiness Audit - CI Guardrails

**Generated:** 2025-01-08  
**Purpose:** Prevent regression of iOS readiness issues through automated checks  
**Scope:** ESLint rules, CI scripts, and Supabase advisors

## 1. ESLint Rule: Prevent Root Dynamic Imports

### 1.1 Custom ESLint Rule Implementation
**File:** `eslint-rules/no-root-dynamic-imports.js`

```javascript
/**
 * ESLint rule to prevent next/dynamic imports in root layout and providers
 * Prevents CSR bailouts that cause non-deterministic first paint on iOS
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent next/dynamic imports in root layout and provider files',
      category: 'iOS Compatibility',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noDynamicInRoot: 'next/dynamic imports are not allowed in root layout or provider files. Move dynamic imports to page level to prevent CSR bailouts on iOS WebView.',
      noDynamicInProviders: 'next/dynamic imports in provider files cause CSR bailouts. Use static imports for deterministic first paint.',
      noDynamicInLayout: 'next/dynamic imports in app/layout.tsx cause SSR bailouts. Move to page-level components.',
    },
  },

  create(context) {
    const filename = context.getFilename();
    const isRootLayout = filename.includes('app/layout.tsx');
    const isProvider = filename.includes('Provider.tsx') || filename.includes('providers/');
    const isRootLevel = isRootLayout || isProvider;

    if (!isRootLevel) {
      return {}; // Only check root-level files
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'next/dynamic') {
          const messageId = isRootLayout ? 'noDynamicInLayout' : 'noDynamicInProviders';
          context.report({
            node,
            messageId,
          });
        }
      },

      CallExpression(node) {
        // Check for dynamic() calls
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'dynamic'
        ) {
          const messageId = isRootLayout ? 'noDynamicInLayout' : 'noDynamicInProviders';
          context.report({
            node,
            messageId,
          });
        }
      },
    };
  },
};
```

### 1.2 ESLint Configuration Update
**File:** `eslint.config.mjs`

```javascript
// Add to existing ESLint configuration
import noRootDynamicImports from './eslint-rules/no-root-dynamic-imports.js';

export default [
  // ... existing configuration
  {
    files: ['app/layout.tsx', 'lib/providers/**/*.tsx', 'app/Providers.tsx'],
    plugins: {
      'unveil-ios': {
        rules: {
          'no-root-dynamic-imports': noRootDynamicImports,
        },
      },
    },
    rules: {
      'unveil-ios/no-root-dynamic-imports': 'error',
    },
  },
];
```

## 2. Makefile Target Validation

### 2.1 iOS Target Validation Script
**File:** `scripts/validate-ios-targets.sh`

```bash
#!/bin/bash

# Validate iOS Makefile targets to prevent target sprawl
# Ensures only approved targets exist

set -euo pipefail

APPROVED_TARGETS=(
    "ios-verify"
    "ios-run-dev" 
    "ios-archive"
    "ios-open"
    "ios-clean"
    "ios-ruby-check"
    "ios-build-without-pods"
)

echo "🔍 Validating iOS Makefile targets..."

# Extract iOS targets from Makefile
EXISTING_TARGETS=$(grep -E "^ios-[a-zA-Z-]+:" Makefile | sed 's/:.*$//' | sort)

# Check for unapproved targets
UNAPPROVED=()
while IFS= read -r target; do
    if [[ ! " ${APPROVED_TARGETS[@]} " =~ " ${target} " ]]; then
        UNAPPROVED+=("$target")
    fi
done <<< "$EXISTING_TARGETS"

if [ ${#UNAPPROVED[@]} -gt 0 ]; then
    echo "❌ Unapproved iOS targets found:"
    printf '   %s\n' "${UNAPPROVED[@]}"
    echo ""
    echo "Approved targets:"
    printf '   %s\n' "${APPROVED_TARGETS[@]}"
    echo ""
    echo "To fix:"
    echo "1. Remove unapproved targets from Makefile"
    echo "2. Or add to APPROVED_TARGETS in scripts/validate-ios-targets.sh"
    exit 1
fi

echo "✅ All iOS targets are approved"
echo "Found targets:"
printf '   %s\n' "${APPROVED_TARGETS[@]}"
```

### 2.2 Makefile Integration
**File:** `Makefile`

```makefile
# Add validation target
validate-ios-targets:
	@echo "🔍 Validating iOS target compliance..."
	@bash ./scripts/validate-ios-targets.sh

# Add to existing targets
ios-verify: validate-ios-targets
	@echo "🚀 Running iOS speedup optimizations and verification..."
	@bash ./scripts/ios-speedup.sh
	@echo "🔍 Running iOS verification and repair..."
	@bash ./scripts/ios-verify-repair.sh
```

## 3. Scheme Name Validation

### 3.1 Xcode Scheme Validation Script
**File:** `scripts/validate-ios-schemes.sh`

```bash
#!/bin/bash

# Validate that iOS scripts use correct Xcode scheme names
# Prevents build failures from hardcoded scheme names

set -euo pipefail

APPROVED_SCHEMES=(
    "Unveil (Dev)"
    "Unveil (Prod)"
    "Capacitor"
    "CapacitorCordova"
    "Pods-App"
)

echo "🔍 Validating iOS scheme references in scripts..."

# Check for hardcoded "App" scheme (incorrect)
INCORRECT_REFS=$(grep -r "scheme App" scripts/ios-*.sh || true)
if [[ -n "$INCORRECT_REFS" ]]; then
    echo "❌ Found incorrect scheme references:"
    echo "$INCORRECT_REFS"
    echo ""
    echo "Replace 'scheme App' with 'scheme \"Unveil (Dev)\"' or 'scheme \"Unveil (Prod)\"'"
    exit 1
fi

# Validate scheme names exist in workspace
if [[ -f "ios/App/App.xcworkspace" ]]; then
    WORKSPACE_SCHEMES=$(xcodebuild -workspace ios/App/App.xcworkspace -list | grep -A 10 "Schemes:" | tail -n +2 | sed 's/^[[:space:]]*//' | grep -v "^$")
    
    echo "✅ Available schemes in workspace:"
    echo "$WORKSPACE_SCHEMES"
    
    # Check that our approved schemes exist
    for scheme in "${APPROVED_SCHEMES[@]}"; do
        if ! echo "$WORKSPACE_SCHEMES" | grep -q "^$scheme$"; then
            echo "⚠️  Approved scheme '$scheme' not found in workspace"
        fi
    done
fi

echo "✅ iOS scheme validation complete"
```

## 4. Layout Drift Detection

### 4.1 Layout Consistency Check
**File:** `scripts/check-layout-consistency.sh`

```bash
#!/bin/bash

# Detect layout drift between different layout files
# Ensures metadata consistency across layouts

set -euo pipefail

echo "🔍 Checking layout file consistency..."

LAYOUT_FILES=(
    "app/layout.tsx"
    "app/layout-ios.tsx"
    "app/layout-web.tsx.bak"
)

# Check if multiple layout files exist (potential drift)
EXISTING_LAYOUTS=()
for layout in "${LAYOUT_FILES[@]}"; do
    if [[ -f "$layout" ]]; then
        EXISTING_LAYOUTS+=("$layout")
    fi
done

if [[ ${#EXISTING_LAYOUTS[@]} -gt 1 ]]; then
    echo "⚠️  Multiple layout files detected:"
    printf '   %s\n' "${EXISTING_LAYOUTS[@]}"
    echo ""
    echo "Potential layout drift risk. Consider:"
    echo "1. Using single layout strategy (recommended)"
    echo "2. Or implement layout sync validation"
    
    # Check for metadata differences
    if [[ -f "app/layout.tsx" && -f "app/layout-ios.tsx" ]]; then
        echo ""
        echo "🔍 Checking metadata consistency..."
        
        # Extract metadata from both files
        MAIN_METADATA=$(grep -A 20 "export const metadata" app/layout.tsx || echo "No metadata found")
        IOS_METADATA=$(grep -A 20 "export const metadata" app/layout-ios.tsx || echo "No metadata found")
        
        if [[ "$MAIN_METADATA" != "$IOS_METADATA" ]]; then
            echo "❌ Metadata differs between layout files"
            echo "This can cause inconsistent behavior between web and iOS"
        else
            echo "✅ Metadata is consistent"
        fi
    fi
else
    echo "✅ Single layout file detected: ${EXISTING_LAYOUTS[0]}"
fi
```

## 5. Provider Architecture Validation

### 5.1 Provider Import Analysis
**File:** `scripts/validate-provider-imports.sh`

```bash
#!/bin/bash

# Validate provider import patterns
# Ensures no dynamic imports in root providers

set -euo pipefail

echo "🔍 Validating provider import patterns..."

PROVIDER_FILES=(
    "lib/providers/LeanRootProvider.tsx"
    "lib/providers/RootProvider.tsx"
    "app/Providers.tsx"
)

for provider in "${PROVIDER_FILES[@]}"; do
    if [[ -f "$provider" ]]; then
        echo "Checking $provider..."
        
        # Check for dynamic imports
        DYNAMIC_IMPORTS=$(grep -n "next/dynamic\|dynamic(" "$provider" || true)
        if [[ -n "$DYNAMIC_IMPORTS" ]]; then
            echo "❌ Dynamic imports found in $provider:"
            echo "$DYNAMIC_IMPORTS"
            echo "This will cause CSR bailouts on iOS WebView"
            exit 1
        fi
        
        # Check for browser API usage at module level
        BROWSER_APIS=$(grep -n "window\.|document\.|localStorage" "$provider" | grep -v "typeof window\|useEffect\|onClick" || true)
        if [[ -n "$BROWSER_APIS" ]]; then
            echo "⚠️  Potential browser API usage at module level in $provider:"
            echo "$BROWSER_APIS"
            echo "Ensure these are guarded with typeof window !== 'undefined'"
        fi
        
        echo "✅ $provider validation complete"
    fi
done

echo "✅ Provider validation complete"
```

## 6. CI Pipeline Integration

### 6.1 GitHub Actions Workflow
**File:** `.github/workflows/ios-readiness.yml`

```yaml
name: iOS Readiness Checks

on:
  pull_request:
    paths:
      - 'app/layout*.tsx'
      - 'lib/providers/**'
      - 'scripts/ios-*'
      - 'Makefile'
      - 'capacitor.config.ts'

jobs:
  ios-readiness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run ESLint iOS rules
        run: pnpm lint --config eslint.config.mjs
      
      - name: Validate iOS targets
        run: bash scripts/validate-ios-targets.sh
      
      - name: Check layout consistency
        run: bash scripts/check-layout-consistency.sh
      
      - name: Validate provider imports
        run: bash scripts/validate-provider-imports.sh
      
      - name: Check for CSR bailout patterns
        run: |
          # Check for dynamic imports in root files
          if grep -r "next/dynamic" app/layout.tsx lib/providers/; then
            echo "❌ Dynamic imports found in root files"
            exit 1
          fi
          echo "✅ No CSR bailout patterns detected"
```

## 7. Supabase Advisors Integration

### 7.1 Custom Advisor for iOS Readiness
**Note:** Supabase advisors are already in place for database security. For iOS readiness, we rely on the ESLint rules and CI checks above since Supabase advisors focus on database-level issues.

### 7.2 Performance Monitoring Integration
**File:** `scripts/ios-performance-check.ts`

```typescript
// Monitor iOS WebView performance metrics
// Integrates with existing RUM collection

import { supabase } from '@/lib/supabase';

export async function checkIOSPerformance() {
  // Query RUM data for iOS WebView performance
  const { data: performanceData } = await supabase
    .from('rum_events')
    .select('*')
    .eq('user_agent_platform', 'iOS')
    .gte('first_contentful_paint', 3000); // Flag slow first paint
  
  if (performanceData && performanceData.length > 0) {
    console.warn('⚠️  Slow first paint detected on iOS devices');
    console.warn('Consider checking for CSR bailouts or heavy JavaScript');
  }
  
  return performanceData;
}
```

## 8. Monitoring and Alerting

### 8.1 Performance Thresholds
```typescript
// Performance thresholds for iOS WebView
export const IOS_PERFORMANCE_THRESHOLDS = {
  FIRST_PAINT: 2000,           // 2 seconds max
  FIRST_CONTENTFUL_PAINT: 2500, // 2.5 seconds max
  TIME_TO_INTERACTIVE: 4000,    // 4 seconds max
  CSR_BAILOUT_RATE: 0,         // 0% tolerance for CSR bailouts
};
```

### 8.2 Alert Conditions
- **CSR Bailout Detected:** Immediate alert to development team
- **First Paint > 2s:** Warning alert with device/network context
- **Build Failure:** Immediate alert with scheme name validation
- **Layout Drift:** Weekly report on layout file consistency

## 9. Documentation and Training

### 9.1 Developer Guidelines
**File:** `docs/ios-development-guidelines.md`

```markdown
# iOS Development Guidelines

## Critical Rules
1. **Never use next/dynamic in root providers or app/layout.tsx**
2. **Always use correct Xcode scheme names in scripts**
3. **Test iOS builds before merging provider changes**
4. **Keep single layout strategy - avoid layout file proliferation**

## Approved Patterns
- Dynamic imports at page level ✅
- Static imports in root providers ✅
- Browser API usage in useEffect ✅
- Environment-driven configuration ✅

## Prohibited Patterns
- Dynamic imports in root providers ❌
- Browser APIs at module level ❌
- Hardcoded "App" scheme name ❌
- Manual layout file swapping ❌
```

## 10. Maintenance Schedule

### 10.1 Regular Checks
- **Daily:** CI pipeline runs on all PRs
- **Weekly:** Performance threshold review
- **Monthly:** iOS target validation audit
- **Quarterly:** Full iOS readiness assessment

### 10.2 Update Triggers
- **New Next.js version:** Re-validate dynamic import behavior
- **New iOS version:** Test WebView compatibility
- **New Xcode version:** Validate scheme names and build process
- **Provider architecture changes:** Run full validation suite

## 11. Success Metrics

### 11.1 Compliance Metrics
- **CSR Bailout Rate:** 0% (target)
- **Build Success Rate:** 100% (target)
- **CI Check Pass Rate:** 95%+ (target)
- **Layout Drift Incidents:** 0 per quarter (target)

### 11.2 Performance Metrics
- **iOS First Paint:** <2 seconds (target)
- **Build Time:** No regression from baseline
- **Developer Experience:** Single command success rate >95%

These guardrails ensure that the iOS readiness improvements are maintained long-term and prevent regression of the critical issues identified in this audit.
